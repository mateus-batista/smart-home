"""LLM module with function calling for Belle."""

import json
import logging
import re
from typing import Any

from pydantic import BaseModel, ValidationError

from belle.config import settings
from belle.context import get_smart_home_context_json, clear_context_cache
from belle.personality import SYSTEM_PROMPT, TOOL_INSTRUCTIONS
from belle.tools import ALL_TOOLS
from belle.tools.devices import DEVICE_TOOL_FUNCTIONS
from belle.tools.groups import GROUP_TOOL_FUNCTIONS
from belle.tools.rooms import ROOM_TOOL_FUNCTIONS

logger = logging.getLogger(__name__)

# Lazy-loaded model and tokenizer
_model = None
_tokenizer = None

# Combine all tool functions
ALL_TOOL_FUNCTIONS = {
    **DEVICE_TOOL_FUNCTIONS,
    **ROOM_TOOL_FUNCTIONS,
    **GROUP_TOOL_FUNCTIONS,
}


class ToolCall(BaseModel):
    """Validated tool call from LLM."""

    name: str
    arguments: dict[str, Any] = {}


def _load_model():
    """Load LLM model lazily on first use."""
    global _model, _tokenizer

    if _model is not None:
        return _model, _tokenizer

    logger.info(f"Loading LLM model: {settings.llm_model}")

    from mlx_lm import load

    _model, _tokenizer = load(settings.llm_model)

    # Set ChatML template if not present (fallback for models without one)
    if _tokenizer.chat_template is None:
        logger.info("Setting default ChatML chat template")
        _tokenizer.chat_template = (
            "{% for message in messages %}"
            "{{'<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>' + '\n'}}"
            "{% endfor %}"
            "{% if add_generation_prompt %}{{ '<|im_start|>assistant\n' }}{% endif %}"
        )

    logger.info("LLM model loaded successfully")
    return _model, _tokenizer


def _build_messages(
    user_message: str,
    conversation_history: list[dict] | None = None,
    system_content: str | None = None,
) -> list[dict]:
    """Build the message list for the LLM."""
    messages = [
        {
            "role": "system",
            "content": system_content or SYSTEM_PROMPT,
        }
    ]

    # Add conversation history if provided
    if conversation_history:
        messages.extend(conversation_history)

    # Add the current user message
    messages.append({"role": "user", "content": user_message})

    return messages


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
        # Pattern to find JSON-like structures
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
        # Find all potential JSON starts
        for match in re.finditer(r'\{', text):
            start = match.start()
            # Try increasingly larger substrings
            for end in range(start + 10, min(start + 500, len(text) + 1)):
                if text[end - 1] == '}':
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
        # Extract JSON objects from response
        json_objects = _extract_json_objects(response_text)

        for obj in json_objects:
            try:
                # Validate with Pydantic
                tool_call = ToolCall.model_validate(obj)

                # Verify this is a known tool
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


async def _execute_tool(tool_call: ToolCall) -> dict[str, Any]:
    """Execute a validated tool call and return the result."""
    func = ALL_TOOL_FUNCTIONS.get(tool_call.name)
    if not func:
        return {"success": False, "error": f"Unknown tool: {tool_call.name}"}

    try:
        result = await func(**tool_call.arguments)
        return result
    except TypeError as e:
        # Handle argument mismatch
        logger.error(f"Invalid arguments for tool {tool_call.name}: {e}")
        return {"success": False, "error": f"Invalid arguments: {e}"}
    except Exception as e:
        logger.error(f"Error executing tool {tool_call.name}: {e}")
        return {"success": False, "error": str(e)}


async def chat(
    user_message: str,
    conversation_history: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Process a user message and return a response.

    Args:
        user_message: The user's message/command
        conversation_history: Optional list of previous messages

    Returns:
        dict with:
            - response: The assistant's text response
            - tool_calls: List of tools that were called
            - tool_results: Results from tool executions
    """
    from mlx_lm import generate
    from mlx_lm.sample_utils import make_sampler

    model, tokenizer = _load_model()

    # Create sampler with temperature settings
    sampler = make_sampler(temp=settings.llm_temperature)

    # Fetch current smart home state as structured JSON
    smart_home_context = await get_smart_home_context_json()
    context_json = json.dumps(smart_home_context, indent=2, ensure_ascii=False)
    logger.debug(f"Smart home context: {context_json[:300]}...")

    # Format tools as JSON for the system prompt
    tools_json = json.dumps([t["function"] for t in ALL_TOOLS], indent=2)

    # Build system prompt with context and tools
    system_prompt_with_context = f"""{SYSTEM_PROMPT}

{TOOL_INSTRUCTIONS}

You are also a function calling AI model. You have access to the current smart home state and available tools.

<context>
{context_json}
</context>

<tools>
{tools_json}
</tools>

IMPORTANT: Use device/room names EXACTLY as they appear in the context above. Don't make assumptions about values.

When you need to call a function, return a JSON object within <tool_call></tool_call> XML tags:
<tool_call>
{{"name": "function_name", "arguments": {{"param1": "value1"}}}}
</tool_call>

You can call multiple tools by using multiple <tool_call> tags.
After tool execution, provide a brief confirmation."""

    messages = _build_messages(user_message, conversation_history, system_prompt_with_context)

    # Apply chat template
    prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )

    logger.debug(f"Generated prompt: {prompt[:500]}...")

    # Generate response
    response_text = generate(
        model,
        tokenizer,
        prompt=prompt,
        max_tokens=settings.llm_max_tokens,
        sampler=sampler,
        verbose=False,
    )

    # Handle None or empty response
    if response_text is None:
        response_text = ""
        logger.warning("LLM returned None response")

    logger.info(f"LLM response ({len(response_text)} chars): {response_text[:200]}...")

    # Check for tool calls
    tool_calls = _parse_tool_calls(response_text)
    tool_results = []
    final_response = response_text

    if tool_calls:
        # Execute each tool call
        for tool_call in tool_calls:
            logger.info(f"Executing tool: {tool_call.name} with args: {tool_call.arguments}")
            result = await _execute_tool(tool_call)
            tool_results.append({
                "tool": tool_call.name,
                "arguments": tool_call.arguments,
                "result": result,
            })

        # Clear context cache since device states may have changed
        clear_context_cache()

        # Generate a follow-up response based on tool results
        # Add the assistant's response with tool calls
        messages.append({"role": "assistant", "content": response_text})

        # Add tool results using the 'tool' role
        for tr in tool_results:
            tool_result_content = json.dumps({
                "name": tr["tool"],
                "content": tr["result"],
            }, ensure_ascii=False)
            messages.append({
                "role": "tool",
                "content": tool_result_content,
            })

        # Check if any tools succeeded
        any_success = any(r["result"].get("success", False) for r in tool_results)
        if any_success:
            followup_instruction = (
                "Briefly confirm what was done. Only mention devices that succeeded."
            )
        else:
            followup_instruction = (
                "The action FAILED. Briefly explain what went wrong based on the error."
            )

        messages.append({
            "role": "user",
            "content": followup_instruction,
        })

        # Apply chat template again
        followup_prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

        # Generate follow-up
        final_response = generate(
            model,
            tokenizer,
            prompt=followup_prompt,
            max_tokens=150,  # Short response
            sampler=sampler,
            verbose=False,
        )

        # Handle None response
        if final_response is None:
            final_response = response_text
            logger.warning("LLM follow-up returned None response")

    # Clean up the response (remove any remaining tool call artifacts)
    final_response = _clean_response(final_response)

    return {
        "response": final_response,
        "tool_calls": [{"name": tc.name, "arguments": tc.arguments} for tc in (tool_calls or [])],
        "tool_results": tool_results,
        "actions": [
            {
                "device": r["result"].get("device") or r["result"].get("room") or r["result"].get("group"),
                "action": r["result"].get("action"),
                "success": r["result"].get("success", False),
            }
            for r in tool_results
            if r["result"].get("success")
        ],
    }


def _clean_response(response: str | None) -> str:
    """Clean up the response by removing tool call artifacts."""
    import re

    if response is None:
        return ""

    # Remove tool call tags and their content
    response = re.sub(r"<tool_call>.*?</tool_call>", "", response, flags=re.DOTALL)

    # Remove JSON tool calls (handle nested braces properly)
    # Find and remove complete JSON objects that look like tool calls
    result = []
    i = 0
    while i < len(response):
        if response[i] == '{' and i + 10 < len(response) and '"name"' in response[i:i+50]:
            # Potentially a tool call JSON, try to skip it
            depth = 0
            start = i
            found_end = False
            for j in range(i, len(response)):
                if response[j] == '{':
                    depth += 1
                elif response[j] == '}':
                    depth -= 1
                    if depth == 0:
                        # Skip this JSON object
                        i = j + 1
                        found_end = True
                        break
            if not found_end:
                result.append(response[i])
                i += 1
        else:
            result.append(response[i])
            i += 1

    response = ''.join(result)

    # Clean up extra whitespace
    response = re.sub(r"\n{3,}", "\n\n", response)
    response = response.strip()

    return response


async def chat_async(
    user_message: str,
    conversation_history: list[dict] | None = None,
) -> dict[str, Any]:
    """Async wrapper for chat (already async internally)."""
    return await chat(user_message, conversation_history)


def preload_model() -> None:
    """Pre-load the LLM model to avoid cold start latency."""
    _load_model()
    logger.info("LLM model pre-loaded")
