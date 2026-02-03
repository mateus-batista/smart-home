# Belle Voice Assistant

A bilingual (English/Portuguese) voice assistant for smart home control, inspired by Belle from Beauty and the Beast.

## Features

- **Voice Control**: Control Hue, Nanoleaf, and SwitchBot devices with natural language
- **Bilingual**: Supports both English (US) and Brazilian Portuguese
- **Local Processing**: All AI models run locally on Apple Silicon using MLX
- **Function Calling**: LLM automatically calls the right APIs based on your request
- **Multi-Turn Conversations**: Context-aware follow-ups ("turn it off", "make it brighter")
- **Smart Caching**: Faster responses with adaptive cache that refreshes after changes
- **Fuzzy Matching**: Finds devices even with typos ("Kichen Light" → "Kitchen Light")
- **Audio Auto-Detection**: Supports WAV, WebM, MP3, OGG, M4A, FLAC without explicit format
- **Device Help**: Ask "what can I do with X?" to learn device capabilities
- **Resilient**: Automatic retries, circuit breaker, and request deduplication

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
BELLE_DEBUG=false

# Logging
BELLE_LOG_LEVEL=INFO          # DEBUG, INFO, WARNING, ERROR
BELLE_LOG_JSON=false          # Set to true for structured JSON logs

# Smart Home API
BELLE_SMART_HOME_API_URL=http://localhost:3001/api

# Model settings (optional - defaults are recommended)
BELLE_WHISPER_MODEL=mlx-community/whisper-large-v3-mlx
BELLE_LLM_MODEL=mlx-community/Qwen2.5-14B-Instruct-4bit

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
- `POST /voice` - Full voice pipeline (STT + LLM + TTS)
- `WS /ws` - WebSocket for real-time voice interaction

### Multi-Turn Conversations

Pass a `session_id` to maintain conversation context:

```json
// First request
{"message": "What's on in the kitchen?", "session_id": "user-123"}
// Response: "The kitchen light is on at 75%"

// Follow-up (same session_id)
{"message": "Turn it off", "session_id": "user-123"}
// Response: "Done! I turned off the kitchen light"
```

WebSocket connections automatically maintain conversation history per connection.

### WebSocket Protocol

Connect to `ws://localhost:3002/ws` and send:

```json
{
  "type": "audio",
  "data": "<base64-encoded-audio>",
  "format": "wav"
}
```

Audio format is auto-detected if not specified. Supported: WAV, WebM, OGG, MP3, M4A, FLAC.

Receive transcript immediately:

```json
{
  "type": "transcript",
  "text": "Turn on the kitchen lights",
  "language": "en"
}
```

Then receive full response:

```json
{
  "type": "response",
  "transcript": "Turn on the kitchen lights",
  "response": "I've turned on the kitchen lights for you!",
  "audio": "<base64-encoded-audio-if-tts-enabled>",
  "actions": [
    {"device": "Kitchen Light", "action": "on", "success": true}
  ]
}
```

Additional WebSocket messages:
- `{"type": "text", "message": "..."}` - Text-only chat
- `{"type": "clear_history"}` - Clear conversation history
- `{"type": "ping"}` - Keep-alive (responds with `{"type": "pong"}`)

## Example Commands

### English
- "Turn on the living room lights"
- "It's too bright in the kitchen"
- "Set all lights to 50% brightness"
- "Make the bedroom warm and cozy" (sets warm color temperature)
- "Close the blinds"
- "What can I do with the kitchen light?" (device help)

### Portuguese
- "Acende as luzes da sala"
- "Está muito claro na cozinha"
- "Apaga todas as luzes"
- "Deixa o quarto mais aconchegante"
- "Fecha as persianas"
- "O que posso fazer com a luz da cozinha?"

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
| Speech-to-Text | Whisper Large V3 MLX | ~3GB |
| Language Model | Qwen2.5-14B-Instruct (4-bit) | ~8GB |
| Text-to-Speech | Parler-TTS Mini (optional) | ~2GB |

All models run locally on Apple Silicon using MLX optimization.

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
