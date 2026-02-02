"""Tests for HTTP client and utilities."""

import pytest

from belle.http import Cache, find_by_name


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
