# Belle Voice Assistant

A bilingual (English/Portuguese) voice assistant for smart home control, inspired by Belle from Beauty and the Beast.

## Features

- **Voice Control**: Control Hue and Nanoleaf devices with natural language
- **Bilingual**: Supports both English (US) and Brazilian Portuguese
- **Local Processing**: All AI models run locally on Apple Silicon
- **Function Calling**: LLM automatically calls the right APIs based on your request

## Requirements

- macOS with Apple Silicon (M1/M2/M3/M4)
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager
- Smart Home server running on `localhost:3001`

## Installation

```bash
# Install dependencies
uv sync

# For TTS support (optional, adds ~2GB download)
uv sync --extra tts

# For wake word support (optional)
uv sync --extra wake
```

## Configuration

Create a `.env` file or set environment variables:

```env
# Server settings
BELLE_HOST=0.0.0.0
BELLE_PORT=3002

# Smart Home API
BELLE_SMART_HOME_API_URL=http://localhost:3001/api

# Model settings (optional - defaults are recommended)
BELLE_WHISPER_MODEL=mlx-community/whisper-large-v3-turbo
BELLE_LLM_MODEL=mlx-community/Qwen2.5-7B-Instruct-4bit

# Enable TTS responses (requires tts extra)
BELLE_TTS_ENABLED=false
```

## Usage

### Start the Server

```bash
uv run belle
```

Or in development mode:

```bash
uv run uvicorn belle.main:app --reload --port 3002
```

### API Endpoints

- `GET /health` - Health check
- `GET /devices` - List all available devices
- `POST /transcribe` - Transcribe audio to text
- `POST /chat` - Send text command, get response + actions
- `WS /ws` - WebSocket for real-time voice interaction

### WebSocket Protocol

Connect to `ws://localhost:3002/ws` and send:

```json
{
  "type": "audio",
  "data": "<base64-encoded-audio>"
}
```

Receive:

```json
{
  "type": "response",
  "text": "I've turned on the kitchen lights for you!",
  "audio": "<base64-encoded-audio-if-tts-enabled>",
  "actions": [
    {"device": "Kitchen Light", "action": "on"}
  ]
}
```

## Example Commands

### English
- "Belle, turn on the living room lights"
- "Belle, it's too bright in the kitchen"
- "Belle, set all lights to 50% brightness"
- "Belle, make the bedroom warm and cozy" (sets warm color temperature)

### Portuguese
- "Bela, acende as luzes da sala"
- "Bela, está muito claro na cozinha"
- "Bela, apaga todas as luzes"
- "Bela, deixa o quarto mais aconchegante"

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Web App    │────▶│  Belle API   │────▶│  Smart Home │
│  (Browser)  │◀────│  (FastAPI)   │◀────│  Server     │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Whisper  │ │ Qwen2.5  │ │  Parler  │
        │  (STT)   │ │  (LLM)   │ │  (TTS)   │
        └──────────┘ └──────────┘ └──────────┘
```

## Models Used

| Component | Model | Size |
|-----------|-------|------|
| Speech-to-Text | Whisper Large V3 Turbo | ~1.5GB |
| Language Model | Qwen2.5-7B-Instruct (4-bit) | ~4GB |
| Text-to-Speech | Parler-TTS Mini | ~2GB |

## Development

```bash
# Install with dev dependencies
uv sync --extra dev

# Run tests
uv run pytest

# Format and lint
uv run ruff format .
uv run ruff check --fix .
```

## License

MIT
