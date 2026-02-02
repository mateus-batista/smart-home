"""Text-to-Speech module using Parler-TTS for Belle's voice."""

import io
import logging
import time
import wave

import numpy as np

from belle.config import settings

logger = logging.getLogger(__name__)

# Lazy-loaded model and tokenizer
_model = None
_tokenizer = None
_device = None

# Voice description for Belle - keep it short for faster processing
BELLE_VOICE_DESCRIPTION = "A warm female voice speaking clearly at a moderate pace."


def _load_model():
    """Load Parler-TTS model lazily on first use."""
    global _model, _tokenizer, _device

    if _model is not None:
        return _model, _tokenizer, _device

    if not settings.tts_enabled:
        logger.warning("TTS is disabled. Enable with BELLE_TTS_ENABLED=true")
        return None, None, None

    logger.info(f"Loading TTS model: {settings.tts_model}")

    try:
        import torch
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer

        # Determine device
        if torch.backends.mps.is_available():
            _device = "mps"
        elif torch.cuda.is_available():
            _device = "cuda"
        else:
            _device = "cpu"

        logger.info(f"Using device: {_device}")

        # Load model
        _model = ParlerTTSForConditionalGeneration.from_pretrained(
            settings.tts_model,
            torch_dtype=torch.float16 if _device in ("mps", "cuda") else torch.float32,
        ).to(_device)

        _model.eval()

        _tokenizer = AutoTokenizer.from_pretrained(settings.tts_model)

        logger.info("TTS model loaded successfully")
        return _model, _tokenizer, _device

    except ImportError as e:
        logger.error("TTS dependencies not installed")
        logger.error(f"Import error: {e}")
        return None, None, None
    except Exception as e:
        logger.error(f"Failed to load TTS model: {e}")
        return None, None, None


def synthesize_speech(
    text: str,
    voice_description: str | None = None,
) -> np.ndarray | None:
    """
    Synthesize speech from text.

    Args:
        text: The text to speak
        voice_description: Optional voice description (uses Belle's voice by default)

    Returns:
        Audio as numpy array (float32, mono) or None if TTS is disabled/unavailable
    """
    model, tokenizer, device = _load_model()

    if model is None:
        logger.warning("TTS not available, returning None")
        return None

    import torch

    start_time = time.time()

    # Use Belle's voice description by default
    description = voice_description or settings.tts_voice_description or BELLE_VOICE_DESCRIPTION

    # Tokenize inputs
    description_tokens = tokenizer(description, return_tensors="pt")
    prompt_tokens = tokenizer(text, return_tensors="pt")

    # Generate audio
    with torch.inference_mode():
        generation = model.generate(
            input_ids=description_tokens.input_ids.to(device),
            attention_mask=description_tokens.attention_mask.to(device),
            prompt_input_ids=prompt_tokens.input_ids.to(device),
            prompt_attention_mask=prompt_tokens.attention_mask.to(device),
        )

    # Convert to numpy
    audio = generation.cpu().numpy().squeeze()

    # Normalize to float32 range [-1, 1]
    if audio.dtype != np.float32:
        audio = audio.astype(np.float32)

    # Normalize if needed
    max_val = np.abs(audio).max()
    if max_val > 1.0:
        audio = audio / max_val

    elapsed = time.time() - start_time
    audio_duration = len(audio) / 44100  # Parler outputs at 44.1kHz
    logger.info(f"TTS: {len(text)} chars -> {audio_duration:.1f}s audio in {elapsed:.1f}s")

    return audio


def synthesize_speech_to_wav(
    text: str,
    voice_description: str | None = None,
    sample_rate: int = 44100,
) -> bytes | None:
    """
    Synthesize speech and return as WAV bytes.

    Args:
        text: The text to speak
        voice_description: Optional voice description
        sample_rate: Output sample rate (Parler-TTS outputs at 44100 Hz)

    Returns:
        WAV file as bytes, or None if TTS is unavailable
    """
    audio = synthesize_speech(text, voice_description)

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
    voice_description: str | None = None,
) -> np.ndarray | None:
    """Async wrapper for speech synthesis (runs in thread pool)."""
    import asyncio
    return await asyncio.to_thread(synthesize_speech, text, voice_description)


async def synthesize_speech_to_wav_async(
    text: str,
    voice_description: str | None = None,
) -> bytes | None:
    """Async wrapper for WAV synthesis (runs in thread pool)."""
    import asyncio
    return await asyncio.to_thread(synthesize_speech_to_wav, text, voice_description)


def is_tts_available() -> bool:
    """Check if TTS is enabled and available."""
    if not settings.tts_enabled:
        return False

    try:
        model, _, _ = _load_model()
        return model is not None
    except Exception:
        return False


def preload_model() -> None:
    """Pre-load the TTS model to avoid cold start latency."""
    if settings.tts_enabled:
        _load_model()
        logger.info("TTS model pre-loaded")
    else:
        logger.info("TTS is disabled, skipping pre-load")
