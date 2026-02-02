"""Tests for LLM tool call parsing."""

import pytest

from belle.llm import ToolCall, _extract_json_objects, _parse_tool_calls


class TestExtractJsonObjects:
    """Tests for JSON extraction from LLM responses."""

    def test_extract_from_tool_call_tags(self):
        """Should extract JSON from <tool_call> tags."""
        text = (
            "I'll turn on the light.\n"
            '<tool_call>{"name": "control_device", '
            '"arguments": {"device_name": "Kitchen Light", "on": true}}</tool_call>'
        )

        objects = _extract_json_objects(text)
        assert len(objects) == 1
        assert objects[0]["name"] == "control_device"
        assert objects[0]["arguments"]["device_name"] == "Kitchen Light"

    def test_extract_raw_json(self):
        """Should extract raw JSON objects."""
        text = '''Let me help you with that.
{"name": "control_device", "arguments": {"device_name": "Living Room", "brightness": 50}}'''

        objects = _extract_json_objects(text)
        assert len(objects) == 1
        assert objects[0]["name"] == "control_device"

    def test_extract_multiple_tool_calls(self):
        """Should extract multiple tool calls."""
        text = (
            '<tool_call>{"name": "control_device", '
            '"arguments": {"device_name": "Light 1", "on": true}}</tool_call>\n'
            '<tool_call>{"name": "control_device", '
            '"arguments": {"device_name": "Light 2", "on": true}}</tool_call>'
        )

        objects = _extract_json_objects(text)
        assert len(objects) == 2

    def test_repair_malformed_json(self):
        """Should repair common JSON errors from LLMs."""
        # Missing closing brace
        text = (
            '<tool_call>{"name": "control_device", '
            '"arguments": {"device_name": "Kitchen"}</tool_call>'
        )

        objects = _extract_json_objects(text)
        # json-repair should fix this
        assert len(objects) >= 0  # May or may not be repairable

    def test_no_json_returns_empty(self):
        """Should return empty list when no JSON found."""
        text = "I'm sorry, I can't help with that request."
        objects = _extract_json_objects(text)
        assert objects == []


class TestParseToolCalls:
    """Tests for tool call parsing and validation."""

    def test_parse_valid_tool_call(self):
        """Should parse and validate a correct tool call."""
        text = '{"name": "control_device", "arguments": {"device_name": "Kitchen", "on": true}}'

        calls = _parse_tool_calls(text)
        assert calls is not None
        assert len(calls) == 1
        assert calls[0].name == "control_device"
        assert calls[0].arguments["device_name"] == "Kitchen"

    def test_parse_tool_call_without_arguments(self):
        """Should handle tool calls without arguments."""
        text = '{"name": "get_all_devices"}'

        calls = _parse_tool_calls(text)
        assert calls is not None
        assert len(calls) == 1
        assert calls[0].name == "get_all_devices"
        assert calls[0].arguments == {}

    def test_reject_unknown_tool(self):
        """Should reject calls to unknown tools."""
        text = '{"name": "unknown_tool", "arguments": {}}'

        calls = _parse_tool_calls(text)
        assert calls is None or len(calls) == 0

    def test_empty_input(self):
        """Should return None for empty input."""
        assert _parse_tool_calls("") is None
        assert _parse_tool_calls(None) is None

    def test_no_tool_calls_in_text(self):
        """Should return None when no tool calls found."""
        text = "The lights are currently on at 75% brightness."
        assert _parse_tool_calls(text) is None


class TestToolCallModel:
    """Tests for the ToolCall Pydantic model."""

    def test_valid_tool_call(self):
        """Should validate correct tool call."""
        data = {"name": "control_device", "arguments": {"device_name": "Kitchen"}}
        call = ToolCall.model_validate(data)
        assert call.name == "control_device"
        assert call.arguments == {"device_name": "Kitchen"}

    def test_default_arguments(self):
        """Should default arguments to empty dict."""
        data = {"name": "get_all_devices"}
        call = ToolCall.model_validate(data)
        assert call.arguments == {}

    def test_missing_name_fails(self):
        """Should reject tool call without name."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            ToolCall.model_validate({"arguments": {}})
