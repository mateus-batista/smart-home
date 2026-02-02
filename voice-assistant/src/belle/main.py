"""FastAPI server for Belle voice assistant."""

import asyncio
import base64
import io
import json
import logging
import wave
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from belle import __version__
from belle.config import settings
from belle.http import close_client
from belle.llm import chat_async
from belle.llm import preload_model as preload_llm
from belle.stt import preload_model as preload_stt
from belle.stt import transcribe_audio_async
from belle.tools import get_all_devices
from belle.tts import is_tts_available, synthesize_speech_to_wav_async
from belle.tts import preload_model as preload_tts

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - preload models on startup, cleanup on shutdown."""
    logger.info("Starting Belle voice assistant...")
    logger.info(f"Version: {__version__}")
    logger.info(f"Smart Home API: {settings.smart_home_api_url}")

    # Preload models in background to speed up first request
    # Note: This is optional - models will load lazily on first use
    if not settings.debug:
        logger.info("Pre-loading models (this may take a moment)...")
        await asyncio.to_thread(preload_stt)
        await asyncio.to_thread(preload_llm)
        if settings.tts_enabled:
            await asyncio.to_thread(preload_tts)
        logger.info("Models pre-loaded successfully")

    yield

    # Cleanup
    logger.info("Shutting down Belle voice assistant...")
    await close_client()


app = FastAPI(
    title="Belle Voice Assistant",
    description="A bilingual voice assistant for smart home control",
    version=__version__,
    lifespan=lifespan,
)

# Enable CORS for web app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your web app origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class TranscribeRequest(BaseModel):
    """Request to transcribe audio."""

    audio: str  # Base64-encoded audio
    format: str = "wav"  # Audio format (wav, webm, etc.)
    language: str | None = None  # Optional language hint


class TranscribeResponse(BaseModel):
    """Transcription response."""

    text: str
    language: str


class ChatRequest(BaseModel):
    """Request to chat with Belle."""

    message: str
    include_audio: bool = False  # Whether to include TTS audio in response


class ChatResponse(BaseModel):
    """Chat response from Belle."""

    response: str
    audio: str | None = None  # Base64-encoded audio if TTS enabled
    actions: list[dict[str, Any]] = []  # Actions taken


class VoiceRequest(BaseModel):
    """Request for full voice interaction (STT + LLM + TTS)."""

    audio: str  # Base64-encoded audio
    format: str = "wav"
    language: str | None = None


class VoiceResponse(BaseModel):
    """Response from voice interaction."""

    transcript: str
    response: str
    audio: str | None = None
    actions: list[dict[str, Any]] = []


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": __version__,
        "tts_enabled": settings.tts_enabled,
        "tts_available": is_tts_available() if settings.tts_enabled else False,
    }


# Device list endpoint (for debugging/testing)
@app.get("/devices")
async def list_devices():
    """List all available devices."""
    result = await get_all_devices()
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=result.get("error", "Failed to fetch devices"))
    return result


# Transcription endpoint
@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(request: TranscribeRequest):
    """Transcribe audio to text."""
    try:
        # Decode base64 audio
        audio_bytes = base64.b64decode(request.audio)

        # Convert to numpy array
        audio_array = _decode_audio(audio_bytes, request.format)

        # Transcribe
        result = await transcribe_audio_async(audio_array, request.language)

        return TranscribeResponse(
            text=result["text"],
            language=result["language"],
        )
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Chat endpoint (text only)
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """Chat with Belle using text."""
    try:
        result = await chat_async(request.message)

        audio_b64 = None
        if request.include_audio and settings.tts_enabled:
            audio_bytes = await synthesize_speech_to_wav_async(result["response"])
            if audio_bytes:
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        return ChatResponse(
            response=result["response"],
            audio=audio_b64,
            actions=result.get("actions", []),
        )
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Full voice interaction endpoint
@app.post("/voice", response_model=VoiceResponse)
async def voice_endpoint(request: VoiceRequest):
    """Full voice interaction: STT -> LLM -> TTS."""
    try:
        # Decode and transcribe audio
        audio_bytes = base64.b64decode(request.audio)
        audio_array = _decode_audio(audio_bytes, request.format)
        transcription = await transcribe_audio_async(audio_array, request.language)

        logger.info(f"Transcribed: {transcription['text']}")

        # Chat with LLM
        chat_result = await chat_async(transcription["text"])

        logger.info(f"Response: {chat_result['response']}")

        # Generate TTS if enabled
        audio_b64 = None
        if settings.tts_enabled:
            audio_bytes = await synthesize_speech_to_wav_async(chat_result["response"])
            if audio_bytes:
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        return VoiceResponse(
            transcript=transcription["text"],
            response=chat_result["response"],
            audio=audio_b64,
            actions=chat_result.get("actions", []),
        )
    except Exception as e:
        logger.error(f"Voice interaction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket endpoint for real-time interaction
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time voice interaction.

    Protocol:
    - Client sends: {"type": "audio", "data": "<base64>", "format": "wav"}
    - Server sends: {"type": "response", "transcript": "...", "response": "...", "audio": "<base64>", "actions": [...]}
    - Server sends: {"type": "error", "message": "..."}
    - Client sends: {"type": "text", "message": "..."} for text-only chat
    """
    await websocket.accept()
    logger.info("WebSocket client connected")

    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            message = json.loads(data)

            msg_type = message.get("type")

            if msg_type == "audio":
                # Voice interaction
                try:
                    audio_bytes = base64.b64decode(message.get("data", ""))
                    audio_format = message.get("format", "wav")
                    language = message.get("language")

                    # Decode audio
                    audio_array = _decode_audio(audio_bytes, audio_format)

                    # Transcribe
                    transcription = await transcribe_audio_async(audio_array, language)
                    logger.info(f"WS Transcribed: {transcription['text']}")

                    # Send transcription immediately
                    await websocket.send_json({
                        "type": "transcript",
                        "text": transcription["text"],
                        "language": transcription["language"],
                    })

                    # Process with LLM
                    chat_result = await chat_async(transcription["text"])
                    logger.info(f"WS Response: {chat_result['response']}")

                    # Generate TTS
                    audio_b64 = None
                    if settings.tts_enabled:
                        audio_bytes = await synthesize_speech_to_wav_async(chat_result["response"])
                        if audio_bytes:
                            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

                    # Send full response
                    await websocket.send_json({
                        "type": "response",
                        "transcript": transcription["text"],
                        "response": chat_result["response"],
                        "audio": audio_b64,
                        "actions": chat_result.get("actions", []),
                    })

                except Exception as e:
                    logger.error(f"WS audio processing error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": str(e),
                    })

            elif msg_type == "text":
                # Text-only chat
                try:
                    text = message.get("message", "")
                    include_audio = message.get("include_audio", False)

                    chat_result = await chat_async(text)

                    audio_b64 = None
                    if include_audio and settings.tts_enabled:
                        audio_bytes = await synthesize_speech_to_wav_async(chat_result["response"])
                        if audio_bytes:
                            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

                    await websocket.send_json({
                        "type": "response",
                        "transcript": text,
                        "response": chat_result["response"],
                        "audio": audio_b64,
                        "actions": chat_result.get("actions", []),
                    })

                except Exception as e:
                    logger.error(f"WS text processing error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": str(e),
                    })

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}",
                })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


def _decode_audio(audio_bytes: bytes, format: str) -> np.ndarray:
    """
    Decode audio bytes to numpy array.

    Args:
        audio_bytes: Raw audio bytes
        format: Audio format (wav, webm, etc.)

    Returns:
        Audio as numpy array (float32, mono, resampled to 16kHz)
    """
    if format.lower() == "wav":
        # Parse WAV file
        with wave.open(io.BytesIO(audio_bytes), "rb") as wav:
            sample_rate = wav.getframerate()
            n_channels = wav.getnchannels()
            sample_width = wav.getsampwidth()
            frames = wav.readframes(wav.getnframes())

        # Convert to numpy
        if sample_width == 2:
            audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
        elif sample_width == 4:
            audio = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / 2147483648.0
        else:
            audio = np.frombuffer(frames, dtype=np.uint8).astype(np.float32) / 128.0 - 1.0

        # Convert stereo to mono
        if n_channels == 2:
            audio = audio.reshape(-1, 2).mean(axis=1)

        # Resample to 16kHz if needed
        if sample_rate != 16000:
            audio = _resample(audio, sample_rate, 16000)

        return audio

    elif format.lower() in ("webm", "ogg", "mp3", "m4a"):
        # For other formats, we'd need ffmpeg or similar
        # For MVP, recommend using WAV from the browser
        raise ValueError(
            f"Format '{format}' not directly supported. "
            "Please convert to WAV in the browser using Web Audio API."
        )

    else:
        # Assume raw PCM int16 at 16kHz
        audio = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        return audio


def _resample(audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    """Simple linear interpolation resampling."""
    if orig_sr == target_sr:
        return audio

    # Calculate ratio and new length
    ratio = target_sr / orig_sr
    new_length = int(len(audio) * ratio)

    # Create new indices
    indices = np.linspace(0, len(audio) - 1, new_length)

    # Interpolate
    return np.interp(indices, np.arange(len(audio)), audio)


def main():
    """Entry point for the application."""
    import uvicorn

    logger.info(f"Starting Belle on {settings.host}:{settings.port}")
    uvicorn.run(
        "belle.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info",
    )


if __name__ == "__main__":
    main()
