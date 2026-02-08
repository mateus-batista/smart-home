"""OpenAI LLM provider with native tool calling."""

import json
import logging
from typing import Any

from belle.config import settings
from belle.llm.common import (
    ToolCall,
    build_system_prompt_with_context,
    execute_tool_calls,
    format_response,
    get_followup_instruction,
)
from belle.tools import ALL_TOOLS

logger = logging.getLogger(__name__)


def _get_client():
    """Get the OpenAI client (lazy import)."""
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise ImportError(
            "openai package is required for the OpenAI provider. "
            "Install it with: uv sync --extra cloud"
        )

    if not settings.openai_api_key:
        raise ValueError("BELLE_OPENAI_API_KEY is required when using the OpenAI provider")

    return AsyncOpenAI(api_key=settings.openai_api_key)


def _convert_tools_for_openai() -> list[dict]:
    """Convert tools to OpenAI format.

    Our tools are already in OpenAI format (type: function, function: {...}).
    """
    return ALL_TOOLS


async def chat_async(
    user_message: str,
    conversation_history: list[dict] | None = None,
) -> dict[str, Any]:
    """Process a user message using the OpenAI API."""
    client = _get_client()

    system_prompt = await build_system_prompt_with_context()

    # Build messages
    messages = [{"role": "system", "content": system_prompt}]
    if conversation_history:
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})

    tools = _convert_tools_for_openai()

    # First API call
    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=messages,
        tools=tools,
        max_tokens=settings.llm_max_tokens,
        temperature=settings.llm_temperature,
    )

    choice = response.choices[0]
    response_message = choice.message

    logger.info(
        f"OpenAI response: finish_reason={choice.finish_reason}, "
        f"tool_calls={len(response_message.tool_calls or [])}"
    )

    # Check for tool calls
    tool_calls: list[ToolCall] = []
    tool_results: list[dict[str, Any]] = []

    if response_message.tool_calls:
        # Parse tool calls from the API response
        for tc in response_message.tool_calls:
            try:
                arguments = json.loads(tc.function.arguments) if tc.function.arguments else {}
                tool_calls.append(ToolCall(name=tc.function.name, arguments=arguments))
                logger.info(f"OpenAI tool call: {tc.function.name}({arguments})")
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse tool call arguments: {e}")

        if tool_calls:
            tool_results = await execute_tool_calls(tool_calls)

            # Build follow-up messages with tool results
            messages.append(response_message.model_dump())

            for i, tr in enumerate(tool_results):
                messages.append({
                    "role": "tool",
                    "tool_call_id": response_message.tool_calls[i].id,
                    "content": json.dumps(tr["result"], ensure_ascii=False),
                })

            followup_instruction = get_followup_instruction(tool_results)
            messages.append({"role": "user", "content": followup_instruction})

            # Follow-up call (no tools needed for the confirmation)
            followup_response = await client.chat.completions.create(
                model=settings.openai_model,
                messages=messages,
                max_tokens=150,
                temperature=settings.llm_temperature,
            )

            final_response = followup_response.choices[0].message.content or ""
        else:
            final_response = response_message.content or ""
    else:
        final_response = response_message.content or ""

    logger.info(f"OpenAI final response: {final_response[:200]}...")

    return format_response(final_response, tool_calls, tool_results)
