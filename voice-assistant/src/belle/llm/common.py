"""Shared logic for LLM providers."""

import json
import logging
from typing import Any

from pydantic import BaseModel

from belle.context import clear_context_cache, get_smart_home_context_json
from belle.http import get_tool_deduplicator
from belle.personality import SYSTEM_PROMPT, TOOL_INSTRUCTIONS
from belle.tools.devices import DEVICE_TOOL_FUNCTIONS
from belle.tools.groups import GROUP_TOOL_FUNCTIONS
from belle.tools.rooms import ROOM_TOOL_FUNCTIONS

logger = logging.getLogger(__name__)

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


def build_messages(
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

    if conversation_history:
        messages.extend(conversation_history)

    messages.append({"role": "user", "content": user_message})

    return messages


async def build_system_prompt_with_context() -> str:
    """Build the full system prompt with smart home context."""
    smart_home_context = await get_smart_home_context_json()
    context_json = json.dumps(smart_home_context, indent=2, ensure_ascii=False)
    logger.debug(f"Smart home context: {context_json[:300]}...")

    return f"""{SYSTEM_PROMPT}

{TOOL_INSTRUCTIONS}

<context>
{context_json}
</context>

IMPORTANT: Use device/room names EXACTLY as they appear in the context above. Don't make assumptions about values.
After tool execution, provide a brief confirmation."""


async def execute_tool(tool_call: ToolCall) -> dict[str, Any]:
    """Execute a validated tool call and return the result."""
    func = ALL_TOOL_FUNCTIONS.get(tool_call.name)
    if not func:
        return {"success": False, "error": f"Unknown tool: {tool_call.name}"}

    try:
        result = await func(**tool_call.arguments)
        return result
    except TypeError as e:
        logger.error(f"Invalid arguments for tool {tool_call.name}: {e}")
        return {"success": False, "error": f"Invalid arguments: {e}"}
    except Exception as e:
        logger.error(f"Error executing tool {tool_call.name}: {e}")
        return {"success": False, "error": str(e)}


async def execute_tool_calls(tool_calls: list[ToolCall]) -> list[dict[str, Any]]:
    """Execute tool calls with deduplication. Returns list of tool result dicts."""
    deduplicator = get_tool_deduplicator()
    tool_results = []

    for tool_call in tool_calls:
        dedup_key = deduplicator.make_key(tool_call.name, **tool_call.arguments)

        if deduplicator.is_duplicate(dedup_key):
            logger.info(f"Skipping duplicate tool call: {tool_call.name}")
            tool_results.append({
                "tool": tool_call.name,
                "arguments": tool_call.arguments,
                "result": {"success": True, "skipped": True, "reason": "duplicate request"},
            })
            continue

        logger.info(f"Executing tool: {tool_call.name} with args: {tool_call.arguments}")
        result = await execute_tool(tool_call)
        tool_results.append({
            "tool": tool_call.name,
            "arguments": tool_call.arguments,
            "result": result,
        })

    # Clear context cache since device states may have changed
    clear_context_cache()

    return tool_results


def format_response(
    final_response: str,
    tool_calls: list[ToolCall] | None,
    tool_results: list[dict[str, Any]],
) -> dict[str, Any]:
    """Format the final response dict returned by all providers."""
    return {
        "response": final_response,
        "tool_calls": [
            {"name": tc.name, "arguments": tc.arguments} for tc in (tool_calls or [])
        ],
        "tool_results": tool_results,
        "actions": [
            {
                "device": r["result"].get("device")
                or r["result"].get("room")
                or r["result"].get("group"),
                "action": r["result"].get("action"),
                "success": r["result"].get("success", False),
            }
            for r in tool_results
            if r["result"].get("success")
        ],
    }


def get_followup_instruction(tool_results: list[dict[str, Any]]) -> str:
    """Get the followup instruction based on tool results."""
    any_success = any(r["result"].get("success", False) for r in tool_results)
    if any_success:
        return "Confirm what was done in a few words. Don't list individual device names."
    else:
        return "The action FAILED. Briefly explain what went wrong based on the error."
