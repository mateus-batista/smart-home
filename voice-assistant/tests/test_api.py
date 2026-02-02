"""Tests for the FastAPI endpoints."""

import base64
import io
import wave
from unittest.mock import AsyncMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient


# Import app after mocking settings
@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    from belle.main import app
    return TestClient(app)


def create_wav_audio(duration_seconds: float = 0.5, sample_rate: int = 16000) -> bytes:
    """
    Create a valid WAV audio file for testing.

    Args:
        duration_seconds: Duration of the audio in seconds
        sample_rate: Sample rate in Hz

    Returns:
        WAV file as bytes
    """
    # Generate silence (zeros) as audio
    n_samples = int(duration_seconds * sample_rate)
    audio_data = np.zeros(n_samples, dtype=np.int16)

    # Write to WAV
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)  # Mono
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)
        wav.writeframes(audio_data.tobytes())

    buffer.seek(0)
    return buffer.read()


def create_wav_with_tone(
    frequency: float = 440.0,
    duration_seconds: float = 0.5,
    sample_rate: int = 16000,
    amplitude: float = 0.5,
) -> bytes:
    """
    Create a WAV audio file with a sine wave tone.

    Args:
        frequency: Tone frequency in Hz
        duration_seconds: Duration in seconds
        sample_rate: Sample rate in Hz
        amplitude: Amplitude (0-1)

    Returns:
        WAV file as bytes
    """
    t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds), endpoint=False)
    audio = (amplitude * np.sin(2 * np.pi * frequency * t) * 32767).astype(np.int16)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(audio.tobytes())

    buffer.seek(0)
    return buffer.read()


class TestHealthCheck:
    """Tests for the health check endpoint."""

    def test_health_check(self, client):
        """Should return healthy status."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data


class TestDevicesEndpoint:
    """Tests for the devices endpoint."""

    def test_list_devices_success(self, client):
        """Should list devices from the smart home API."""
        mock_devices = {
            "success": True,
            "devices": [
                {"id": "hue-1", "name": "Kitchen Light", "state": {"on": True}},
            ],
        }

        with patch("belle.main.get_all_devices", new_callable=AsyncMock) as mock:
            mock.return_value = mock_devices

            response = client.get("/devices")
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    def test_list_devices_error(self, client):
        """Should return 502 when smart home API fails."""
        with patch("belle.main.get_all_devices", new_callable=AsyncMock) as mock:
            mock.return_value = {"success": False, "error": "API unavailable"}

            response = client.get("/devices")
            assert response.status_code == 502


class TestTranscribeEndpoint:
    """Tests for the transcription endpoint."""

    def test_transcribe_success(self, client):
        """Should transcribe audio successfully."""
        audio_bytes = create_wav_audio()
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        with patch("belle.main.transcribe_audio_async", new_callable=AsyncMock) as mock:
            mock.return_value = {"text": "turn on the lights", "language": "en"}

            response = client.post(
                "/transcribe",
                json={"audio": audio_b64, "format": "wav"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["text"] == "turn on the lights"
            assert data["language"] == "en"

    def test_transcribe_with_language_hint(self, client):
        """Should pass language hint to transcription."""
        audio_bytes = create_wav_audio()
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        with patch("belle.main.transcribe_audio_async", new_callable=AsyncMock) as mock:
            mock.return_value = {"text": "acende as luzes", "language": "pt"}

            response = client.post(
                "/transcribe",
                json={"audio": audio_b64, "format": "wav", "language": "pt"},
            )

            assert response.status_code == 200
            # Verify language was passed to transcribe
            mock.assert_called_once()
            _, kwargs = mock.call_args
            assert kwargs.get("language") == "pt" or mock.call_args[0][1] == "pt"


class TestChatEndpoint:
    """Tests for the chat endpoint."""

    def test_chat_success(self, client):
        """Should process chat message and return response."""
        with patch("belle.main.chat_async", new_callable=AsyncMock) as mock:
            mock.return_value = {
                "response": "I've turned on the kitchen lights for you!",
                "actions": [
                    {
                        "tool": "control_device",
                        "result": {"success": True, "device": "Kitchen Light"},
                    }
                ],
            }

            response = client.post("/chat", json={"message": "turn on the kitchen lights"})

            assert response.status_code == 200
            data = response.json()
            assert "turned on" in data["response"].lower()
            assert len(data["actions"]) == 1
            assert data["actions"][0]["result"]["success"] is True

    def test_chat_no_action(self, client):
        """Should handle conversational messages without device actions."""
        with patch("belle.main.chat_async", new_callable=AsyncMock) as mock:
            mock.return_value = {
                "response": "Hello! I'm Belle, your smart home assistant.",
                "actions": [],
            }

            response = client.post("/chat", json={"message": "hello"})

            assert response.status_code == 200
            data = response.json()
            assert "Belle" in data["response"]
            assert data["actions"] == []

    def test_chat_with_audio(self, client):
        """Should include TTS audio when requested."""
        with (
            patch("belle.main.chat_async", new_callable=AsyncMock) as mock_chat,
            patch("belle.main.synthesize_speech_to_wav_async", new_callable=AsyncMock) as mock_tts,
            patch("belle.main.settings") as mock_settings,
        ):
            mock_settings.tts_enabled = True
            mock_chat.return_value = {"response": "Done!", "actions": []}
            mock_tts.return_value = b"fake_audio_bytes"

            response = client.post(
                "/chat",
                json={"message": "turn on lights", "include_audio": True},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["audio"] is not None


class TestVoiceEndpoint:
    """Tests for the full voice pipeline endpoint."""

    def test_voice_pipeline_success(self, client):
        """Should process voice input through full pipeline."""
        audio_bytes = create_wav_audio()
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        with (
            patch("belle.main.transcribe_audio_async", new_callable=AsyncMock) as mock_stt,
            patch("belle.main.chat_async", new_callable=AsyncMock) as mock_chat,
            patch("belle.main.settings") as mock_settings,
        ):
            mock_settings.tts_enabled = False
            mock_stt.return_value = {"text": "turn off the bedroom light", "language": "en"}
            mock_chat.return_value = {
                "response": "I've turned off the bedroom light.",
                "actions": [
                    {
                        "tool": "control_device",
                        "result": {"success": True, "device": "Bedroom Light", "action": "off"},
                    }
                ],
            }

            response = client.post("/voice", json={"audio": audio_b64, "format": "wav"})

            assert response.status_code == 200
            data = response.json()
            assert data["transcript"] == "turn off the bedroom light"
            assert "turned off" in data["response"].lower()
            assert len(data["actions"]) == 1
            assert data["actions"][0]["result"]["device"] == "Bedroom Light"

    def test_voice_pipeline_with_action(self, client):
        """Should execute device action from voice command."""
        audio_bytes = create_wav_audio()
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        with (
            patch("belle.main.transcribe_audio_async", new_callable=AsyncMock) as mock_stt,
            patch("belle.main.chat_async", new_callable=AsyncMock) as mock_chat,
            patch("belle.main.settings") as mock_settings,
        ):
            mock_settings.tts_enabled = False
            mock_stt.return_value = {"text": "set living room brightness to 50", "language": "en"}
            mock_chat.return_value = {
                "response": "I've set the living room brightness to 50%.",
                "actions": [
                    {
                        "tool": "control_room",
                        "result": {
                            "success": True,
                            "room": "Living Room",
                            "action": "brightness 50%",
                            "devices_controlled": 3,
                        },
                    }
                ],
            }

            response = client.post("/voice", json={"audio": audio_b64, "format": "wav"})

            assert response.status_code == 200
            data = response.json()

            # Verify action was executed
            actions = data["actions"]
            assert len(actions) == 1
            assert actions[0]["tool"] == "control_room"
            assert actions[0]["result"]["success"] is True
            assert actions[0]["result"]["devices_controlled"] == 3


class TestWebSocket:
    """Tests for the WebSocket endpoint."""

    def test_websocket_audio_message(self, client):
        """Should process audio via WebSocket."""
        audio_bytes = create_wav_audio()
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        with (
            patch("belle.main.transcribe_audio_async", new_callable=AsyncMock) as mock_stt,
            patch("belle.main.chat_async", new_callable=AsyncMock) as mock_chat,
            patch("belle.main.settings") as mock_settings,
        ):
            mock_settings.tts_enabled = False
            mock_stt.return_value = {"text": "turn on lights", "language": "en"}
            mock_chat.return_value = {"response": "Done!", "actions": []}

            with client.websocket_connect("/ws") as websocket:
                # Send audio message
                websocket.send_json({
                    "type": "audio",
                    "data": audio_b64,
                    "format": "wav",
                })

                # Should receive transcript first
                transcript_msg = websocket.receive_json()
                assert transcript_msg["type"] == "transcript"
                assert transcript_msg["text"] == "turn on lights"

                # Then receive full response
                response_msg = websocket.receive_json()
                assert response_msg["type"] == "response"
                assert response_msg["response"] == "Done!"

    def test_websocket_text_message(self, client):
        """Should process text via WebSocket."""
        with (
            patch("belle.main.chat_async", new_callable=AsyncMock) as mock_chat,
            patch("belle.main.settings") as mock_settings,
        ):
            mock_settings.tts_enabled = False
            mock_chat.return_value = {
                "response": "The kitchen light is on at 100% brightness.",
                "actions": [],
            }

            with client.websocket_connect("/ws") as websocket:
                # Send text message
                websocket.send_json({
                    "type": "text",
                    "message": "what's the status of the kitchen light?",
                })

                # Receive response
                response_msg = websocket.receive_json()
                assert response_msg["type"] == "response"
                assert "kitchen light" in response_msg["response"].lower()

    def test_websocket_ping_pong(self, client):
        """Should respond to ping with pong."""
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json({"type": "ping"})
            response = websocket.receive_json()
            assert response["type"] == "pong"

    def test_websocket_unknown_type(self, client):
        """Should return error for unknown message type."""
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json({"type": "unknown"})
            response = websocket.receive_json()
            assert response["type"] == "error"
            assert "unknown" in response["message"].lower()


class TestAudioDecoding:
    """Tests for audio decoding utilities."""

    def test_decode_16bit_mono_wav(self):
        """Should decode 16-bit mono WAV correctly."""
        from belle.main import _decode_audio

        audio_bytes = create_wav_audio(duration_seconds=0.1, sample_rate=16000)
        result = _decode_audio(audio_bytes, "wav")

        assert isinstance(result, np.ndarray)
        assert result.dtype == np.float32
        assert len(result) == 1600  # 0.1s * 16000Hz

    def test_decode_stereo_wav(self):
        """Should convert stereo to mono."""
        from belle.main import _decode_audio

        # Create stereo WAV
        sample_rate = 16000
        duration = 0.1
        n_samples = int(duration * sample_rate)
        left = np.zeros(n_samples, dtype=np.int16)
        right = np.ones(n_samples, dtype=np.int16) * 1000

        # Interleave for stereo
        stereo = np.empty(n_samples * 2, dtype=np.int16)
        stereo[0::2] = left
        stereo[1::2] = right

        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(2)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(stereo.tobytes())

        buffer.seek(0)
        result = _decode_audio(buffer.read(), "wav")

        # Should be mono now
        assert len(result) == n_samples

    def test_decode_resample(self):
        """Should resample to 16kHz."""
        from belle.main import _decode_audio

        # Create 44.1kHz audio
        sample_rate = 44100
        duration = 0.1
        n_samples = int(duration * sample_rate)
        audio_data = np.zeros(n_samples, dtype=np.int16)

        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(audio_data.tobytes())

        buffer.seek(0)
        result = _decode_audio(buffer.read(), "wav")

        # Should be resampled to 16kHz
        expected_samples = int(duration * 16000)
        assert abs(len(result) - expected_samples) <= 1  # Allow for rounding

    def test_unsupported_format(self):
        """Should raise error for unsupported formats."""
        from belle.main import _decode_audio

        with pytest.raises(ValueError) as exc_info:
            _decode_audio(b"fake audio data", "webm")

        assert "not directly supported" in str(exc_info.value)
