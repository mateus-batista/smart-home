"""Tests for HTTP client and utilities."""

import pytest
import httpx

from belle.http import (
    Cache,
    SmartCache,
    find_by_name,
    is_retryable_error,
    calculate_backoff,
    with_retry,
    get_close_matches_for_name,
    RequestDeduplicator,
    CircuitBreaker,
    CircuitBreakerOpen,
    CircuitState,
)


class TestCache:
    """Tests for the Cache class."""

    def test_cache_empty_initially(self):
        """Cache should return None when empty."""
        cache = Cache(ttl=30.0)
        assert cache.get() is None

    def test_cache_stores_data(self):
        """Cache should store and retrieve data."""
        cache = Cache(ttl=30.0)
        cache.set({"key": "value"})
        assert cache.get() == {"key": "value"}

    def test_cache_clear(self):
        """Cache should be clearable."""
        cache = Cache(ttl=30.0)
        cache.set({"key": "value"})
        cache.clear()
        assert cache.get() is None

    def test_cache_expiry(self):
        """Cache should expire after TTL."""
        import time

        cache = Cache(ttl=0.1)  # 100ms TTL
        cache.set({"key": "value"})
        assert cache.get() == {"key": "value"}

        time.sleep(0.15)  # Wait for expiry
        assert cache.get() is None


class TestSmartCache:
    """Tests for SmartCache with adaptive TTL."""

    def test_uses_base_ttl_when_idle(self):
        """Should use base TTL when no recent modifications."""
        import time

        cache = SmartCache(base_ttl=0.2, short_ttl=0.05, activity_window=1.0)
        cache.set({"key": "value"})

        # Should be cached with base TTL
        time.sleep(0.1)  # 100ms < 200ms base TTL
        assert cache.get() == {"key": "value"}

    def test_uses_short_ttl_after_clear(self):
        """Should use short TTL after cache clear (modification)."""
        import time

        cache = SmartCache(base_ttl=0.5, short_ttl=0.05, activity_window=1.0)

        # First set and clear (simulating modification)
        cache.set({"old": "data"})
        cache.clear()  # Records modification time

        # Set new data
        cache.set({"new": "data"})

        # Should expire quickly (short TTL)
        time.sleep(0.1)  # 100ms > 50ms short TTL
        assert cache.get() is None

    def test_returns_to_base_ttl_after_window(self):
        """Should return to base TTL after activity window passes."""
        import time

        cache = SmartCache(base_ttl=0.2, short_ttl=0.01, activity_window=0.05)

        # Trigger modification
        cache.clear()

        # Wait for activity window to pass
        time.sleep(0.1)

        # Now should use base TTL
        cache.set({"key": "value"})
        time.sleep(0.05)  # 50ms < 200ms base TTL
        assert cache.get() == {"key": "value"}

    def test_invalidate_only_does_not_record_modification(self):
        """invalidate_only should not affect TTL behavior."""
        import time

        cache = SmartCache(base_ttl=0.2, short_ttl=0.01, activity_window=1.0)
        cache.invalidate_only()  # Should NOT record modification

        cache.set({"key": "value"})

        # Should use base TTL (not short TTL)
        time.sleep(0.05)  # 50ms < 200ms base TTL
        assert cache.get() == {"key": "value"}


class TestFindByName:
    """Tests for the find_by_name function."""

    @pytest.fixture
    def devices(self):
        """Sample device list."""
        return [
            {"id": "1", "name": "Kitchen Light"},
            {"id": "2", "name": "Living Room Lamp"},
            {"id": "3", "name": "Bedroom Light"},
        ]

    def test_exact_match(self, devices):
        """Should find by exact name match."""
        result = find_by_name(devices, "Kitchen Light")
        assert result is not None
        assert result["id"] == "1"

    def test_case_insensitive(self, devices):
        """Should be case-insensitive."""
        result = find_by_name(devices, "kitchen light")
        assert result is not None
        assert result["id"] == "1"

    def test_partial_match(self, devices):
        """Should find by partial match."""
        result = find_by_name(devices, "Kitchen")
        assert result is not None
        assert result["id"] == "1"

    def test_id_match(self, devices):
        """Should find by ID."""
        result = find_by_name(devices, "2")
        assert result is not None
        assert result["name"] == "Living Room Lamp"

    def test_not_found(self, devices):
        """Should return None when not found."""
        result = find_by_name(devices, "Garage")
        assert result is None

    def test_empty_list(self):
        """Should return None for empty list."""
        result = find_by_name([], "Kitchen")
        assert result is None

    def test_fuzzy_match(self, devices):
        """Should find by fuzzy match when exact/partial fails."""
        # "Kitchn Light" is a typo but should match "Kitchen Light"
        result = find_by_name(devices, "Kitchn Light")
        assert result is not None
        assert result["id"] == "1"

    def test_fuzzy_match_threshold(self, devices):
        """Should not match if similarity is too low."""
        result = find_by_name(devices, "ZZZZZ")
        assert result is None

    def test_whitespace_normalization(self, devices):
        """Should normalize whitespace in names."""
        result = find_by_name(devices, "  Kitchen   Light  ")
        assert result is not None
        assert result["id"] == "1"


class TestGetCloseMatches:
    """Tests for the get_close_matches_for_name function."""

    @pytest.fixture
    def devices(self):
        """Sample device list."""
        return [
            {"id": "1", "name": "Kitchen Light"},
            {"id": "2", "name": "Kitchen Lamp"},
            {"id": "3", "name": "Bedroom Light"},
        ]

    def test_returns_similar_names(self, devices):
        """Should return similar names sorted by similarity."""
        matches = get_close_matches_for_name(devices, "Kitchen")
        assert len(matches) >= 2
        # Both Kitchen devices should be in matches
        assert any("Kitchen" in m for m in matches)

    def test_respects_limit(self, devices):
        """Should respect the n parameter limit."""
        matches = get_close_matches_for_name(devices, "Light", n=1)
        assert len(matches) <= 1

    def test_empty_for_no_matches(self, devices):
        """Should return empty list when nothing matches."""
        matches = get_close_matches_for_name(devices, "ZZZZZ", cutoff=0.9)
        assert matches == []


class TestRetryLogic:
    """Tests for retry functionality."""

    def test_is_retryable_500_error(self):
        """500 errors should be retryable."""
        response = httpx.Response(500, request=httpx.Request("GET", "http://test"))
        error = httpx.HTTPStatusError("", request=response.request, response=response)
        assert is_retryable_error(error) is True

    def test_is_retryable_503_error(self):
        """503 errors should be retryable."""
        response = httpx.Response(503, request=httpx.Request("GET", "http://test"))
        error = httpx.HTTPStatusError("", request=response.request, response=response)
        assert is_retryable_error(error) is True

    def test_is_retryable_429_error(self):
        """429 (rate limit) errors should be retryable."""
        response = httpx.Response(429, request=httpx.Request("GET", "http://test"))
        error = httpx.HTTPStatusError("", request=response.request, response=response)
        assert is_retryable_error(error) is True

    def test_is_not_retryable_404_error(self):
        """404 errors should NOT be retryable."""
        response = httpx.Response(404, request=httpx.Request("GET", "http://test"))
        error = httpx.HTTPStatusError("", request=response.request, response=response)
        assert is_retryable_error(error) is False

    def test_is_not_retryable_400_error(self):
        """400 errors should NOT be retryable."""
        response = httpx.Response(400, request=httpx.Request("GET", "http://test"))
        error = httpx.HTTPStatusError("", request=response.request, response=response)
        assert is_retryable_error(error) is False

    def test_is_retryable_connect_error(self):
        """Connection errors should be retryable."""
        error = httpx.ConnectError("Connection refused")
        assert is_retryable_error(error) is True

    def test_is_retryable_timeout_error(self):
        """Timeout errors should be retryable."""
        error = httpx.TimeoutException("Timeout")
        assert is_retryable_error(error) is True

    def test_calculate_backoff_increases(self):
        """Backoff should increase with attempt number."""
        delay0 = calculate_backoff(0, base_delay=1.0)
        delay1 = calculate_backoff(1, base_delay=1.0)
        delay2 = calculate_backoff(2, base_delay=1.0)
        # Account for jitter by checking average trend
        assert delay1 > delay0 * 0.5  # Should be roughly 2x
        assert delay2 > delay1 * 0.5  # Should be roughly 2x again

    def test_calculate_backoff_respects_max(self):
        """Backoff should not exceed max_delay."""
        delay = calculate_backoff(100, base_delay=1.0, max_delay=5.0)
        # With jitter, should be around 5.0 +/- 25%
        assert delay <= 5.0 * 1.25

    @pytest.mark.asyncio
    async def test_with_retry_succeeds_first_try(self):
        """Decorator should work when function succeeds."""
        call_count = 0

        @with_retry(max_retries=3)
        async def success_func():
            nonlocal call_count
            call_count += 1
            return "success"

        result = await success_func()
        assert result == "success"
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_with_retry_retries_on_transient_error(self):
        """Decorator should retry on transient errors."""
        call_count = 0

        @with_retry(max_retries=3, base_delay=0.01)
        async def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise httpx.ConnectError("Connection refused")
            return "success"

        result = await flaky_func()
        assert result == "success"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_with_retry_raises_non_retryable(self):
        """Decorator should not retry non-retryable errors."""
        call_count = 0

        @with_retry(max_retries=3, base_delay=0.01)
        async def bad_request_func():
            nonlocal call_count
            call_count += 1
            response = httpx.Response(400, request=httpx.Request("GET", "http://test"))
            raise httpx.HTTPStatusError("Bad request", request=response.request, response=response)

        with pytest.raises(httpx.HTTPStatusError):
            await bad_request_func()
        assert call_count == 1  # Should not retry

    @pytest.mark.asyncio
    async def test_with_retry_exhausts_retries(self):
        """Decorator should raise after exhausting retries."""
        call_count = 0

        @with_retry(max_retries=2, base_delay=0.01)
        async def always_fails():
            nonlocal call_count
            call_count += 1
            raise httpx.ConnectError("Connection refused")

        with pytest.raises(httpx.ConnectError):
            await always_fails()
        assert call_count == 3  # Initial + 2 retries


class TestRequestDeduplicator:
    """Tests for request deduplication."""

    def test_first_request_not_duplicate(self):
        """First request should not be a duplicate."""
        dedup = RequestDeduplicator(window_ms=1000)
        assert dedup.is_duplicate("request-1") is False

    def test_same_request_is_duplicate(self):
        """Same request within window should be duplicate."""
        dedup = RequestDeduplicator(window_ms=1000)
        dedup.is_duplicate("request-1")
        assert dedup.is_duplicate("request-1") is True

    def test_different_request_not_duplicate(self):
        """Different request should not be duplicate."""
        dedup = RequestDeduplicator(window_ms=1000)
        dedup.is_duplicate("request-1")
        assert dedup.is_duplicate("request-2") is False

    def test_expired_request_not_duplicate(self):
        """Request outside window should not be duplicate."""
        import time
        dedup = RequestDeduplicator(window_ms=50)  # 50ms window
        dedup.is_duplicate("request-1")
        time.sleep(0.1)  # Wait 100ms
        assert dedup.is_duplicate("request-1") is False

    def test_make_key_consistent(self):
        """Same arguments should produce same key."""
        dedup = RequestDeduplicator()
        key1 = dedup.make_key("control_device", device_name="Kitchen", on=True)
        key2 = dedup.make_key("control_device", device_name="Kitchen", on=True)
        assert key1 == key2

    def test_make_key_different_for_different_args(self):
        """Different arguments should produce different keys."""
        dedup = RequestDeduplicator()
        key1 = dedup.make_key("control_device", device_name="Kitchen", on=True)
        key2 = dedup.make_key("control_device", device_name="Kitchen", on=False)
        assert key1 != key2

    def test_clear_resets_state(self):
        """Clear should reset deduplication state."""
        dedup = RequestDeduplicator(window_ms=1000)
        dedup.is_duplicate("request-1")
        dedup.clear()
        assert dedup.is_duplicate("request-1") is False


class TestCircuitBreaker:
    """Tests for circuit breaker pattern."""

    def test_initial_state_closed(self):
        """Circuit should start in closed state."""
        cb = CircuitBreaker()
        assert cb.state == CircuitState.CLOSED
        assert cb.is_available() is True

    def test_stays_closed_under_threshold(self):
        """Circuit should stay closed with failures under threshold."""
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        assert cb.is_available() is True

    def test_opens_at_threshold(self):
        """Circuit should open when failures reach threshold."""
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb.is_available() is False

    def test_success_resets_failure_count(self):
        """Success should reset failure count."""
        cb = CircuitBreaker(failure_threshold=3)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        assert cb._failure_count == 0
        # Should need 3 more failures to open
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED

    def test_half_open_after_timeout(self):
        """Circuit should enter half-open state after recovery timeout."""
        import time
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.1)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        time.sleep(0.15)
        assert cb.state == CircuitState.HALF_OPEN
        assert cb.is_available() is True  # Allow test request

    def test_half_open_success_closes(self):
        """Successful request in half-open state should close circuit."""
        import time
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.05)
        cb.record_failure()
        time.sleep(0.1)
        assert cb.state == CircuitState.HALF_OPEN
        cb.record_success()
        assert cb.state == CircuitState.CLOSED

    def test_half_open_failure_reopens(self):
        """Failed request in half-open state should reopen circuit."""
        import time
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.05)
        cb.record_failure()
        time.sleep(0.1)
        assert cb.state == CircuitState.HALF_OPEN
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

    def test_reset_clears_state(self):
        """Reset should clear all state."""
        cb = CircuitBreaker(failure_threshold=1)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        cb.reset()
        assert cb.state == CircuitState.CLOSED
        assert cb._failure_count == 0

    @pytest.mark.asyncio
    async def test_retry_with_circuit_breaker(self):
        """Retry decorator should integrate with circuit breaker."""
        cb = CircuitBreaker(failure_threshold=2)
        call_count = 0

        @with_retry(max_retries=1, base_delay=0.01, circuit_breaker=cb)
        async def failing_func():
            nonlocal call_count
            call_count += 1
            raise httpx.ConnectError("Connection refused")

        # First call should fail and record failures
        with pytest.raises(httpx.ConnectError):
            await failing_func()

        # Circuit should be open now (2 failures from retries)
        assert cb.state == CircuitState.OPEN

        # Next call should fail fast with CircuitBreakerOpen
        with pytest.raises(CircuitBreakerOpen):
            await failing_func()
