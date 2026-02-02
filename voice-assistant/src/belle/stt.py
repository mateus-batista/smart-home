"""Speech-to-Text module using Whisper with MLX optimization."""

import logging
from pathlib import Path
from typing import BinaryIO

import numpy as np

from belle.config import settings

logger = logging.getLogger(__name__)

# Lazy-loaded model
_model = None
_processor = None


def _load_model():
    """Load Whisper model lazily on first use."""
    global _model, _processor

    if _model is not None:
        return _model, _processor

    logger.info(f"Loading Whisper model: {settings.whisper_model}")


    # mlx_whisper handles model loading internally
    _model = settings.whisper_model
    _processor = None  # mlx_whisper doesn't need separate processor

    logger.info("Whisper model loaded successfully")
    return _model, _processor


def transcribe_audio(
    audio: np.ndarray | bytes | str | Path | BinaryIO,
    language: str | None = None,
) -> dict:
    """
    Transcribe audio to text using Whisper.

    Args:
        audio: Audio data as numpy array (float32, mono, 16kHz),
               bytes, file path, or file-like object
        language: Optional language code (e.g., 'en', 'pt').
                  If None, auto-detects language.

    Returns:
        dict with keys:
            - text: Transcribed text
            - language: Detected or specified language code
            - segments: List of transcription segments with timestamps
    """
    import mlx_whisper

    model_path, _ = _load_model()

    # Handle different input types
    if isinstance(audio, bytes):
        # Convert bytes to numpy array
        audio = np.frombuffer(audio, dtype=np.int16).astype(np.float32) / 32768.0
    elif isinstance(audio, (str, Path)):
        # mlx_whisper can handle file paths directly
        pass

    # Build transcription options with anti-hallucination settings
    options = {
        "path_or_hf_repo": model_path,
        "verbose": settings.debug,
        # Temperature for decoding (0 = deterministic greedy)
        "temperature": settings.whisper_temperature,
        # Disable to prevent repetition loops / hallucinations
        "condition_on_previous_text": settings.whisper_condition_on_previous,
        # Anti-hallucination thresholds
        "compression_ratio_threshold": settings.whisper_compression_ratio_threshold,
        "no_speech_threshold": settings.whisper_no_speech_threshold,
        "logprob_threshold": settings.whisper_logprob_threshold,
    }

    # Initial prompt (disabled by default to prevent hallucinations)
    if settings.whisper_initial_prompt:
        options["initial_prompt"] = settings.whisper_initial_prompt

    # Language can be explicitly set per-request or via config
    if language:
        options["language"] = language
    elif settings.whisper_language:
        options["language"] = settings.whisper_language
    # If no language specified, Whisper will auto-detect (helped by initial_prompt)

    logger.debug(f"Transcribing audio with options: {options}")

    # Perform transcription
    result = mlx_whisper.transcribe(audio, **options)

    return {
        "text": result.get("text", "").strip(),
        "language": result.get("language", "unknown"),
        "segments": result.get("segments", []),
    }


def transcribe_audio_file(file_path: str | Path, language: str | None = None) -> dict:
    """
    Transcribe an audio file to text.

    Args:
        file_path: Path to the audio file (WAV, MP3, etc.)
        language: Optional language code

    Returns:
        Transcription result dict
    """
    return transcribe_audio(str(file_path), language=language)


async def transcribe_audio_async(
    audio: np.ndarray | bytes,
    language: str | None = None,
) -> dict:
    """
    Async wrapper for transcription (runs in thread pool).

    Args:
        audio: Audio data
        language: Optional language code

    Returns:
        Transcription result dict
    """
    import asyncio

    return await asyncio.to_thread(transcribe_audio, audio, language)


def preload_model() -> None:
    """Pre-load the Whisper model to avoid cold start latency."""
    _load_model()
    logger.info("Whisper model pre-loaded")
