"""
Audio utilities for testing the voice assistant.

This module provides functions to create test audio files and utilities
for working with audio data in tests.
"""

import base64
import io
import wave
from pathlib import Path

import numpy as np


def create_silence_wav(
    duration_seconds: float = 1.0,
    sample_rate: int = 16000,
) -> bytes:
    """
    Create a WAV file containing silence.

    Args:
        duration_seconds: Duration in seconds
        sample_rate: Sample rate in Hz (default 16000 for Whisper)

    Returns:
        WAV file as bytes
    """
    n_samples = int(duration_seconds * sample_rate)
    audio_data = np.zeros(n_samples, dtype=np.int16)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)  # Mono
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)
        wav.writeframes(audio_data.tobytes())

    buffer.seek(0)
    return buffer.read()


def create_tone_wav(
    frequency: float = 440.0,
    duration_seconds: float = 1.0,
    sample_rate: int = 16000,
    amplitude: float = 0.5,
) -> bytes:
    """
    Create a WAV file containing a sine wave tone.

    Args:
        frequency: Tone frequency in Hz
        duration_seconds: Duration in seconds
        sample_rate: Sample rate in Hz
        amplitude: Amplitude (0.0 to 1.0)

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


def create_white_noise_wav(
    duration_seconds: float = 1.0,
    sample_rate: int = 16000,
    amplitude: float = 0.1,
) -> bytes:
    """
    Create a WAV file containing white noise.

    Args:
        duration_seconds: Duration in seconds
        sample_rate: Sample rate in Hz
        amplitude: Noise amplitude (0.0 to 1.0)

    Returns:
        WAV file as bytes
    """
    n_samples = int(duration_seconds * sample_rate)
    noise = np.random.uniform(-1, 1, n_samples) * amplitude
    audio = (noise * 32767).astype(np.int16)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(audio.tobytes())

    buffer.seek(0)
    return buffer.read()


def create_stereo_wav(
    duration_seconds: float = 1.0,
    sample_rate: int = 16000,
    left_freq: float = 440.0,
    right_freq: float = 880.0,
) -> bytes:
    """
    Create a stereo WAV file with different tones in each channel.

    Args:
        duration_seconds: Duration in seconds
        sample_rate: Sample rate in Hz
        left_freq: Frequency for left channel
        right_freq: Frequency for right channel

    Returns:
        WAV file as bytes
    """
    n_samples = int(duration_seconds * sample_rate)
    t = np.linspace(0, duration_seconds, n_samples, endpoint=False)

    left = (0.5 * np.sin(2 * np.pi * left_freq * t) * 32767).astype(np.int16)
    right = (0.5 * np.sin(2 * np.pi * right_freq * t) * 32767).astype(np.int16)

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
    return buffer.read()


def wav_to_base64(wav_bytes: bytes) -> str:
    """
    Convert WAV bytes to base64 string.

    Args:
        wav_bytes: WAV file as bytes

    Returns:
        Base64-encoded string
    """
    return base64.b64encode(wav_bytes).decode("utf-8")


def base64_to_wav(b64_string: str) -> bytes:
    """
    Convert base64 string to WAV bytes.

    Args:
        b64_string: Base64-encoded WAV data

    Returns:
        WAV file as bytes
    """
    return base64.b64decode(b64_string)


def save_wav(wav_bytes: bytes, filepath: str | Path) -> None:
    """
    Save WAV bytes to a file.

    Args:
        wav_bytes: WAV file as bytes
        filepath: Path to save the file
    """
    Path(filepath).write_bytes(wav_bytes)


def load_wav(filepath: str | Path) -> bytes:
    """
    Load WAV file from disk.

    Args:
        filepath: Path to the WAV file

    Returns:
        WAV file as bytes
    """
    return Path(filepath).read_bytes()


def get_wav_info(wav_bytes: bytes) -> dict:
    """
    Get information about a WAV file.

    Args:
        wav_bytes: WAV file as bytes

    Returns:
        dict with sample_rate, channels, duration_seconds, sample_width
    """
    buffer = io.BytesIO(wav_bytes)
    with wave.open(buffer, "rb") as wav:
        return {
            "sample_rate": wav.getframerate(),
            "channels": wav.getnchannels(),
            "sample_width": wav.getsampwidth(),
            "n_frames": wav.getnframes(),
            "duration_seconds": wav.getnframes() / wav.getframerate(),
        }


def wav_to_numpy(wav_bytes: bytes) -> tuple[np.ndarray, int]:
    """
    Convert WAV bytes to numpy array.

    Args:
        wav_bytes: WAV file as bytes

    Returns:
        Tuple of (audio_array, sample_rate)
    """
    buffer = io.BytesIO(wav_bytes)
    with wave.open(buffer, "rb") as wav:
        sample_rate = wav.getframerate()
        n_channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        frames = wav.readframes(wav.getnframes())

    # Convert to numpy based on sample width
    if sample_width == 2:
        audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    elif sample_width == 4:
        audio = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        audio = np.frombuffer(frames, dtype=np.uint8).astype(np.float32) / 128.0 - 1.0

    # Convert stereo to mono if needed
    if n_channels == 2:
        audio = audio.reshape(-1, 2).mean(axis=1)

    return audio, sample_rate


def numpy_to_wav(
    audio: np.ndarray,
    sample_rate: int = 16000,
) -> bytes:
    """
    Convert numpy array to WAV bytes.

    Args:
        audio: Audio data as float32 numpy array (-1.0 to 1.0)
        sample_rate: Sample rate in Hz

    Returns:
        WAV file as bytes
    """
    # Ensure float32 and clip
    audio = np.clip(audio.astype(np.float32), -1.0, 1.0)

    # Convert to int16
    audio_int16 = (audio * 32767).astype(np.int16)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(audio_int16.tobytes())

    buffer.seek(0)
    return buffer.read()


# Pre-made test fixtures
class TestAudioFixtures:
    """Collection of pre-made audio fixtures for testing."""

    @staticmethod
    def silence_100ms() -> bytes:
        """100ms of silence."""
        return create_silence_wav(duration_seconds=0.1)

    @staticmethod
    def silence_500ms() -> bytes:
        """500ms of silence."""
        return create_silence_wav(duration_seconds=0.5)

    @staticmethod
    def silence_1s() -> bytes:
        """1 second of silence."""
        return create_silence_wav(duration_seconds=1.0)

    @staticmethod
    def tone_440hz_500ms() -> bytes:
        """500ms A4 tone (440Hz)."""
        return create_tone_wav(frequency=440.0, duration_seconds=0.5)

    @staticmethod
    def tone_1khz_100ms() -> bytes:
        """100ms 1kHz tone."""
        return create_tone_wav(frequency=1000.0, duration_seconds=0.1)

    @staticmethod
    def white_noise_500ms() -> bytes:
        """500ms of white noise."""
        return create_white_noise_wav(duration_seconds=0.5)

    @staticmethod
    def stereo_test() -> bytes:
        """Stereo test audio."""
        return create_stereo_wav(duration_seconds=0.5)


# Pytest fixtures
def pytest_fixture_silence() -> str:
    """Pytest fixture for silence audio (base64)."""
    return wav_to_base64(create_silence_wav(duration_seconds=0.5))


def pytest_fixture_tone() -> str:
    """Pytest fixture for tone audio (base64)."""
    return wav_to_base64(create_tone_wav(duration_seconds=0.5))
