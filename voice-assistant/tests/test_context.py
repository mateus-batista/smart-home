"""Tests for the smart home context module."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from belle.context import (
    _format_device_state,
    _format_group_summary,
    _format_room_summary,
    clear_context_cache,
    get_smart_home_context,
)


class TestFormatFunctions:
    """Tests for formatting helper functions."""

    def test_format_device_state_on_with_brightness(self):
        """Should format device that is on with brightness."""
        device = {
            "name": "Kitchen Light",
            "state": {"on": True, "brightness": 75},
        }
        result = _format_device_state(device)
        assert "Kitchen Light" in result
        assert "on at 75%" in result

    def test_format_device_state_off(self):
        """Should format device that is off."""
        device = {
            "name": "Bedroom Light",
            "state": {"on": False, "brightness": 0},
        }
        result = _format_device_state(device)
        assert "Bedroom Light" in result
        assert "off" in result

    def test_format_device_state_on_no_brightness(self):
        """Should format device that is on without brightness info."""
        device = {
            "name": "Smart Plug",
            "state": {"on": True},
        }
        result = _format_device_state(device)
        assert "Smart Plug" in result
        assert "on" in result

    def test_format_room_summary_with_devices(self):
        """Should format room with device count and state summary."""
        room = {
            "name": "Kitchen",
            "devices": [
                {"name": "Light 1", "state": {"on": True}},
                {"name": "Light 2", "state": {"on": False}},
            ],
        }
        result = _format_room_summary(room)
        assert "Kitchen" in result
        assert "2 lights" in result
        assert "1 on" in result

    def test_format_room_summary_all_on(self):
        """Should show 'all on' when all devices are on."""
        room = {
            "name": "Living Room",
            "devices": [
                {"name": "Light 1", "state": {"on": True}},
                {"name": "Light 2", "state": {"on": True}},
            ],
        }
        result = _format_room_summary(room)
        assert "all on" in result

    def test_format_room_summary_all_off(self):
        """Should show 'all off' when all devices are off."""
        room = {
            "name": "Bedroom",
            "devices": [
                {"name": "Light 1", "state": {"on": False}},
            ],
        }
        result = _format_room_summary(room)
        assert "all off" in result

    def test_format_room_summary_empty(self):
        """Should handle empty room."""
        room = {"name": "Empty Room", "devices": []}
        result = _format_room_summary(room)
        assert "Empty Room" in result
        assert "empty" in result

    def test_format_group_summary(self):
        """Should format group with device count."""
        group = {
            "name": "All Lights",
            "devices": [{"name": "Light 1"}, {"name": "Light 2"}, {"name": "Light 3"}],
        }
        result = _format_group_summary(group)
        assert "All Lights" in result
        assert "3 devices" in result


class TestGetSmartHomeContext:
    """Tests for the main context gathering function."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear context cache before each test."""
        clear_context_cache()

    @pytest.fixture
    def mock_devices(self):
        """Sample device data."""
        return [
            {
                "id": "hue-1",
                "name": "Kitchen Bulb 1",
                "roomName": "Kitchen",
                "state": {"on": True, "brightness": 75},
            },
            {
                "id": "hue-2",
                "name": "Kitchen Bulb 2",
                "roomName": "Kitchen",
                "state": {"on": False, "brightness": 0},
            },
            {
                "id": "hue-3",
                "name": "Living Room Lamp",
                "roomName": "Living Room",
                "state": {"on": True, "brightness": 50},
            },
        ]

    @pytest.fixture
    def mock_rooms(self):
        """Sample room data."""
        return [
            {
                "name": "Kitchen",
                "devices": [
                    {"name": "Kitchen Bulb 1", "state": {"on": True}},
                    {"name": "Kitchen Bulb 2", "state": {"on": False}},
                ],
            },
            {
                "name": "Living Room",
                "devices": [
                    {"name": "Living Room Lamp", "state": {"on": True}},
                ],
            },
        ]

    @pytest.fixture
    def mock_groups(self):
        """Sample group data."""
        return [
            {"name": "All Lights", "devices": [{"name": "Light 1"}, {"name": "Light 2"}]},
            {"name": "Movie Mode", "devices": [{"name": "Living Room Lamp"}]},
        ]

    @pytest.mark.asyncio
    async def test_get_context_success(self, mock_devices, mock_rooms, mock_groups):
        """Should return formatted context with all data."""
        with patch("belle.context.get_client", new_callable=AsyncMock) as mock_client_fn:
            mock_client = AsyncMock()

            # Mock responses for each endpoint
            devices_response = MagicMock()
            devices_response.json.return_value = mock_devices
            devices_response.raise_for_status = MagicMock()

            rooms_response = MagicMock()
            rooms_response.json.return_value = mock_rooms
            rooms_response.raise_for_status = MagicMock()

            groups_response = MagicMock()
            groups_response.json.return_value = mock_groups
            groups_response.raise_for_status = MagicMock()

            # Return different responses based on URL
            async def mock_get(url):
                if "devices" in url:
                    return devices_response
                elif "rooms" in url:
                    return rooms_response
                elif "groups" in url:
                    return groups_response

            mock_client.get = mock_get
            mock_client_fn.return_value = mock_client

            context = await get_smart_home_context()

            # Verify context contains expected sections
            assert "## Current Smart Home State" in context
            assert "**Rooms:**" in context
            assert "**Groups:**" in context
            assert "**Lights:**" in context

            # Verify rooms are mentioned
            assert "Kitchen" in context
            assert "Living Room" in context

            # Verify devices are mentioned
            assert "Kitchen Bulb 1" in context
            assert "Living Room Lamp" in context

            # Verify groups are mentioned
            assert "All Lights" in context
            assert "Movie Mode" in context

            # Verify usage hint
            assert "control_room" in context
            assert "control_device" in context

    @pytest.mark.asyncio
    async def test_context_caching(self, mock_devices, mock_rooms, mock_groups):
        """Should cache context and not refetch."""
        with patch("belle.context.get_client", new_callable=AsyncMock) as mock_client_fn:
            mock_client = AsyncMock()

            devices_response = MagicMock()
            devices_response.json.return_value = mock_devices
            devices_response.raise_for_status = MagicMock()

            rooms_response = MagicMock()
            rooms_response.json.return_value = mock_rooms
            rooms_response.raise_for_status = MagicMock()

            groups_response = MagicMock()
            groups_response.json.return_value = mock_groups
            groups_response.raise_for_status = MagicMock()

            call_count = 0

            async def mock_get(url):
                nonlocal call_count
                call_count += 1
                if "devices" in url:
                    return devices_response
                elif "rooms" in url:
                    return rooms_response
                elif "groups" in url:
                    return groups_response

            mock_client.get = mock_get
            mock_client_fn.return_value = mock_client

            # First call should fetch
            context1 = await get_smart_home_context()
            first_call_count = call_count

            # Second call should use cache
            context2 = await get_smart_home_context()

            # Should be same result
            assert context1 == context2

            # Should not have made additional API calls
            assert call_count == first_call_count

    @pytest.mark.asyncio
    async def test_cache_clear(self, mock_devices, mock_rooms, mock_groups):
        """Should refetch after cache clear."""
        with patch("belle.context.get_client", new_callable=AsyncMock) as mock_client_fn:
            mock_client = AsyncMock()

            devices_response = MagicMock()
            devices_response.json.return_value = mock_devices
            devices_response.raise_for_status = MagicMock()

            rooms_response = MagicMock()
            rooms_response.json.return_value = mock_rooms
            rooms_response.raise_for_status = MagicMock()

            groups_response = MagicMock()
            groups_response.json.return_value = mock_groups
            groups_response.raise_for_status = MagicMock()

            call_count = 0

            async def mock_get(url):
                nonlocal call_count
                call_count += 1
                if "devices" in url:
                    return devices_response
                elif "rooms" in url:
                    return rooms_response
                elif "groups" in url:
                    return groups_response

            mock_client.get = mock_get
            mock_client_fn.return_value = mock_client

            # First call
            await get_smart_home_context()
            first_count = call_count

            # Clear cache
            clear_context_cache()

            # Second call should fetch again
            await get_smart_home_context()

            # Should have made new API calls
            assert call_count > first_count

    @pytest.mark.asyncio
    async def test_handles_api_errors(self):
        """Should handle API errors gracefully."""
        with patch("belle.context.get_client", new_callable=AsyncMock) as mock_client_fn:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=Exception("API error"))
            mock_client_fn.return_value = mock_client

            # Should not raise, just return context with empty data
            context = await get_smart_home_context()

            assert "## Current Smart Home State" in context
            # Should indicate no data available
            assert "None" in context or "empty" in context.lower()
