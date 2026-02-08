"""Anthropic LLM provider with native tool calling."""

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
    """Get the Anthropic client (lazy import)."""
    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        raise ImportError(
            "anthropic package is required for the Anthropic provider. "
            "Install it with: uv sync --extra cloud"
        )

    if not settings.anthropic_api_key:
        raise ValueError("BELLE_ANTHROPIC_API_KEY is required when using the Anthropic provider")

    return AsyncAnthropic(api_key=settings.anthropic_api_key)


def _convert_tools_for_anthropic() -> list[dict]:
    """Convert tools from OpenAI format to Anthropic format.

    OpenAI: {"type": "function", "function": {"name", "description", "parameters"}}
    Anthropic: {"name", "description", "input_schema"}
    """
    anthropic_tools = []
    for tool in ALL_TOOLS:
        func = tool["function"]
        anthropic_tools.append({
            "name": func["name"],
            "description": func["description"],
            "input_schema": func["parameters"],
        })
    return anthropic_tools


async def chat_async(
    user_message: str,
    conversation_history: list[dict] | None = None,
) -> dict[str, Any]:
    """Process a user message using the Anthropic API."""
    client = _get_client()

    system_prompt = await build_system_prompt_with_context()

    # Build messages (Anthropic uses system as a separate parameter)
    messages = []
    if conversation_history:
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})

    tools = _convert_tools_for_anthropic()

    # First API call
    response = await client.messages.create(
        model=settings.anthropic_model,
        system=system_prompt,
        messages=messages,
        tools=tools,
        max_tokens=settings.llm_max_tokens,
        temperature=settings.llm_temperature,
    )

    logger.info(
        f"Anthropic response: stop_reason={response.stop_reason}, "
        f"content_blocks={len(response.content)}"
    )

    # Parse response content blocks
    tool_calls: list[ToolCall] = []
    text_parts: list[str] = []
    tool_use_blocks: list[Any] = []

    for block in response.content:
        if block.type == "text":
            text_parts.append(block.text)
        elif block.type == "tool_use":
            tool_use_blocks.append(block)
            tool_calls.append(ToolCall(name=block.name, arguments=block.input or {}))
            logger.info(f"Anthropic tool call: {block.name}({block.input})")

    tool_results: list[dict[str, Any]] = []

    if tool_calls:
        tool_results = await execute_tool_calls(tool_calls)

        # Build follow-up messages with tool results
        # Anthropic requires the assistant message with tool_use blocks
        messages.append({"role": "assistant", "content": response.content})

        # Add tool results
        tool_result_content = []
        for i, tr in enumerate(tool_results):
            tool_result_content.append({
                "type": "tool_result",
                "tool_use_id": tool_use_blocks[i].id,
                "content": json.dumps(tr["result"], ensure_ascii=False),
            })

        messages.append({"role": "user", "content": tool_result_content})

        # Add followup instruction
        followup_instruction = get_followup_instruction(tool_results)
        messages.append({"role": "user", "content": followup_instruction})

        # Anthropic doesn't allow consecutive user messages, merge them
        # The tool_result and followup are both "user" role, so merge the last two
        merged_content = messages[-2]["content"] + [
            {"type": "text", "text": followup_instruction}
        ]
        messages.pop()  # Remove the followup
        messages[-1]["content"] = merged_content  # Merge into tool_result message

        # Follow-up call (no tools needed for the confirmation)
        followup_response = await client.messages.create(
            model=settings.anthropic_model,
            system=system_prompt,
            messages=messages,
            max_tokens=150,
            temperature=settings.llm_temperature,
        )

        final_response = ""
        for block in followup_response.content:
            if block.type == "text":
                final_response += block.text
    else:
        final_response = " ".join(text_parts)

    final_response = final_response.strip()
    logger.info(f"Anthropic final response: {final_response[:200]}...")

    return format_response(final_response, tool_calls, tool_results)
