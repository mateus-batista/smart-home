"""Pytest configuration and fixtures for Belle tests."""

import pytest


@pytest.fixture(autouse=True)
def mock_settings(monkeypatch):
    """Mock settings for all tests."""
    monkeypatch.setenv("BELLE_SMART_HOME_API_URL", "http://localhost:3001/api")
    monkeypatch.setenv("BELLE_DEBUG", "true")
