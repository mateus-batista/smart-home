"""FastAPI server for Belle voice assistant."""

import asyncio
import base64
import io
import json
import wave
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from belle import __version__
from belle.config import settings
from belle.conversation import get_conversation_manager
from belle.http import close_client
from belle.llm import chat_async
from belle.llm import preload_model as preload_llm
from belle.logging_config import clear_request_id, get_logger, set_request_id, setup_logging
from belle.stt import is_valid_speech, transcribe_audio_async
from belle.stt import preload_model as preload_stt
from belle.tools import get_all_devices
from belle.tts import is_tts_available, synthesize_speech_to_wav_async
from belle.tts import preload_model as preload_tts

# Configure logging with optional JSON output
setup_logging(
    level="DEBUG" if settings.debug else settings.log_level,
    json_output=settings.log_json,
)
logger = get_logger(__name__)


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
    session_id: str | None = None  # Optional session ID for multi-turn conversations


class ChatResponse(BaseModel):
    """Chat response from Belle."""

    response: str
    audio: str | None = None  # Base64-encoded audio if TTS enabled
    actions: list[dict[str, Any]] = []  # Actions taken
    session_id: str | None = None  # Session ID if using multi-turn


class VoiceRequest(BaseModel):
    """Request for full voice interaction (STT + LLM + TTS)."""

    audio: str  # Base64-encoded audio
    format: str = "wav"
    language: str | None = None
    session_id: str | None = None  # Optional session ID for multi-turn conversations


class VoiceResponse(BaseModel):
    """Response from voice interaction."""

    transcript: str
    response: str
    audio: str | None = None
    actions: list[dict[str, Any]] = []
    session_id: str | None = None  # Session ID if using multi-turn


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
    request_id = set_request_id()
    logger.info(f"[{request_id}] Transcribe request received")
    try:
        # Decode base64 audio
        audio_bytes = base64.b64decode(request.audio)

        # Convert to numpy array
        audio_array = _decode_audio(audio_bytes, request.format)

        # Transcribe
        result = await transcribe_audio_async(audio_array, request.language)

        logger.info(f"[{request_id}] Transcription complete: {result['text'][:50]}...")
        return TranscribeResponse(
            text=result["text"],
            language=result["language"],
        )
    except Exception as e:
        logger.error(f"[{request_id}] Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        clear_request_id()


# Chat endpoint (text only)
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """Chat with Belle using text."""
    request_id = set_request_id()
    logger.info(f"[{request_id}] Chat request: {request.message[:50]}...")
    try:
        # Get conversation history if session_id provided
        conversation_history = None
        if request.session_id:
            conversation_manager = get_conversation_manager()
            conversation_history = conversation_manager.get_history(request.session_id)
            logger.info(f"[{request_id}] Using session {request.session_id} with {len(conversation_history)} history messages")

        result = await chat_async(request.message, conversation_history)

        # Store exchange in session history
        if request.session_id:
            conversation_manager.add_exchange(
                request.session_id,
                request.message,
                result["response"],
            )

        audio_b64 = None
        if request.include_audio and settings.tts_enabled:
            audio_bytes = await synthesize_speech_to_wav_async(result["response"])
            if audio_bytes:
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        logger.info(f"[{request_id}] Chat response: {result['response'][:50]}...")
        return ChatResponse(
            response=result["response"],
            audio=audio_b64,
            actions=result.get("actions", []),
            session_id=request.session_id,
        )
    except Exception as e:
        logger.error(f"[{request_id}] Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        clear_request_id()


# Full voice interaction endpoint
@app.post("/voice", response_model=VoiceResponse)
async def voice_endpoint(request: VoiceRequest):
    """Full voice interaction: STT -> LLM -> TTS."""
    request_id = set_request_id()
    logger.info(f"[{request_id}] Voice request received")
    try:
        # Decode and transcribe audio
        audio_bytes = base64.b64decode(request.audio)
        audio_array = _decode_audio(audio_bytes, request.format)
        transcription = await transcribe_audio_async(audio_array, request.language)

        logger.info(f"[{request_id}] STT: {transcription['text']}")

        # Filter out non-speech audio
        if not is_valid_speech(transcription):
            logger.info(f"[{request_id}] No valid speech detected, skipping LLM")
            return VoiceResponse(transcript="", response="", actions=[])

        # Get conversation history if session_id provided
        conversation_history = None
        if request.session_id:
            conversation_manager = get_conversation_manager()
            conversation_history = conversation_manager.get_history(request.session_id)
            logger.info(f"[{request_id}] Using session {request.session_id} with {len(conversation_history)} history messages")

        # Chat with LLM
        chat_result = await chat_async(transcription["text"], conversation_history)

        # Store exchange in session history
        if request.session_id:
            conversation_manager.add_exchange(
                request.session_id,
                transcription["text"],
                chat_result["response"],
            )

        logger.info(f"[{request_id}] LLM: {chat_result['response'][:50]}...")

        # Generate TTS if enabled
        audio_b64 = None
        if settings.tts_enabled:
            logger.info(f"[{request_id}] Generating TTS...")
            audio_bytes = await synthesize_speech_to_wav_async(chat_result["response"])
            if audio_bytes:
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        logger.info(f"[{request_id}] Voice pipeline complete")
        return VoiceResponse(
            transcript=transcription["text"],
            response=chat_result["response"],
            audio=audio_b64,
            actions=chat_result.get("actions", []),
            session_id=request.session_id,
        )
    except Exception as e:
        logger.error(f"[{request_id}] Voice interaction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        clear_request_id()


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
    - Client sends: {"type": "clear_history"} to clear conversation history

    Multi-turn conversations are enabled by default for WebSocket connections.
    Each WebSocket connection maintains its own conversation history.
    """
    await websocket.accept()

    # Generate unique session ID for this WebSocket connection
    session_id = f"ws-{id(websocket)}"
    conversation_manager = get_conversation_manager()
    logger.info(f"WebSocket client connected (session: {session_id})")

    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            message = json.loads(data)

            msg_type = message.get("type")

            if msg_type == "clear_history":
                # Clear conversation history
                conversation_manager.clear_session(session_id)
                await websocket.send_json({
                    "type": "history_cleared",
                    "message": "Conversation history cleared",
                })
                continue

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
                    logger.info(f"WS [{session_id}] STT: {transcription['text']}")

                    # Filter out non-speech audio
                    if not is_valid_speech(transcription):
                        logger.info(f"WS [{session_id}] No speech detected, skipping")
                        await websocket.send_json({"type": "no_speech"})
                        continue

                    # Send transcription immediately
                    await websocket.send_json({
                        "type": "transcript",
                        "text": transcription["text"],
                        "language": transcription["language"],
                    })

                    # Get conversation history and process with LLM
                    conversation_history = conversation_manager.get_history(session_id)
                    chat_result = await chat_async(transcription["text"], conversation_history)
                    logger.info(f"WS [{session_id}] LLM: {chat_result['response'][:50]}...")

                    # Store exchange in history
                    conversation_manager.add_exchange(
                        session_id,
                        transcription["text"],
                        chat_result["response"],
                    )

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

                    logger.info(f"WS [{session_id}] Text: {text[:50]}...")

                    # Get conversation history and process with LLM
                    conversation_history = conversation_manager.get_history(session_id)
                    chat_result = await chat_async(text, conversation_history)
                    logger.info(f"WS [{session_id}] LLM: {chat_result['response'][:50]}...")

                    # Store exchange in history
                    conversation_manager.add_exchange(
                        session_id,
                        text,
                        chat_result["response"],
                    )

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
                    logger.error(f"WS [{session_id}] text processing error: {e}")
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
        logger.info(f"WebSocket client disconnected (session: {session_id})")
        # Clean up conversation history for this session
        conversation_manager.remove_session(session_id)
    except Exception as e:
        logger.error(f"WebSocket error (session: {session_id}): {e}")
        # Clean up on error too
        conversation_manager.remove_session(session_id)


def _detect_audio_format(audio_bytes: bytes) -> str | None:
    """
    Detect audio format from magic bytes.

    Returns:
        Detected format string or None if unknown
    """
    if len(audio_bytes) < 12:
        return None

    # WAV: "RIFF" + size + "WAVE"
    if audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        return "wav"

    # OGG (including WebM audio): "OggS"
    if audio_bytes[:4] == b"OggS":
        return "ogg"

    # WebM/Matroska: 0x1A 0x45 0xDF 0xA3
    if audio_bytes[:4] == b"\x1a\x45\xdf\xa3":
        return "webm"

    # MP3: Frame sync (0xFF 0xFB, 0xFF 0xFA, 0xFF 0xF3, 0xFF 0xF2) or ID3 tag
    if audio_bytes[:3] == b"ID3" or (audio_bytes[0] == 0xFF and (audio_bytes[1] & 0xE0) == 0xE0):
        return "mp3"

    # M4A/AAC: "ftyp" at offset 4
    if len(audio_bytes) >= 8 and audio_bytes[4:8] == b"ftyp":
        return "m4a"

    # FLAC: "fLaC"
    if audio_bytes[:4] == b"fLaC":
        return "flac"

    return None


def _decode_audio(audio_bytes: bytes, format: str | None = None) -> np.ndarray:
    """
    Decode audio bytes to numpy array.

    Args:
        audio_bytes: Raw audio bytes
        format: Audio format (wav, webm, etc.) or None for auto-detection

    Returns:
        Audio as numpy array (float32, mono, resampled to 16kHz)
    """
    # Auto-detect format if not specified or set to "auto"
    if not format or format.lower() == "auto":
        detected = _detect_audio_format(audio_bytes)
        if detected:
            logger.debug(f"Auto-detected audio format: {detected}")
            format = detected
        else:
            # Fall back to assuming raw PCM
            logger.warning("Could not detect audio format, assuming raw PCM")
            format = "raw"

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
