"""Shared HTTP client with connection pooling for Belle."""

import asyncio
import logging
import random
from contextlib import asynccontextmanager
from functools import wraps
from typing import Any, Callable, TypeVar

import httpx

from belle.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T")


# Circuit breaker states
class CircuitState:
    CLOSED = "closed"  # Normal operation
    OPEN = "open"      # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker pattern for preventing cascading failures.

    When a service fails repeatedly, the circuit "opens" and fails fast
    instead of waiting for timeouts. After a cooldown period, it allows
    a test request through (half-open state).
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 1,
    ):
        """
        Args:
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before trying again (half-open)
            half_open_max_calls: Max test calls allowed in half-open state
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time: float = 0
        self._half_open_calls = 0

    @property
    def state(self) -> str:
        """Get current circuit state, checking for recovery timeout."""
        import time

        if self._state == CircuitState.OPEN:
            if time.time() - self._last_failure_time >= self.recovery_timeout:
                logger.info("Circuit breaker entering half-open state")
                self._state = CircuitState.HALF_OPEN
                self._half_open_calls = 0

        return self._state

    def is_available(self) -> bool:
        """Check if requests should be allowed through."""
        state = self.state  # Triggers timeout check

        if state == CircuitState.CLOSED:
            return True
        if state == CircuitState.HALF_OPEN:
            return self._half_open_calls < self.half_open_max_calls
        return False  # OPEN

    def record_success(self) -> None:
        """Record a successful request."""
        if self._state == CircuitState.HALF_OPEN:
            logger.info("Circuit breaker closing after successful test")
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._half_open_calls = 0

    def record_failure(self) -> None:
        """Record a failed request."""
        import time

        self._failure_count += 1
        self._last_failure_time = time.time()

        if self._state == CircuitState.HALF_OPEN:
            logger.warning("Circuit breaker re-opening after failed test")
            self._state = CircuitState.OPEN
        elif self._failure_count >= self.failure_threshold:
            logger.warning(
                f"Circuit breaker opening after {self._failure_count} failures"
            )
            self._state = CircuitState.OPEN

    def reset(self) -> None:
        """Reset circuit breaker to initial state."""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0
        self._half_open_calls = 0


class CircuitBreakerOpen(Exception):
    """Raised when circuit breaker is open and requests are blocked."""

    def __init__(self, message: str = "Circuit breaker is open"):
        super().__init__(message)


# Shared circuit breaker for Smart Home API
_api_circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=30.0,
)


def get_circuit_breaker() -> CircuitBreaker:
    """Get the shared circuit breaker instance."""
    return _api_circuit_breaker


# Retry configuration
DEFAULT_MAX_RETRIES = 3
DEFAULT_BASE_DELAY = 0.5  # seconds
DEFAULT_MAX_DELAY = 10.0  # seconds
DEFAULT_EXPONENTIAL_BASE = 2

# Status codes that should trigger a retry
RETRYABLE_STATUS_CODES = {500, 502, 503, 504, 429}


def is_retryable_error(error: Exception) -> bool:
    """Check if an error should trigger a retry."""
    if isinstance(error, httpx.HTTPStatusError):
        return error.response.status_code in RETRYABLE_STATUS_CODES
    # Retry on connection/timeout errors
    if isinstance(error, (httpx.ConnectError, httpx.TimeoutException, httpx.ReadError)):
        return True
    return False


def calculate_backoff(
    attempt: int,
    base_delay: float = DEFAULT_BASE_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
    exponential_base: float = DEFAULT_EXPONENTIAL_BASE,
) -> float:
    """Calculate delay with exponential backoff and jitter."""
    delay = min(base_delay * (exponential_base ** attempt), max_delay)
    # Add jitter (±25%) to prevent thundering herd
    jitter = delay * 0.25 * (2 * random.random() - 1)
    return delay + jitter


def with_retry(
    max_retries: int = DEFAULT_MAX_RETRIES,
    base_delay: float = DEFAULT_BASE_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
    circuit_breaker: CircuitBreaker | None = None,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator for async functions to add retry logic with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries in seconds
        circuit_breaker: Optional circuit breaker to use

    Example:
        @with_retry(max_retries=3)
        async def fetch_data():
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            # Check circuit breaker
            cb = circuit_breaker
            if cb and not cb.is_available():
                raise CircuitBreakerOpen(
                    f"Circuit breaker is open for {func.__name__}"
                )

            last_error: Exception | None = None

            for attempt in range(max_retries + 1):
                try:
                    result = await func(*args, **kwargs)
                    # Record success with circuit breaker
                    if cb:
                        cb.record_success()
                    return result
                except Exception as e:
                    last_error = e

                    # Record failure with circuit breaker
                    if cb and is_retryable_error(e):
                        cb.record_failure()

                    if not is_retryable_error(e):
                        # Non-retryable error, raise immediately
                        raise

                    if attempt < max_retries:
                        delay = calculate_backoff(attempt, base_delay, max_delay)
                        logger.warning(
                            f"Retry {attempt + 1}/{max_retries} for {func.__name__} "
                            f"after {delay:.2f}s due to: {e}"
                        )
                        await asyncio.sleep(delay)
                    else:
                        logger.error(
                            f"All {max_retries} retries failed for {func.__name__}: {e}"
                        )

            # Should not reach here, but raise last error if we do
            if last_error:
                raise last_error
            raise RuntimeError("Unexpected retry loop exit")

        return wrapper
    return decorator

# Shared HTTP client instance
_client: httpx.AsyncClient | None = None


async def get_client() -> httpx.AsyncClient:
    """
    Get the shared HTTP client instance.
    
    Creates a new client if one doesn't exist. The client uses connection
    pooling for better performance with multiple requests.
    """
    global _client

    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=settings.smart_home_api_url,
            timeout=httpx.Timeout(10.0, connect=5.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        )
        logger.debug(f"Created HTTP client for {settings.smart_home_api_url}")

    return _client


async def close_client() -> None:
    """Close the shared HTTP client."""
    global _client

    if _client is not None and not _client.is_closed:
        await _client.aclose()
        _client = None
        logger.debug("Closed HTTP client")


@asynccontextmanager
async def get_client_context():
    """
    Context manager for HTTP client (for use in tests or standalone scripts).
    
    For normal application use, prefer get_client() directly as the client
    is managed by the application lifecycle.
    """
    client = await get_client()
    try:
        yield client
    finally:
        pass  # Don't close - let application lifecycle manage it


# Request deduplication
class RequestDeduplicator:
    """
    Prevents duplicate requests within a time window.

    Useful for preventing accidental double-taps or repeated commands.
    """

    def __init__(self, window_ms: float = 500.0):
        """
        Args:
            window_ms: Time window in milliseconds for deduplication
        """
        self.window_ms = window_ms
        self._recent: dict[str, float] = {}

    def _cleanup_expired(self) -> None:
        """Remove expired entries."""
        import time
        now = time.time() * 1000  # Convert to ms
        expired = [k for k, v in self._recent.items() if (now - v) > self.window_ms]
        for k in expired:
            del self._recent[k]

    def is_duplicate(self, request_key: str) -> bool:
        """
        Check if a request is a duplicate of a recent request.

        Args:
            request_key: Unique key identifying the request (e.g., hash of tool+args)

        Returns:
            True if this is a duplicate, False if it's a new request
        """
        import time
        self._cleanup_expired()

        now = time.time() * 1000
        if request_key in self._recent:
            age_ms = now - self._recent[request_key]
            if age_ms < self.window_ms:
                logger.debug(f"Duplicate request detected: {request_key} (age: {age_ms:.0f}ms)")
                return True

        # Mark this request as seen
        self._recent[request_key] = now
        return False

    def clear(self) -> None:
        """Clear all tracked requests."""
        self._recent.clear()

    def make_key(self, *args: Any, **kwargs: Any) -> str:
        """Create a deduplication key from arguments."""
        import hashlib
        import json
        content = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
        return hashlib.md5(content.encode()).hexdigest()


# Shared deduplicator instance for tool calls
_tool_deduplicator = RequestDeduplicator(window_ms=500.0)


def get_tool_deduplicator() -> RequestDeduplicator:
    """Get the shared tool deduplicator instance."""
    return _tool_deduplicator


# Cache utilities
class Cache:
    """Simple TTL cache for API responses."""

    def __init__(self, ttl: float = 30.0):
        self.ttl = ttl
        self._data: Any = None
        self._timestamp: float = 0

    def get(self) -> Any | None:
        """Get cached data if not expired."""
        import time

        if self._data is None:
            return None

        if (time.time() - self._timestamp) > self.ttl:
            return None

        return self._data

    def set(self, data: Any) -> None:
        """Set cache data."""
        import time

        self._data = data
        self._timestamp = time.time()

    def clear(self) -> None:
        """Clear the cache."""
        self._data = None
        self._timestamp = 0


class SmartCache:
    """
    Cache with adaptive TTL based on activity.

    - Shorter TTL after recent modifications (data likely changing)
    - Longer TTL when idle (data likely stable)
    """

    def __init__(
        self,
        base_ttl: float = 30.0,
        short_ttl: float = 5.0,
        activity_window: float = 60.0,
    ):
        """
        Args:
            base_ttl: Normal TTL when idle
            short_ttl: Shorter TTL after recent activity
            activity_window: How long to use short TTL after modification
        """
        self.base_ttl = base_ttl
        self.short_ttl = short_ttl
        self.activity_window = activity_window

        self._data: Any = None
        self._timestamp: float = 0
        self._last_modification: float = 0

    def _get_effective_ttl(self) -> float:
        """Get current TTL based on recent activity."""
        import time
        if self._last_modification > 0:
            time_since_mod = time.time() - self._last_modification
            if time_since_mod < self.activity_window:
                return self.short_ttl
        return self.base_ttl

    def get(self) -> Any | None:
        """Get cached data if not expired."""
        import time

        if self._data is None:
            return None

        effective_ttl = self._get_effective_ttl()
        if (time.time() - self._timestamp) > effective_ttl:
            return None

        return self._data

    def set(self, data: Any) -> None:
        """Set cache data."""
        import time
        self._data = data
        self._timestamp = time.time()

    def clear(self) -> None:
        """Clear the cache (typically after a modification)."""
        import time
        self._data = None
        self._timestamp = 0
        # Record modification time to use shorter TTL
        self._last_modification = time.time()

    def invalidate_only(self) -> None:
        """Invalidate cache without recording as modification."""
        self._data = None
        self._timestamp = 0


def normalize_name(name: str) -> str:
    """Normalize a name for comparison (lowercase, strip, collapse spaces)."""
    import re
    return re.sub(r'\s+', ' ', name.lower().strip())


def find_by_name(items: list[dict], name: str, name_field: str = "name") -> dict | None:
    """
    Find an item by name with case-insensitive matching.

    Tries exact match first, then partial match, then ID match, then fuzzy match.

    Args:
        items: List of dicts to search
        name: Name to search for
        name_field: Field name containing the item name

    Returns:
        Matching item or None
    """
    from difflib import SequenceMatcher

    name_normalized = normalize_name(name)

    # First try exact match (normalized)
    for item in items:
        if normalize_name(item.get(name_field, "")) == name_normalized:
            return item

    # Then try partial match (name contains search or search contains name)
    for item in items:
        item_normalized = normalize_name(item.get(name_field, ""))
        if name_normalized in item_normalized or item_normalized in name_normalized:
            return item

    # Try matching by ID
    for item in items:
        if normalize_name(item.get("id", "")) == name_normalized:
            return item

    # Try fuzzy matching (threshold 0.6 = 60% similarity)
    best_match = None
    best_ratio = 0.6  # Minimum threshold

    for item in items:
        item_name = normalize_name(item.get(name_field, ""))
        ratio = SequenceMatcher(None, name_normalized, item_name).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = item

    if best_match:
        logger.debug(f"Fuzzy matched '{name}' to '{best_match.get(name_field)}' (similarity: {best_ratio:.0%})")
        return best_match

    return None


def get_close_matches_for_name(
    items: list[dict],
    name: str,
    name_field: str = "name",
    n: int = 3,
    cutoff: float = 0.4
) -> list[str]:
    """
    Get close matches for a name from a list of items.

    Args:
        items: List of dicts to search
        name: Name to find matches for
        name_field: Field name containing the item name
        n: Maximum number of matches to return
        cutoff: Minimum similarity ratio (0-1)

    Returns:
        List of similar names, sorted by similarity
    """
    from difflib import SequenceMatcher

    name_normalized = normalize_name(name)
    matches = []

    for item in items:
        item_name = item.get(name_field, "")
        item_normalized = normalize_name(item_name)
        ratio = SequenceMatcher(None, name_normalized, item_normalized).ratio()
        if ratio >= cutoff:
            matches.append((item_name, ratio))

    # Sort by similarity (highest first) and return names
    matches.sort(key=lambda x: x[1], reverse=True)
    return [m[0] for m in matches[:n]]
