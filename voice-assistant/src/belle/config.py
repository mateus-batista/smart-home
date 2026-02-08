"""Configuration settings for Belle voice assistant."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server settings
    host: str = "0.0.0.0"
    port: int = 3002
    debug: bool = False

    # Logging settings
    log_level: str = "INFO"
    log_json: bool = False  # Set to True for structured JSON logging

    # Smart Home API
    smart_home_api_url: str = "http://localhost:3001/api"

    # Whisper STT settings
    whisper_model: str = "mlx-community/whisper-large-v3-turbo"
    whisper_language: str | None = None  # Auto-detect language (None = auto)
    whisper_initial_prompt: str | None = None  # Disabled to prevent hallucinations
    whisper_temperature: float = 0.0  # 0 = deterministic greedy decoding
    whisper_condition_on_previous: bool = False  # Disabled to prevent repetition loops
    # Anti-hallucination thresholds
    whisper_compression_ratio_threshold: float = 2.4  # Reject if text is too repetitive
    whisper_no_speech_threshold: float = 0.6  # Detect silence (higher = stricter)
    whisper_logprob_threshold: float = -1.0  # Reject low-confidence segments

    # LLM settings
    llm_provider: str = "local"  # "local" | "openai" | "anthropic"
    llm_model: str = "mlx-community/Qwen2.5-14B-Instruct-4bit"
    llm_max_tokens: int = 512
    llm_temperature: float = 0.5  # Lower temperature for more focused responses

    # Cloud LLM provider settings
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"

    # TTS settings (Parler TTS - local neural TTS, optional)
    tts_enabled: bool = False
    tts_model: str = "parler-tts/parler-tts-mini-v1"
    tts_voice_description: str = "A warm female voice speaking clearly at a moderate pace."

    # Audio settings
    sample_rate: int = 16000
    audio_channels: int = 1

    model_config = {"env_prefix": "BELLE_", "env_file": ".env"}


settings = Settings()
