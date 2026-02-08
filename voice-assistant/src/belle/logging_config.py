"""Structured logging configuration for Belle."""

import contextvars
import json
import logging
import sys
import uuid
from datetime import UTC, datetime
from typing import Any

# Context variable for request tracing
_request_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)


def generate_request_id() -> str:
    """Generate a unique request ID."""
    return str(uuid.uuid4())[:8]  # Short 8-char ID for readability


def get_request_id() -> str | None:
    """Get the current request ID from context."""
    return _request_id.get()


def set_request_id(request_id: str | None = None) -> str:
    """
    Set the request ID in context.

    Args:
        request_id: Optional ID to use. If None, generates a new one.

    Returns:
        The request ID that was set.
    """
    rid = request_id or generate_request_id()
    _request_id.set(rid)
    return rid


def clear_request_id() -> None:
    """Clear the request ID from context."""
    _request_id.set(None)


class JSONFormatter(logging.Formatter):
    """
    JSON log formatter for structured logging.

    Outputs logs as JSON objects for easy parsing and aggregation.
    """

    def __init__(self, include_timestamp: bool = True):
        super().__init__()
        self.include_timestamp = include_timestamp

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data: dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if self.include_timestamp:
            log_data["timestamp"] = datetime.now(UTC).isoformat()

        # Add request ID if available (for request tracing)
        request_id = get_request_id()
        if request_id:
            log_data["request_id"] = request_id

        # Add source location
        log_data["source"] = {
            "file": record.filename,
            "line": record.lineno,
            "function": record.funcName,
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields from record
        # These can be added via logger.info("msg", extra={"key": "value"})
        standard_attrs = {
            "name", "msg", "args", "created", "filename", "funcName",
            "levelname", "levelno", "lineno", "module", "msecs",
            "pathname", "process", "processName", "relativeCreated",
            "stack_info", "exc_info", "exc_text", "thread", "threadName",
            "taskName", "message",
        }
        extras = {
            k: v for k, v in record.__dict__.items()
            if k not in standard_attrs and not k.startswith("_")
        }
        if extras:
            log_data["extra"] = extras

        return json.dumps(log_data, default=str, ensure_ascii=False)


class ContextAdapter(logging.LoggerAdapter):
    """
    Logger adapter that adds context to all log messages.

    Usage:
        logger = ContextAdapter(logging.getLogger(__name__), {"request_id": "abc123"})
        logger.info("Processing request")  # Includes request_id in extra
    """

    def process(self, msg: str, kwargs: dict) -> tuple[str, dict]:
        """Add context to log record extra dict."""
        extra = kwargs.get("extra", {})
        extra.update(self.extra)
        kwargs["extra"] = extra
        return msg, kwargs


def setup_logging(
    level: str = "INFO",
    json_output: bool = False,
    stream: Any = None,
) -> None:
    """
    Configure logging for Belle.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR)
        json_output: If True, output structured JSON logs
        stream: Output stream (defaults to stderr)
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create handler
    handler = logging.StreamHandler(stream or sys.stderr)
    handler.setLevel(getattr(logging, level.upper()))

    # Set formatter
    if json_output:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        ))

    root_logger.addHandler(handler)

    # Reduce noise from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("mlx").setLevel(logging.WARNING)


def get_logger(name: str, **context: Any) -> logging.LoggerAdapter:
    """
    Get a logger with optional context.

    Args:
        name: Logger name (typically __name__)
        **context: Context fields to include in all log messages

    Returns:
        Logger adapter with context
    """
    logger = logging.getLogger(name)
    if context:
        return ContextAdapter(logger, context)
    return ContextAdapter(logger, {})
