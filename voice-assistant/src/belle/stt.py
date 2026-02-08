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

    # Calculate confidence metrics from segments
    segments = result.get("segments", [])
    confidence = _calculate_confidence(segments)

    return {
        "text": result.get("text", "").strip(),
        "language": result.get("language", "unknown"),
        "segments": segments,
        "confidence": confidence,
    }


def _calculate_confidence(segments: list[dict]) -> dict:
    """
    Calculate confidence metrics from transcription segments.

    Returns:
        dict with:
            - avg_logprob: Average log probability (higher = more confident, typically -0.5 to 0)
            - no_speech_prob: Average probability of no speech (lower = more confident)
            - confidence_score: Normalized 0-1 score (higher = better)
            - quality: "high", "medium", or "low" quality label
    """
    if not segments:
        return {
            "avg_logprob": 0.0,
            "no_speech_prob": 0.0,
            "confidence_score": 0.0,
            "quality": "low",
        }

    # Extract metrics from segments
    logprobs = [s.get("avg_logprob", -1.0) for s in segments if "avg_logprob" in s]
    no_speech_probs = [s.get("no_speech_prob", 0.5) for s in segments if "no_speech_prob" in s]

    avg_logprob = sum(logprobs) / len(logprobs) if logprobs else -1.0
    avg_no_speech = sum(no_speech_probs) / len(no_speech_probs) if no_speech_probs else 0.5

    # Normalize to 0-1 score
    # avg_logprob typically ranges from -1.0 (low confidence) to 0 (high confidence)
    # Convert to 0-1 where 1 is best
    logprob_score = max(0.0, min(1.0, (avg_logprob + 1.0)))

    # no_speech_prob: 0 = definitely speech, 1 = definitely not speech
    # Invert so 1 = confident it's speech
    speech_score = 1.0 - avg_no_speech

    # Combined confidence score (weighted average)
    confidence_score = 0.7 * logprob_score + 0.3 * speech_score

    # Quality label
    if confidence_score >= 0.7:
        quality = "high"
    elif confidence_score >= 0.4:
        quality = "medium"
    else:
        quality = "low"

    return {
        "avg_logprob": round(avg_logprob, 3),
        "no_speech_prob": round(avg_no_speech, 3),
        "confidence_score": round(confidence_score, 3),
        "quality": quality,
    }


def is_valid_speech(transcription: dict) -> bool:
    """Check if transcription contains actual speech worth processing."""
    text = transcription.get("text", "").strip()
    confidence = transcription.get("confidence", {})

    # No text at all
    if not text:
        return False

    # High no-speech probability — likely silence/noise
    if confidence.get("no_speech_prob", 0) > 0.5:
        return False

    # Very low confidence — likely hallucination
    if confidence.get("confidence_score", 0) < 0.3:
        return False

    # Too short to be meaningful (single character, noise artifacts)
    if len(text) < 2:
        return False

    return True


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
