"""LLM module with pluggable provider support.

Providers:
- local: MLX/Qwen (default, runs on-device)
- openai: OpenAI API (requires BELLE_OPENAI_API_KEY)
- anthropic: Anthropic API (requires BELLE_ANTHROPIC_API_KEY)
"""

import logging
from typing import Any

from belle.config import settings
from belle.llm.common import ToolCall

logger = logging.getLogger(__name__)

__all__ = ["chat_async", "preload_model", "ToolCall"]

# Re-export local-only symbols for backward compatibility with tests
from belle.llm.local import _extract_json_objects, _parse_tool_calls  # noqa: F401


async def chat_async(
    user_message: str,
    conversation_history: list[dict] | None = None,
) -> dict[str, Any]:
    """Route chat to the configured LLM provider."""
    provider = settings.llm_provider

    if provider == "openai":
        from belle.llm.openai import chat_async as _chat

        return await _chat(user_message, conversation_history)
    elif provider == "anthropic":
        from belle.llm.anthropic import chat_async as _chat

        return await _chat(user_message, conversation_history)
    else:
        from belle.llm.local import chat_async as _chat

        return await _chat(user_message, conversation_history)


def preload_model() -> None:
    """Pre-load the model for the configured provider.

    Only applicable for the local provider (cloud providers have no local model).
    """
    provider = settings.llm_provider

    if provider == "local":
        from belle.llm.local import preload_model as _preload

        _preload()
    else:
        logger.info(f"Provider '{provider}' has no model to preload")
