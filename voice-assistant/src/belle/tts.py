"""Text-to-Speech module using Kokoro-82M via mlx-audio for Belle's voice."""

import io
import logging
import time
import wave

import numpy as np

from belle.config import settings
from belle.mlx_lock import mlx_lock

logger = logging.getLogger(__name__)

# Lazy-loaded pipeline
_pipeline = None

# Kokoro sample rate
KOKORO_SAMPLE_RATE = 24000


def _load_model():
    """Load Kokoro TTS pipeline lazily on first use."""
    global _pipeline

    if _pipeline is not None:
        return _pipeline

    if not settings.tts_enabled:
        logger.warning("TTS is disabled. Enable with BELLE_TTS_ENABLED=true")
        return None

    logger.info(f"Loading TTS model: {settings.tts_model}")

    try:
        from mlx_audio.tts.utils import load_model

        model = load_model(settings.tts_model)

        from mlx_audio.tts.models.kokoro.pipeline import KokoroPipeline

        _pipeline = KokoroPipeline(
            model=model, repo_id=settings.tts_model, lang_code="a"
        )

        logger.info("TTS model loaded successfully")
        return _pipeline

    except ImportError as e:
        logger.error("TTS dependencies not installed")
        logger.error(f"Import error: {e}")
        return None
    except Exception as e:
        logger.error(f"Failed to load TTS model: {e}")
        return None


def synthesize_speech(
    text: str,
    voice: str | None = None,
) -> np.ndarray | None:
    """
    Synthesize speech from text.

    Args:
        text: The text to speak
        voice: Optional Kokoro voice ID (e.g. 'af_heart', 'am_adam')

    Returns:
        Audio as numpy array (float32, mono) or None if TTS is disabled/unavailable
    """
    pipeline = _load_model()

    if pipeline is None:
        logger.warning("TTS not available, returning None")
        return None

    start_time = time.time()

    voice_id = voice or settings.tts_voice
    speed = settings.tts_speed

    # Generate audio — Kokoro returns a generator of Result(graphemes, phonemes, audio)
    # audio chunks are mx.array, convert to numpy
    # Hold the MLX lock to prevent Metal command buffer conflicts
    chunks = []
    with mlx_lock:
        for result in pipeline(text, voice=voice_id, speed=speed):
            if result.audio is not None:
                chunk = np.array(result.audio, dtype=np.float32).squeeze()
                chunks.append(chunk)

    if not chunks:
        logger.warning("TTS produced no audio chunks")
        return None

    # Concatenate all chunks into a single array
    audio = np.concatenate(chunks)

    # Normalize to [-1, 1]
    max_val = np.abs(audio).max()
    if max_val > 1.0:
        audio = audio / max_val

    elapsed = time.time() - start_time
    audio_duration = len(audio) / KOKORO_SAMPLE_RATE
    logger.info(f"TTS: {len(text)} chars -> {audio_duration:.1f}s audio in {elapsed:.1f}s")

    return audio


def synthesize_speech_to_wav(
    text: str,
    voice: str | None = None,
    sample_rate: int = KOKORO_SAMPLE_RATE,
) -> bytes | None:
    """
    Synthesize speech and return as WAV bytes.

    Args:
        text: The text to speak
        voice: Optional Kokoro voice ID
        sample_rate: Output sample rate (Kokoro outputs at 24000 Hz)

    Returns:
        WAV file as bytes, or None if TTS is unavailable
    """
    audio = synthesize_speech(text, voice)

    if audio is None:
        return None

    # Convert to 16-bit PCM
    audio_int16 = (audio * 32767).astype(np.int16)

    # Create WAV file in memory
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_int16.tobytes())

    return buffer.getvalue()


async def synthesize_speech_async(
    text: str,
    voice: str | None = None,
) -> np.ndarray | None:
    """Async wrapper for speech synthesis (runs in thread pool)."""
    import asyncio
    return await asyncio.to_thread(synthesize_speech, text, voice)


async def synthesize_speech_to_wav_async(
    text: str,
    voice: str | None = None,
) -> bytes | None:
    """Async wrapper for WAV synthesis (runs in thread pool)."""
    import asyncio
    return await asyncio.to_thread(synthesize_speech_to_wav, text, voice)


def is_tts_available() -> bool:
    """Check if TTS is enabled and available."""
    if not settings.tts_enabled:
        return False

    try:
        pipeline = _load_model()
        return pipeline is not None
    except Exception:
        return False


def preload_model() -> None:
    """Pre-load the TTS model to avoid cold start latency."""
    if settings.tts_enabled:
        _load_model()
        logger.info("TTS model pre-loaded")
    else:
        logger.info("TTS is disabled, skipping pre-load")
