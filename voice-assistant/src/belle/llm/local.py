"""Local MLX/Qwen LLM provider."""

import json
import logging
import re
import time

from belle.mlx_lock import mlx_lock
from typing import Any

from pydantic import ValidationError

from belle.config import settings
from belle.llm.common import (
    ALL_TOOL_FUNCTIONS,
    ToolCall,
    build_messages,
    build_system_prompt_with_context,
    execute_tool_calls,
    format_response,
    get_followup_instruction,
)
from belle.tools import ALL_TOOLS

logger = logging.getLogger(__name__)

# Lazy-loaded model and tokenizer
_model = None
_tokenizer = None


def _load_model():
    """Load LLM model lazily on first use."""
    global _model, _tokenizer

    if _model is not None:
        return _model, _tokenizer

    logger.info(f"Loading LLM model: {settings.llm_model}")

    from mlx_lm import load

    _model, _tokenizer = load(settings.llm_model)
    logger.info("LLM model loaded successfully")
    return _model, _tokenizer


def _extract_json_objects(text: str) -> list[dict]:
    """
    Extract JSON objects from text using json-repair for robustness.

    Handles malformed JSON that LLMs often produce.
    """
    from json_repair import repair_json

    objects = []

    # First, try to find <tool_call> tags
    tool_call_pattern = r"<tool_call>(.*?)</tool_call>"
    matches = re.findall(tool_call_pattern, text, re.DOTALL)
    for match in matches:
        try:
            repaired = repair_json(match.strip(), return_objects=True)
            if isinstance(repaired, dict):
                objects.append(repaired)
            elif isinstance(repaired, list):
                objects.extend(repaired)
        except Exception as e:
            logger.debug(f"Failed to repair JSON from tool_call tag: {e}")

    # If no tool_call tags, look for JSON objects with "name" key
    if not objects:
        json_pattern = r'\{[^{}]*"name"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
        candidates = re.findall(json_pattern, text, re.DOTALL)

        for candidate in candidates:
            try:
                repaired = repair_json(candidate, return_objects=True)
                if isinstance(repaired, dict) and "name" in repaired:
                    objects.append(repaired)
            except Exception:
                pass

    # Fallback: try to find and repair any JSON-like structure
    if not objects and "{" in text:
        for match in re.finditer(r"\{", text):
            start = match.start()
            for end in range(start + 10, min(start + 500, len(text) + 1)):
                if text[end - 1] == "}":
                    candidate = text[start:end]
                    try:
                        repaired = repair_json(candidate, return_objects=True)
                        if isinstance(repaired, dict) and "name" in repaired:
                            objects.append(repaired)
                            break
                    except Exception:
                        pass

    return objects


def _parse_tool_calls(response_text: str | None) -> list[ToolCall] | None:
    """
    Parse and validate tool calls from the model response.

    Uses json-repair for robustness and Pydantic for validation.
    """
    if not response_text:
        return None

    tool_calls = []

    try:
        json_objects = _extract_json_objects(response_text)

        for obj in json_objects:
            try:
                tool_call = ToolCall.model_validate(obj)

                if tool_call.name in ALL_TOOL_FUNCTIONS:
                    tool_calls.append(tool_call)
                    logger.info(f"Parsed valid tool call: {tool_call.name}({tool_call.arguments})")
                else:
                    logger.warning(f"Unknown tool name: {tool_call.name}")

            except ValidationError as e:
                logger.debug(f"Tool call validation failed: {e}")

    except Exception as e:
        logger.warning(f"Error parsing tool calls: {e}")

    if tool_calls:
        logger.info(f"Found {len(tool_calls)} valid tool call(s)")
    else:
        logger.debug(f"No tool calls found in response: {response_text[:200]}...")

    return tool_calls if tool_calls else None


def _clean_response(response: str | None) -> str:
    """Clean up the response by removing tool call artifacts."""
    if response is None:
        return ""

    # Remove tool call tags and their content
    response = re.sub(r"<tool_call>.*?</tool_call>", "", response, flags=re.DOTALL)

    # Remove JSON tool calls (handle nested braces properly)
    result = []
    i = 0
    while i < len(response):
        if response[i] == "{" and i + 10 < len(response) and '"name"' in response[i : i + 50]:
            depth = 0
            found_end = False
            for j in range(i, len(response)):
                if response[j] == "{":
                    depth += 1
                elif response[j] == "}":
                    depth -= 1
                    if depth == 0:
                        i = j + 1
                        found_end = True
                        break
            if not found_end:
                result.append(response[i])
                i += 1
        else:
            result.append(response[i])
            i += 1

    response = "".join(result)

    # Clean up extra whitespace
    response = re.sub(r"\n{3,}", "\n\n", response)
    response = response.strip()

    return response


async def chat_async(
    user_message: str,
    conversation_history: list[dict] | None = None,
) -> dict[str, Any]:
    """Process a user message using the local MLX model."""
    from mlx_lm import generate
    from mlx_lm.sample_utils import make_sampler

    model, tokenizer = _load_model()

    sampler = make_sampler(temp=settings.llm_temperature)

    system_prompt_with_context = await build_system_prompt_with_context()
    messages = build_messages(user_message, conversation_history, system_prompt_with_context)

    # Apply chat template with native Qwen tool support
    prompt = tokenizer.apply_chat_template(
        messages,
        tools=ALL_TOOLS,
        tokenize=False,
        add_generation_prompt=True,
    )

    logger.debug(f"Generated prompt: {prompt[:500]}...")

    start_time = time.time()
    with mlx_lock:
        response_text = generate(
            model,
            tokenizer,
            prompt=prompt,
            max_tokens=settings.llm_max_tokens,
            sampler=sampler,
            verbose=False,
        )
    elapsed = time.time() - start_time

    if response_text is None:
        response_text = ""
        logger.warning("LLM returned None response")

    logger.info(f"LLM took {elapsed:.1f}s ({len(response_text)} chars): {response_text[:200]}...")

    # Check for tool calls
    tool_calls = _parse_tool_calls(response_text)
    tool_results = []
    final_response = response_text

    if tool_calls:
        tool_results = await execute_tool_calls(tool_calls)

        # Generate a follow-up response based on tool results
        messages.append({"role": "assistant", "content": response_text})

        for tr in tool_results:
            tool_result_content = json.dumps(
                {"name": tr["tool"], "content": tr["result"]},
                ensure_ascii=False,
            )
            messages.append({"role": "tool", "content": tool_result_content})

        followup_instruction = get_followup_instruction(tool_results)
        messages.append({"role": "user", "content": followup_instruction})

        followup_prompt = tokenizer.apply_chat_template(
            messages,
            tools=ALL_TOOLS,
            tokenize=False,
            add_generation_prompt=True,
        )

        start_time = time.time()
        with mlx_lock:
            final_response = generate(
                model,
                tokenizer,
                prompt=followup_prompt,
                max_tokens=150,
                sampler=sampler,
                verbose=False,
            )
        elapsed = time.time() - start_time
        logger.info(f"LLM follow-up took {elapsed:.1f}s")

        if final_response is None:
            final_response = response_text
            logger.warning("LLM follow-up returned None response")

    final_response = _clean_response(final_response)

    return format_response(final_response, tool_calls, tool_results)


def preload_model() -> None:
    """Pre-load the LLM model to avoid cold start latency."""
    _load_model()
    logger.info("LLM model pre-loaded")
