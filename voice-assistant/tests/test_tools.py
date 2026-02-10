"""Tests for tool functions."""

from unittest.mock import AsyncMock, patch

import pytest

from belle.tools.devices import (
    TILT_POSITIONS,
    _is_blind_tilt,
    control_device,
    control_shade,
    get_device_status,
)


class TestControlDevice:
    """Tests for the control_device function."""

    @pytest.fixture
    def mock_devices(self):
        """Sample device data."""
        return [
            {
                "id": "light-1",
                "name": "Kitchen Light",
                "type": "light",
                "state": {"on": True, "brightness": 100},
            },
            {
                "id": "light-2",
                "name": "Living Room Lamp",
                "type": "light",
                "state": {"on": False, "brightness": 0},
            },
        ]

    @pytest.mark.asyncio
    async def test_control_device_not_found(self):
        """Should return error for unknown device."""
        with patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock:
            mock.return_value = []

            result = await control_device("Nonexistent Light", on=True)

            assert result["success"] is False
            assert "not found" in result["error"]

    @pytest.mark.asyncio
    async def test_control_device_no_state(self, mock_devices):
        """Should return error when no state changes specified."""
        with patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock:
            mock.return_value = mock_devices

            result = await control_device("Kitchen Light")

            assert result["success"] is False
            assert "No state changes" in result["error"]

    @pytest.mark.asyncio
    async def test_control_device_success(self, mock_devices):
        """Should successfully control a device."""
        with (
            patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.devices.get_client", new_callable=AsyncMock) as mock_client,
        ):
            mock_cache.return_value = mock_devices

            # Mock HTTP client
            mock_response = AsyncMock()
            mock_response.raise_for_status = lambda: None
            mock_http = AsyncMock()
            mock_http.put = AsyncMock(return_value=mock_response)
            mock_client.return_value = mock_http

            result = await control_device("Kitchen Light", on=False)

            assert result["success"] is True
            assert result["device"] == "Kitchen Light"
            assert "off" in result["action"]


class TestGetDeviceStatus:
    """Tests for the get_device_status function."""

    @pytest.mark.asyncio
    async def test_device_not_found(self):
        """Should return error for unknown device."""
        with patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock:
            mock.return_value = []

            result = await get_device_status("Nonexistent")

            assert result["success"] is False
            assert "not found" in result["error"]

    @pytest.mark.asyncio
    async def test_device_found(self):
        """Should return device status."""
        devices = [
            {
                "id": "light-1",
                "name": "Kitchen Light",
                "type": "light",
                "state": {"on": True, "brightness": 75},
                "reachable": True,
            }
        ]

        with patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock:
            mock.return_value = devices

            result = await get_device_status("Kitchen")

            assert result["success"] is True
            assert result["device"]["name"] == "Kitchen Light"
            assert result["device"]["state"]["brightness"] == 75


class TestBlindTiltHelpers:
    """Tests for Blind Tilt helper functions."""

    def test_is_blind_tilt_true(self):
        """Should identify Blind Tilt device."""
        device = {"deviceType": "Blind Tilt", "name": "Living Room Blinds"}
        assert _is_blind_tilt(device) is True

    def test_is_blind_tilt_false_curtain(self):
        """Should not identify Curtain as Blind Tilt."""
        device = {"deviceType": "Curtain", "name": "Bedroom Curtain"}
        assert _is_blind_tilt(device) is False

    def test_is_blind_tilt_false_no_type(self):
        """Should return False for device without deviceType."""
        device = {"name": "Some Device"}
        assert _is_blind_tilt(device) is False

    def test_tilt_positions_has_all_5(self):
        """Should have all 5 tilt positions defined."""
        assert "open" in TILT_POSITIONS
        assert "closed-up" in TILT_POSITIONS
        assert "closed-down" in TILT_POSITIONS
        assert "half-open" in TILT_POSITIONS
        assert "half-closed" in TILT_POSITIONS
        assert len(TILT_POSITIONS) == 5


class TestControlShade:
    """Tests for the control_shade function."""

    @pytest.fixture
    def mock_devices(self):
        """Sample shade device data."""
        return [
            {
                "id": "switchbot-blind-1",
                "name": "Living Room Blinds",
                "type": "switchbot",
                "deviceType": "Blind Tilt",
                "state": {"on": True, "brightness": 50},
            },
            {
                "id": "switchbot-curtain-1",
                "name": "Bedroom Curtain",
                "type": "switchbot",
                "deviceType": "Curtain",
                "state": {"on": True, "brightness": 100},
            },
            {
                "id": "switchbot-roller-1",
                "name": "Office Shade",
                "type": "switchbot",
                "deviceType": "Roller Shade",
                "state": {"on": False, "brightness": 0},
            },
        ]

    @pytest.mark.asyncio
    async def test_shade_not_found(self):
        """Should return error for unknown shade."""
        with patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock:
            mock.return_value = []

            result = await control_shade("Nonexistent Shade", "close")

            assert result["success"] is False
            assert "not found" in result["error"]

    @pytest.mark.asyncio
    async def test_close_blind_tilt(self, mock_devices):
        """Should close Blind Tilt to position 0 (tilted down)."""
        with (
            patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.devices.get_client", new_callable=AsyncMock) as mock_client,
        ):
            mock_cache.return_value = mock_devices

            mock_response = AsyncMock()
            mock_response.raise_for_status = lambda: None
            mock_http = AsyncMock()
            mock_http.put = AsyncMock(return_value=mock_response)
            mock_client.return_value = mock_http

            result = await control_shade("Living Room Blinds", "close")

            assert result["success"] is True
            assert result["action"] == "closed"

            # Verify the state sent: tiltPosition should be closed-down
            call_args = mock_http.put.call_args
            assert call_args[1]["json"]["tiltPosition"] == "closed-down"
            assert call_args[1]["json"]["on"] is False

    @pytest.mark.asyncio
    async def test_open_blind_tilt(self, mock_devices):
        """Should open Blind Tilt to position 100 (tilted down, fully open)."""
        with (
            patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.devices.get_client", new_callable=AsyncMock) as mock_client,
        ):
            mock_cache.return_value = mock_devices

            mock_response = AsyncMock()
            mock_response.raise_for_status = lambda: None
            mock_http = AsyncMock()
            mock_http.put = AsyncMock(return_value=mock_response)
            mock_client.return_value = mock_http

            result = await control_shade("Living Room Blinds", "open")

            assert result["success"] is True
            assert result["action"] == "opened"

            # Verify the state sent: tiltPosition should be open
            call_args = mock_http.put.call_args
            assert call_args[1]["json"]["tiltPosition"] == "open"
            assert call_args[1]["json"]["on"] is True

    @pytest.mark.asyncio
    async def test_open_regular_curtain(self, mock_devices):
        """Should open regular curtain to position 100."""
        with (
            patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.devices.get_client", new_callable=AsyncMock) as mock_client,
        ):
            mock_cache.return_value = mock_devices

            mock_response = AsyncMock()
            mock_response.raise_for_status = lambda: None
            mock_http = AsyncMock()
            mock_http.put = AsyncMock(return_value=mock_response)
            mock_client.return_value = mock_http

            result = await control_shade("Bedroom Curtain", "open")

            assert result["success"] is True

            # Verify the state sent: brightness should be 100 for regular curtain
            call_args = mock_http.put.call_args
            assert call_args[1]["json"]["brightness"] == 100

    @pytest.mark.asyncio
    async def test_close_regular_curtain(self, mock_devices):
        """Should close regular curtain to position 0."""
        with (
            patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.devices.get_client", new_callable=AsyncMock) as mock_client,
        ):
            mock_cache.return_value = mock_devices

            mock_response = AsyncMock()
            mock_response.raise_for_status = lambda: None
            mock_http = AsyncMock()
            mock_http.put = AsyncMock(return_value=mock_response)
            mock_client.return_value = mock_http

            result = await control_shade("Bedroom Curtain", "close")

            assert result["success"] is True

            # Verify the state sent: brightness should be 0
            call_args = mock_http.put.call_args
            assert call_args[1]["json"]["brightness"] == 0

    @pytest.mark.asyncio
    async def test_set_position_blind_tilt(self, mock_devices):
        """Should map position percentage to nearest tilt position for Blind Tilt."""
        with (
            patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.devices.get_client", new_callable=AsyncMock) as mock_client,
        ):
            mock_cache.return_value = mock_devices

            mock_response = AsyncMock()
            mock_response.raise_for_status = lambda: None
            mock_http = AsyncMock()
            mock_http.put = AsyncMock(return_value=mock_response)
            mock_client.return_value = mock_http

            # Set to 50% openness -> should map to 'open' tilt position
            result = await control_shade("Living Room Blinds", "position", position=50)

            assert result["success"] is True
            assert "50%" in result["action"]

            # Verify the state sent: 50% maps to 'open' tilt position
            call_args = mock_http.put.call_args
            assert call_args[1]["json"]["tiltPosition"] == "open"

    @pytest.mark.asyncio
    async def test_set_position_regular_shade(self, mock_devices):
        """Should pass position directly for regular shades."""
        with (
            patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.devices.get_client", new_callable=AsyncMock) as mock_client,
        ):
            mock_cache.return_value = mock_devices

            mock_response = AsyncMock()
            mock_response.raise_for_status = lambda: None
            mock_http = AsyncMock()
            mock_http.put = AsyncMock(return_value=mock_response)
            mock_client.return_value = mock_http

            # Set to 75% for regular shade
            result = await control_shade("Office Shade", "position", position=75)

            assert result["success"] is True

            # Verify the state sent: position should be passed directly
            call_args = mock_http.put.call_args
            assert call_args[1]["json"]["brightness"] == 75

    @pytest.mark.asyncio
    async def test_position_requires_value(self, mock_devices):
        """Should return error when position action has no value."""
        with patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock:
            mock.return_value = mock_devices

            result = await control_shade("Living Room Blinds", "position")

            assert result["success"] is False
            assert "Position is required" in result["error"]

    @pytest.mark.asyncio
    async def test_stop_action(self, mock_devices):
        """Should handle stop action."""
        with patch("belle.tools.devices._get_cached_devices", new_callable=AsyncMock) as mock:
            mock.return_value = mock_devices

            result = await control_shade("Living Room Blinds", "stop")

            assert result["success"] is True
            assert result["action"] == "stop"
