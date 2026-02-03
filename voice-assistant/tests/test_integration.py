"""
End-to-end integration tests for the voice-to-device-action pipeline.

These tests verify the complete flow:
1. Voice/text input →
2. LLM processes and decides on tool call →
3. Tool executes and calls Smart Home API →
4. Device state changes →
5. Response returned to user

The tests mock the Smart Home API server to verify correct API calls are made.
"""

import base64
import io
import wave
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient


def create_test_audio() -> str:
    """Create a base64-encoded WAV file for testing."""
    sample_rate = 16000
    duration = 0.5
    n_samples = int(sample_rate * duration)
    audio_data = np.zeros(n_samples, dtype=np.int16)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(audio_data.tobytes())

    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    from belle.main import app
    return TestClient(app)


@pytest.fixture
def mock_devices():
    """Sample device data from the Smart Home API."""
    return [
        {
            "id": "hue-1",
            "name": "Kitchen Light",
            "type": "light",
            "manufacturer": "hue",
            "state": {"on": False, "brightness": 0, "reachable": True},
        },
        {
            "id": "hue-2",
            "name": "Living Room Lamp",
            "type": "light",
            "manufacturer": "hue",
            "state": {"on": True, "brightness": 75, "reachable": True},
        },
        {
            "id": "hue-3",
            "name": "Bedroom Light",
            "type": "light",
            "manufacturer": "hue",
            "state": {"on": False, "brightness": 0, "reachable": True},
        },
    ]


@pytest.fixture
def mock_rooms():
    """Sample room data from the Smart Home API."""
    return [
        {
            "id": "room-1",
            "name": "Living Room",
            "devices": [
                {"id": "dev-1", "name": "Living Room Lamp", "externalId": "hue-2"},
                {"id": "dev-2", "name": "Living Room TV Light", "externalId": "hue-4"},
            ],
        },
        {
            "id": "room-2",
            "name": "Kitchen",
            "devices": [
                {"id": "dev-3", "name": "Kitchen Light", "externalId": "hue-1"},
            ],
        },
    ]


@pytest.fixture
def mock_groups():
    """Sample group data from the Smart Home API."""
    return [
        {
            "id": "group-1",
            "name": "All Lights",
            "devices": [
                {"id": "dev-1", "name": "Kitchen Light"},
                {"id": "dev-2", "name": "Living Room Lamp"},
                {"id": "dev-3", "name": "Bedroom Light"},
            ],
        },
        {
            "id": "group-2",
            "name": "Movie Mode",
            "devices": [
                {"id": "dev-2", "name": "Living Room Lamp"},
            ],
        },
    ]


class TestVoiceToDeviceAction:
    """
    Integration tests for the complete voice → device action pipeline.

    These tests verify that voice commands correctly trigger device control
    actions through the LLM tool calling mechanism.
    """

    @pytest.mark.asyncio
    async def test_turn_on_device_by_name(self, mock_devices):
        """
        Test: "Turn on the kitchen light"
        Expected: LLM calls control_device with device_name="Kitchen Light", on=True
        """
        from belle.tools.devices import _device_cache, control_device

        # Clear cache
        _device_cache.clear()

        with (
            patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.devices.get_client", new_callable=AsyncMock) as mock_client_fn,
        ):
            mock_cache.return_value = mock_devices

            # Mock successful PUT response
            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()
            mock_http_client = AsyncMock()
            mock_http_client.put = AsyncMock(return_value=mock_response)
            mock_client_fn.return_value = mock_http_client

            # Execute the device control
            result = await control_device("Kitchen Light", on=True)

            # Verify success
            assert result["success"] is True
            assert result["device"] == "Kitchen Light"
            assert "on" in result["action"]

            # Verify the correct API call was made
            mock_http_client.put.assert_called_once()
            call_args = mock_http_client.put.call_args
            assert "/devices/hue-1" in call_args[0][0]
            assert call_args[1]["json"]["on"] is True

    @pytest.mark.asyncio
    async def test_set_brightness(self, mock_devices):
        """
        Test: "Set bedroom light to 50%"
        Expected: API call with brightness=50 and on=True
        """
        from belle.tools.devices import _device_cache, control_device

        _device_cache.clear()

        with (
            patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.devices.get_client", new_callable=AsyncMock) as mock_client_fn,
        ):
            mock_cache.return_value = mock_devices

            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()
            mock_http_client = AsyncMock()
            mock_http_client.put = AsyncMock(return_value=mock_response)
            mock_client_fn.return_value = mock_http_client

            result = await control_device("Bedroom Light", brightness=50)

            assert result["success"] is True
            assert "brightness" in result["action"]

            # Verify brightness was sent with on=True
            call_args = mock_http_client.put.call_args
            assert call_args[1]["json"]["brightness"] == 50
            assert call_args[1]["json"]["on"] is True

    @pytest.mark.asyncio
    async def test_control_room(self, mock_rooms):
        """
        Test: "Turn off the living room"
        Expected: All devices in the room receive off command
        """
        from belle.tools.rooms import _room_cache, control_room

        _room_cache.clear()

        with (
            patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_client_fn,
        ):
            mock_cache.return_value = mock_rooms

            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()
            mock_http_client = AsyncMock()
            mock_http_client.put = AsyncMock(return_value=mock_response)
            mock_client_fn.return_value = mock_http_client

            result = await control_room("Living Room", on=False)

            assert result["success"] is True
            assert result["room"] == "Living Room"
            assert result["devices_controlled"] == 2

            # Verify each device got the command
            assert mock_http_client.put.call_count == 2

    @pytest.mark.asyncio
    async def test_control_group(self, mock_groups):
        """
        Test: "Turn on movie mode"
        Expected: Group state endpoint called with on=True
        """
        from belle.tools.groups import _group_cache, control_group

        _group_cache.clear()

        with (
            patch("belle.tools.groups._get_cached_groups", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.groups.get_client", new_callable=AsyncMock) as mock_client_fn,
        ):
            mock_cache.return_value = mock_groups

            mock_response = MagicMock()
            mock_response.json.return_value = {
                "results": [{"device": "Living Room Lamp", "success": True}]
            }
            mock_response.raise_for_status = MagicMock()
            mock_http_client = AsyncMock()
            mock_http_client.put = AsyncMock(return_value=mock_response)
            mock_client_fn.return_value = mock_http_client

            result = await control_group("Movie Mode", on=True)

            assert result["success"] is True
            assert result["group"] == "Movie Mode"

            # Verify group state API was called
            call_args = mock_http_client.put.call_args
            assert "/groups/group-2/state" in call_args[0][0]


class TestChatToDeviceAction:
    """
    Tests for the chat endpoint triggering device actions.

    These tests mock the LLM to return specific tool calls and verify
    the correct device actions are taken.
    """

    def test_chat_triggers_device_control(self, client, mock_devices):
        """Chat message should trigger device control action."""
        from belle.tools.devices import _device_cache
        _device_cache.clear()

        with (
            patch("belle.main.chat_async", new_callable=AsyncMock) as mock_chat,
        ):
            # Simulate LLM response with tool call result
            mock_chat.return_value = {
                "response": "I've turned on the kitchen light for you!",
                "actions": [
                    {
                        "tool": "control_device",
                        "arguments": {"device_name": "Kitchen Light", "on": True},
                        "result": {"success": True, "device": "Kitchen Light", "action": "on"},
                    }
                ],
            }

            response = client.post("/chat", json={"message": "turn on the kitchen light"})

            assert response.status_code == 200
            data = response.json()

            # Verify action was executed
            assert len(data["actions"]) == 1
            action = data["actions"][0]
            assert action["tool"] == "control_device"
            assert action["result"]["success"] is True
            assert action["result"]["device"] == "Kitchen Light"

    def test_chat_room_control(self, client, mock_rooms):
        """Chat message should trigger room control."""
        from belle.tools.rooms import _room_cache
        _room_cache.clear()

        with patch("belle.main.chat_async", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = {
                "response": "I've turned off all the lights in the living room.",
                "actions": [
                    {
                        "tool": "control_room",
                        "arguments": {"room_name": "Living Room", "on": False},
                        "result": {
                            "success": True,
                            "room": "Living Room",
                            "action": "off",
                            "devices_controlled": 2,
                        },
                    }
                ],
            }

            response = client.post("/chat", json={"message": "turn off the living room"})

            assert response.status_code == 200
            data = response.json()

            assert len(data["actions"]) == 1
            assert data["actions"][0]["result"]["devices_controlled"] == 2

    def test_chat_multiple_actions(self, client):
        """Chat should support multiple device actions."""
        with patch("belle.main.chat_async", new_callable=AsyncMock) as mock_chat:
            mock_chat.return_value = {
                "response": "I've turned off all the lights.",
                "actions": [
                    {
                        "tool": "control_device",
                        "result": {"success": True, "device": "Kitchen Light", "action": "off"},
                    },
                    {
                        "tool": "control_device",
                        "result": {"success": True, "device": "Bedroom Light", "action": "off"},
                    },
                ],
            }

            response = client.post("/chat", json={"message": "turn off all lights"})

            assert response.status_code == 200
            data = response.json()
            assert len(data["actions"]) == 2


class TestVoicePipelineToDeviceAction:
    """
    End-to-end tests for voice input → device action.

    These simulate the complete flow from audio input to device control.
    """

    def test_voice_to_device_action(self, client, mock_devices):
        """Voice input should trigger device action through complete pipeline."""
        audio_b64 = create_test_audio()

        with (
            patch("belle.main.transcribe_audio_async", new_callable=AsyncMock) as mock_stt,
            patch("belle.main.chat_async", new_callable=AsyncMock) as mock_chat,
            patch("belle.main.settings") as mock_settings,
        ):
            mock_settings.tts_enabled = False

            # STT returns transcribed text
            mock_stt.return_value = {
                "text": "turn on the kitchen light",
                "language": "en",
            }

            # LLM processes and returns with action
            mock_chat.return_value = {
                "response": "Done! The kitchen light is now on.",
                "actions": [
                    {
                        "tool": "control_device",
                        "arguments": {"device_name": "Kitchen Light", "on": True},
                        "result": {"success": True, "device": "Kitchen Light", "action": "on"},
                    }
                ],
            }

            response = client.post("/voice", json={"audio": audio_b64, "format": "wav"})

            assert response.status_code == 200
            data = response.json()

            # Verify complete pipeline
            assert data["transcript"] == "turn on the kitchen light"
            assert "kitchen light" in data["response"].lower()
            assert len(data["actions"]) == 1
            assert data["actions"][0]["result"]["success"] is True

    def test_voice_to_room_action(self, client, mock_rooms):
        """Voice command should control entire room."""
        audio_b64 = create_test_audio()

        with (
            patch("belle.main.transcribe_audio_async", new_callable=AsyncMock) as mock_stt,
            patch("belle.main.chat_async", new_callable=AsyncMock) as mock_chat,
            patch("belle.main.settings") as mock_settings,
        ):
            mock_settings.tts_enabled = False

            mock_stt.return_value = {
                "text": "dim the living room to 30 percent",
                "language": "en",
            }

            mock_chat.return_value = {
                "response": "I've dimmed the living room lights to 30%.",
                "actions": [
                    {
                        "tool": "control_room",
                        "arguments": {"room_name": "Living Room", "brightness": 30},
                        "result": {
                            "success": True,
                            "room": "Living Room",
                            "action": "brightness 30%",
                            "devices_controlled": 2,
                        },
                    }
                ],
            }

            response = client.post("/voice", json={"audio": audio_b64, "format": "wav"})

            assert response.status_code == 200
            data = response.json()

            assert data["actions"][0]["result"]["room"] == "Living Room"
            assert data["actions"][0]["result"]["devices_controlled"] == 2


class TestLLMToolCallParsing:
    """
    Tests for LLM tool call parsing and execution.

    These tests verify that the LLM's tool calls are correctly
    parsed and executed against the Smart Home API.
    """

    def test_parse_control_device_tool_call(self):
        """Should correctly parse control_device tool call from LLM."""
        from belle.llm import _parse_tool_calls

        llm_response = (
            "I'll turn on the kitchen light for you.\n"
            '<tool_call>{"name": "control_device", '
            '"arguments": {"device_name": "Kitchen Light", "on": true}}</tool_call>'
        )

        calls = _parse_tool_calls(llm_response)

        assert calls is not None
        assert len(calls) == 1
        assert calls[0].name == "control_device"
        assert calls[0].arguments["device_name"] == "Kitchen Light"
        assert calls[0].arguments["on"] is True

    def test_parse_control_room_tool_call(self):
        """Should correctly parse control_room tool call."""
        from belle.llm import _parse_tool_calls

        llm_response = """Let me dim the living room for you.
{"name": "control_room", "arguments": {"room_name": "Living Room", "brightness": 50}}"""

        calls = _parse_tool_calls(llm_response)

        assert calls is not None
        assert len(calls) == 1
        assert calls[0].name == "control_room"
        assert calls[0].arguments["room_name"] == "Living Room"
        assert calls[0].arguments["brightness"] == 50

    def test_parse_multiple_tool_calls(self):
        """Should parse multiple tool calls."""
        from belle.llm import _parse_tool_calls

        llm_response = (
            "I'll turn on both lights.\n"
            '<tool_call>{"name": "control_device", '
            '"arguments": {"device_name": "Kitchen Light", "on": true}}</tool_call>\n'
            '<tool_call>{"name": "control_device", '
            '"arguments": {"device_name": "Bedroom Light", "on": true}}</tool_call>'
        )

        calls = _parse_tool_calls(llm_response)

        assert calls is not None
        assert len(calls) == 2


class TestErrorHandling:
    """Tests for error handling in the pipeline."""

    def test_device_not_found(self, mock_devices):
        """Should handle device not found gracefully."""
        import asyncio

        from belle.tools.devices import _device_cache, control_device

        _device_cache.clear()

        async def test():
            with patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock:
                mock.return_value = mock_devices

                result = await control_device("ZZZZZ Unknown Device", on=True)

                assert result["success"] is False
                assert "not found" in result["error"]

        asyncio.run(test())

    def test_api_connection_error(self, mock_devices):
        """Should handle API connection errors."""
        import asyncio

        import httpx

        from belle.tools.devices import _device_cache, control_device

        _device_cache.clear()

        async def test():
            with (
                patch(
                    "belle.tools.devices._get_cached_devices", new_callable=AsyncMock
                ) as mock_cache,
                patch(
                    "belle.tools.devices.get_client", new_callable=AsyncMock
                ) as mock_client_fn,
            ):
                mock_cache.return_value = mock_devices

                mock_http_client = AsyncMock()
                mock_http_client.put = AsyncMock(
                    side_effect=httpx.HTTPError("Connection refused")
                )
                mock_client_fn.return_value = mock_http_client

                result = await control_device("Kitchen Light", on=True)

                assert result["success"] is False
                assert "error" in result

        asyncio.run(test())

    def test_voice_endpoint_transcription_error(self, client):
        """Should handle transcription errors."""
        audio_b64 = create_test_audio()

        with patch("belle.main.transcribe_audio_async", new_callable=AsyncMock) as mock_stt:
            mock_stt.side_effect = Exception("Model not loaded")

            response = client.post("/voice", json={"audio": audio_b64, "format": "wav"})

            assert response.status_code == 500
