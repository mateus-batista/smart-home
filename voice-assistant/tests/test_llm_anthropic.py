"""Tests for the Anthropic LLM provider."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from belle.llm.anthropic import _convert_tools_for_anthropic, chat_async


class TestConvertTools:
    """Tests for tool format conversion from OpenAI to Anthropic format."""

    def test_converts_to_anthropic_format(self):
        """Should convert from OpenAI format to Anthropic format."""
        tools = _convert_tools_for_anthropic()
        assert isinstance(tools, list)
        assert len(tools) > 0
        for tool in tools:
            # Anthropic format: flat dict with name, description, input_schema
            assert "name" in tool
            assert "description" in tool
            assert "input_schema" in tool
            # Should NOT have OpenAI's nested structure
            assert "type" not in tool
            assert "function" not in tool

    def test_input_schema_has_properties(self):
        """Tool input schemas should have properties and type."""
        tools = _convert_tools_for_anthropic()
        for tool in tools:
            schema = tool["input_schema"]
            assert schema["type"] == "object"
            assert "properties" in schema


class TestChatAsync:
    """Tests for the Anthropic chat_async function."""

    @pytest.fixture
    def mock_anthropic_response_text(self):
        """Create a mock Anthropic text-only response."""
        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "The kitchen light is on at 75% brightness."

        response = MagicMock()
        response.stop_reason = "end_turn"
        response.content = [text_block]
        return response

    @pytest.fixture
    def mock_anthropic_response_tool_call(self):
        """Create a mock Anthropic response with tool use."""
        tool_block = MagicMock()
        tool_block.type = "tool_use"
        tool_block.id = "toolu_123"
        tool_block.name = "control_device"
        tool_block.input = {"device_name": "Kitchen Light", "on": True}

        response = MagicMock()
        response.stop_reason = "tool_use"
        response.content = [tool_block]
        return response

    @pytest.fixture
    def mock_anthropic_followup_response(self):
        """Create a mock Anthropic follow-up response."""
        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "Done! Kitchen Light is now on."

        response = MagicMock()
        response.stop_reason = "end_turn"
        response.content = [text_block]
        return response

    @patch("belle.llm.anthropic.build_system_prompt_with_context")
    @patch("belle.llm.anthropic._get_client")
    async def test_text_only_response(
        self, mock_get_client, mock_build_prompt, mock_anthropic_response_text
    ):
        """Should handle text-only responses correctly."""
        mock_build_prompt.return_value = "system prompt"
        mock_client = AsyncMock()
        mock_client.messages.create.return_value = mock_anthropic_response_text
        mock_get_client.return_value = mock_client

        result = await chat_async("What lights are on?")

        assert result["response"] == "The kitchen light is on at 75% brightness."
        assert result["tool_calls"] == []
        assert result["tool_results"] == []
        assert result["actions"] == []

    @patch("belle.llm.anthropic.execute_tool_calls")
    @patch("belle.llm.anthropic.build_system_prompt_with_context")
    @patch("belle.llm.anthropic._get_client")
    async def test_tool_call_response(
        self,
        mock_get_client,
        mock_build_prompt,
        mock_execute,
        mock_anthropic_response_tool_call,
        mock_anthropic_followup_response,
    ):
        """Should handle tool use responses correctly."""
        mock_build_prompt.return_value = "system prompt"
        mock_client = AsyncMock()
        mock_client.messages.create.side_effect = [
            mock_anthropic_response_tool_call,
            mock_anthropic_followup_response,
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

    @patch("belle.llm.anthropic.build_system_prompt_with_context")
    @patch("belle.llm.anthropic._get_client")
    async def test_system_prompt_passed_separately(
        self, mock_get_client, mock_build_prompt, mock_anthropic_response_text
    ):
        """Anthropic system prompt should be passed as separate parameter, not in messages."""
        mock_build_prompt.return_value = "my system prompt"
        mock_client = AsyncMock()
        mock_client.messages.create.return_value = mock_anthropic_response_text
        mock_get_client.return_value = mock_client

        await chat_async("Hello")

        call_args = mock_client.messages.create.call_args
        # System prompt passed as separate kwarg
        assert call_args.kwargs["system"] == "my system prompt"
        # Messages should NOT contain a system message
        messages = call_args.kwargs["messages"]
        for msg in messages:
            assert msg["role"] != "system"

    @patch("belle.llm.anthropic.build_system_prompt_with_context")
    @patch("belle.llm.anthropic._get_client")
    async def test_conversation_history_included(
        self, mock_get_client, mock_build_prompt, mock_anthropic_response_text
    ):
        """Should include conversation history in messages."""
        mock_build_prompt.return_value = "system prompt"
        mock_client = AsyncMock()
        mock_client.messages.create.return_value = mock_anthropic_response_text
        mock_get_client.return_value = mock_client

        history = [
            {"role": "user", "content": "Turn on lights"},
            {"role": "assistant", "content": "Done!"},
        ]

        await chat_async("What's on?", conversation_history=history)

        call_args = mock_client.messages.create.call_args
        messages = call_args.kwargs["messages"]
        # 2 history + 1 user (no system in messages for Anthropic)
        assert len(messages) == 3
        assert messages[0]["role"] == "user"
        assert messages[1]["role"] == "assistant"
        assert messages[2]["role"] == "user"
        assert messages[2]["content"] == "What's on?"

    @patch("belle.llm.anthropic._get_client")
    async def test_missing_api_key_raises(self, mock_get_client):
        """Should raise ValueError when API key is missing."""
        mock_get_client.side_effect = ValueError(
            "BELLE_ANTHROPIC_API_KEY is required when using the Anthropic provider"
        )

        with pytest.raises(ValueError, match="BELLE_ANTHROPIC_API_KEY"):
            await chat_async("Hello")

    @patch("belle.llm.anthropic.execute_tool_calls")
    @patch("belle.llm.anthropic.build_system_prompt_with_context")
    @patch("belle.llm.anthropic._get_client")
    async def test_followup_merges_user_messages(
        self,
        mock_get_client,
        mock_build_prompt,
        mock_execute,
        mock_anthropic_response_tool_call,
        mock_anthropic_followup_response,
    ):
        """Should merge tool_result and followup instruction to avoid consecutive user messages."""
        mock_build_prompt.return_value = "system prompt"
        mock_client = AsyncMock()
        mock_client.messages.create.side_effect = [
            mock_anthropic_response_tool_call,
            mock_anthropic_followup_response,
        ]
        mock_get_client.return_value = mock_client

        mock_execute.return_value = [
            {
                "tool": "control_device",
                "arguments": {"device_name": "Kitchen Light", "on": True},
                "result": {"success": True, "device": "Kitchen Light", "action": "turned on"},
            }
        ]

        await chat_async("Turn on kitchen light")

        # Check the follow-up call's messages
        followup_call = mock_client.messages.create.call_args_list[1]
        messages = followup_call.kwargs["messages"]

        # Verify no consecutive user messages
        for i in range(len(messages) - 1):
            if messages[i]["role"] == "user" and messages[i + 1]["role"] == "user":
                pytest.fail(f"Found consecutive user messages at index {i} and {i + 1}")
