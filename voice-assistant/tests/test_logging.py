"""Tests for structured logging."""

import io
import json
import logging

import pytest

from belle.logging_config import (
    ContextAdapter,
    JSONFormatter,
    clear_request_id,
    generate_request_id,
    get_logger,
    get_request_id,
    set_request_id,
    setup_logging,
)


class TestJSONFormatter:
    """Tests for JSON log formatter."""

    def test_basic_format(self):
        """Should format log record as JSON."""
        formatter = JSONFormatter(include_timestamp=False)
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None,
        )
        output = formatter.format(record)
        data = json.loads(output)

        assert data["level"] == "INFO"
        assert data["logger"] == "test"
        assert data["message"] == "Test message"
        assert data["source"]["file"] == "test.py"
        assert data["source"]["line"] == 10

    def test_includes_timestamp(self):
        """Should include timestamp when enabled."""
        formatter = JSONFormatter(include_timestamp=True)
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None,
        )
        output = formatter.format(record)
        data = json.loads(output)

        assert "timestamp" in data

    def test_includes_extra_fields(self):
        """Should include extra fields in output."""
        formatter = JSONFormatter(include_timestamp=False)
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None,
        )
        record.request_id = "abc123"
        record.user_id = 42

        output = formatter.format(record)
        data = json.loads(output)

        assert data["extra"]["request_id"] == "abc123"
        assert data["extra"]["user_id"] == 42


class TestContextAdapter:
    """Tests for context logger adapter."""

    def test_adds_context_to_logs(self):
        """Should add context to all log records."""
        logger = logging.getLogger("test_context")
        adapter = ContextAdapter(logger, {"request_id": "xyz789"})

        # Capture log output
        handler = logging.StreamHandler(io.StringIO())
        handler.setFormatter(JSONFormatter(include_timestamp=False))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

        adapter.info("Test with context")

        output = handler.stream.getvalue()
        data = json.loads(output.strip())

        assert data["extra"]["request_id"] == "xyz789"

        # Cleanup
        logger.removeHandler(handler)


class TestSetupLogging:
    """Tests for logging setup."""

    def test_setup_json_logging(self):
        """Should configure JSON logging when enabled."""
        stream = io.StringIO()
        setup_logging(level="INFO", json_output=True, stream=stream)

        logger = logging.getLogger("test_setup")
        logger.info("JSON test message")

        output = stream.getvalue()
        # Should be valid JSON
        data = json.loads(output.strip())
        assert data["message"] == "JSON test message"

    def test_setup_text_logging(self):
        """Should configure text logging when JSON disabled."""
        stream = io.StringIO()
        setup_logging(level="INFO", json_output=False, stream=stream)

        logger = logging.getLogger("test_setup_text")
        logger.info("Text test message")

        output = stream.getvalue()
        # Should contain message but not be JSON
        assert "Text test message" in output
        with pytest.raises(json.JSONDecodeError):
            json.loads(output.strip())


class TestGetLogger:
    """Tests for get_logger helper."""

    def test_returns_adapter(self):
        """Should return a logger adapter."""
        logger = get_logger("test_helper")
        assert isinstance(logger, logging.LoggerAdapter)

    def test_includes_context(self):
        """Should include provided context."""
        logger = get_logger("test_helper_context", service="belle", version="1.0")
        assert logger.extra["service"] == "belle"
        assert logger.extra["version"] == "1.0"


class TestRequestTracing:
    """Tests for request ID tracing."""

    def test_generate_request_id(self):
        """Should generate unique 8-char IDs."""
        id1 = generate_request_id()
        id2 = generate_request_id()
        assert len(id1) == 8
        assert id1 != id2

    def test_set_and_get_request_id(self):
        """Should set and get request ID in context."""
        clear_request_id()  # Ensure clean state
        assert get_request_id() is None

        rid = set_request_id("test-123")
        assert rid == "test-123"
        assert get_request_id() == "test-123"

        clear_request_id()
        assert get_request_id() is None

    def test_set_generates_id_if_none(self):
        """Should generate ID if none provided."""
        clear_request_id()
        rid = set_request_id()
        assert rid is not None
        assert len(rid) == 8
        clear_request_id()

    def test_request_id_in_json_logs(self):
        """Request ID should appear in JSON logs."""
        stream = io.StringIO()
        setup_logging(level="INFO", json_output=True, stream=stream)

        # Set request ID and log
        set_request_id("abc12345")
        logger = logging.getLogger("test_trace")
        logger.info("Test with request ID")

        output = stream.getvalue()
        data = json.loads(output.strip())
        assert data["request_id"] == "abc12345"

        clear_request_id()

    def test_no_request_id_when_not_set(self):
        """Should not include request_id when not set."""
        stream = io.StringIO()
        setup_logging(level="INFO", json_output=True, stream=stream)

        clear_request_id()
        logger = logging.getLogger("test_no_trace")
        logger.info("Test without request ID")

        output = stream.getvalue()
        data = json.loads(output.strip())
        assert "request_id" not in data
