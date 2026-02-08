"""Tests for the OpenAI LLM provider."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from belle.llm.openai import _convert_tools_for_openai, chat_async


class TestConvertTools:
    """Tests for tool format conversion."""

    def test_tools_already_in_openai_format(self):
        """Tools should pass through as-is since they're already in OpenAI format."""
        tools = _convert_tools_for_openai()
        assert isinstance(tools, list)
        assert len(tools) > 0
        # Verify structure
        for tool in tools:
            assert tool["type"] == "function"
            assert "function" in tool
            assert "name" in tool["function"]
            assert "description" in tool["function"]
            assert "parameters" in tool["function"]


class TestChatAsync:
    """Tests for the OpenAI chat_async function."""

    @pytest.fixture
    def mock_openai_response_text(self):
        """Create a mock OpenAI text-only response."""
        message = MagicMock()
        message.content = "The kitchen light is on at 75% brightness."
        message.tool_calls = None

        choice = MagicMock()
        choice.finish_reason = "stop"
        choice.message = message

        response = MagicMock()
        response.choices = [choice]
        return response

    @pytest.fixture
    def mock_openai_response_tool_call(self):
        """Create a mock OpenAI response with tool calls."""
        tool_call = MagicMock()
        tool_call.id = "call_123"
        tool_call.function.name = "control_device"
        tool_call.function.arguments = json.dumps({"device_name": "Kitchen Light", "on": True})

        message = MagicMock()
        message.content = None
        message.tool_calls = [tool_call]
        message.model_dump.return_value = {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": "call_123",
                    "type": "function",
                    "function": {
                        "name": "control_device",
                        "arguments": json.dumps({"device_name": "Kitchen Light", "on": True}),
                    },
                }
            ],
        }

        choice = MagicMock()
        choice.finish_reason = "tool_calls"
        choice.message = message

        response = MagicMock()
        response.choices = [choice]
        return response

    @pytest.fixture
    def mock_openai_followup_response(self):
        """Create a mock OpenAI follow-up response."""
        message = MagicMock()
        message.content = "Done! Kitchen Light is now on."
        message.tool_calls = None

        choice = MagicMock()
        choice.finish_reason = "stop"
        choice.message = message

        response = MagicMock()
        response.choices = [choice]
        return response

    @patch("belle.llm.openai.build_system_prompt_with_context")
    @patch("belle.llm.openai._get_client")
    async def test_text_only_response(
        self, mock_get_client, mock_build_prompt, mock_openai_response_text
    ):
        """Should handle text-only responses correctly."""
        mock_build_prompt.return_value = "system prompt"
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = mock_openai_response_text
        mock_get_client.return_value = mock_client

        result = await chat_async("What lights are on?")

        assert result["response"] == "The kitchen light is on at 75% brightness."
        assert result["tool_calls"] == []
        assert result["tool_results"] == []
        assert result["actions"] == []

    @patch("belle.llm.openai.execute_tool_calls")
    @patch("belle.llm.openai.build_system_prompt_with_context")
    @patch("belle.llm.openai._get_client")
    async def test_tool_call_response(
        self,
        mock_get_client,
        mock_build_prompt,
        mock_execute,
        mock_openai_response_tool_call,
        mock_openai_followup_response,
    ):
        """Should handle tool call responses correctly."""
        mock_build_prompt.return_value = "system prompt"
        mock_client = AsyncMock()
        mock_client.chat.completions.create.side_effect = [
            mock_openai_response_tool_call,
            mock_openai_followup_response,
        ]
        mock_get_client.return_value = mock_client

        mock_execute.return_value = [
            {
                "tool": "control_device",
                "arguments": {"device_name": "Kitchen Light", "on": True},
                "result": {
                    "success": True,
                    "device": "Kitchen Light",
                    "action": "turned on",
                },
            }
        ]

        result = await chat_async("Turn on the kitchen light")

        assert result["response"] == "Done! Kitchen Light is now on."
        assert len(result["tool_calls"]) == 1
        assert result["tool_calls"][0]["name"] == "control_device"
        assert len(result["tool_results"]) == 1
        assert result["actions"][0]["device"] == "Kitchen Light"
        assert result["actions"][0]["success"] is True

    @patch("belle.llm.openai.build_system_prompt_with_context")
    @patch("belle.llm.openai._get_client")
    async def test_conversation_history_included(
        self, mock_get_client, mock_build_prompt, mock_openai_response_text
    ):
        """Should include conversation history in messages."""
        mock_build_prompt.return_value = "system prompt"
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = mock_openai_response_text
        mock_get_client.return_value = mock_client

        history = [
            {"role": "user", "content": "Turn on lights"},
            {"role": "assistant", "content": "Done!"},
        ]

        await chat_async("What's on?", conversation_history=history)

        call_args = mock_client.chat.completions.create.call_args
        messages = call_args.kwargs["messages"]
        # system + 2 history + 1 user
        assert len(messages) == 4
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        assert messages[2]["role"] == "assistant"
        assert messages[3]["role"] == "user"
        assert messages[3]["content"] == "What's on?"

    @patch("belle.llm.openai._get_client")
    async def test_missing_api_key_raises(self, mock_get_client):
        """Should raise ValueError when API key is missing."""
        mock_get_client.side_effect = ValueError(
            "BELLE_OPENAI_API_KEY is required when using the OpenAI provider"
        )

        with pytest.raises(ValueError, match="BELLE_OPENAI_API_KEY"):
            await chat_async("Hello")
