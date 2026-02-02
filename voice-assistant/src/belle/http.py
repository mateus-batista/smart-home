"""Shared HTTP client with connection pooling for Belle."""

import logging
from contextlib import asynccontextmanager
from typing import Any

import httpx

from belle.config import settings

logger = logging.getLogger(__name__)

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


def find_by_name(items: list[dict], name: str, name_field: str = "name") -> dict | None:
    """
    Find an item by name with case-insensitive matching.
    
    Tries exact match first, then partial match, then ID match.
    
    Args:
        items: List of dicts to search
        name: Name to search for
        name_field: Field name containing the item name
    
    Returns:
        Matching item or None
    """
    name_lower = name.lower()

    # First try exact match
    for item in items:
        if item.get(name_field, "").lower() == name_lower:
            return item

    # Then try partial match
    for item in items:
        if name_lower in item.get(name_field, "").lower():
            return item

    # Try matching by ID
    for item in items:
        if item.get("id", "").lower() == name_lower:
            return item

    return None
