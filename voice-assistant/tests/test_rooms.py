"""Tests for room control tools."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from belle.tools.rooms import (
    _get_shade_state_update,
    _is_blind_tilt,
    _is_shade_device,
    _room_cache,
    control_room,
    control_room_shades,
    get_all_rooms,
)


class TestGetAllRooms:
    """Tests for the get_all_rooms function."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear the room cache before each test."""
        _room_cache.clear()

    @pytest.fixture
    def mock_rooms(self):
        """Sample room data."""
        return [
            {
                "id": "room-1",
                "name": "Living Room",
                "devices": [
                    {"id": "dev-1", "name": "Living Room Lamp", "externalId": "hue-1"},
                    {"id": "dev-2", "name": "Living Room Light", "externalId": "hue-2"},
                ],
            },
            {
                "id": "room-2",
                "name": "Kitchen",
                "devices": [
                    {"id": "dev-3", "name": "Kitchen Light", "externalId": "hue-3"},
                ],
            },
            {
                "id": "room-3",
                "name": "Bedroom",
                "devices": [],
            },
        ]

    @pytest.mark.asyncio
    async def test_get_all_rooms_success(self, mock_rooms):
        """Should return all rooms with device counts."""
        with patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_get_client:
            mock_response = MagicMock()
            mock_response.json.return_value = mock_rooms
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await get_all_rooms()

            assert result["success"] is True
            assert result["count"] == 3
            assert len(result["rooms"]) == 3

            # Check Living Room
            living_room = next(r for r in result["rooms"] if r["name"] == "Living Room")
            assert living_room["device_count"] == 2
            assert "Living Room Lamp" in living_room["devices"]

    @pytest.mark.asyncio
    async def test_get_all_rooms_http_error(self):
        """Should handle HTTP errors gracefully."""
        import httpx

        with patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_get_client:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=httpx.HTTPError("Connection failed"))
            mock_get_client.return_value = mock_client

            result = await get_all_rooms()

            assert result["success"] is False
            assert "error" in result


class TestControlRoom:
    """Tests for the control_room function."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear the room cache before each test."""
        _room_cache.clear()

    @pytest.fixture
    def mock_rooms(self):
        """Sample room data."""
        return [
            {
                "id": "room-1",
                "name": "Living Room",
                "devices": [
                    {"id": "dev-1", "name": "Living Room Lamp", "externalId": "hue-1"},
                    {"id": "dev-2", "name": "Living Room Light", "externalId": "hue-2"},
                ],
            },
            {
                "id": "room-2",
                "name": "Kitchen",
                "devices": [
                    {"id": "dev-3", "name": "Kitchen Light", "externalId": "hue-3"},
                ],
            },
            {
                "id": "room-3",
                "name": "Empty Room",
                "devices": [],
            },
        ]

    @pytest.mark.asyncio
    async def test_control_room_not_found(self, mock_rooms):
        """Should return error for unknown room."""
        with patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = mock_rooms

            result = await control_room("Nonexistent Room", on=True)

            assert result["success"] is False
            assert "not found" in result["error"]
            assert "available_rooms" in result

    @pytest.mark.asyncio
    async def test_control_room_no_state(self, mock_rooms):
        """Should return error when no state changes specified."""
        with patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = mock_rooms

            result = await control_room("Living Room")

            assert result["success"] is False
            assert "No state changes" in result["error"]

    @pytest.mark.asyncio
    async def test_control_room_empty_room(self, mock_rooms):
        """Should handle room with no devices."""
        with patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = mock_rooms

            result = await control_room("Empty Room", on=True)

            assert result["success"] is True
            assert result["devices_controlled"] == 0
            assert "no devices" in result["message"]

    @pytest.mark.asyncio
    async def test_control_room_turn_on(self, mock_rooms):
        """Should turn on all devices in a room."""
        with (
            patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_rooms

            # Mock successful HTTP responses for each device
            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await control_room("Living Room", on=True)

            assert result["success"] is True
            assert result["room"] == "Living Room"
            assert result["devices_controlled"] == 2
            assert "on" in result["action"]

            # Verify API was called for each device
            assert mock_client.put.call_count == 2

    @pytest.mark.asyncio
    async def test_control_room_set_brightness(self, mock_rooms):
        """Should set brightness and auto-turn on."""
        with (
            patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_rooms

            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await control_room("Kitchen", brightness=75)

            assert result["success"] is True
            assert "brightness 75%" in result["action"]

            # Verify the state sent includes both brightness and on=True
            call_args = mock_client.put.call_args
            assert call_args[1]["json"]["brightness"] == 75
            assert call_args[1]["json"]["on"] is True

    @pytest.mark.asyncio
    async def test_control_room_partial_name_match(self, mock_rooms):
        """Should find room by partial name match."""
        with (
            patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_rooms

            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            # Use partial name "kitchen" (lowercase)
            result = await control_room("kitchen", on=False)

            assert result["success"] is True
            assert result["room"] == "Kitchen"

    @pytest.mark.asyncio
    async def test_control_room_device_failure(self, mock_rooms):
        """Should handle partial device failures."""
        import httpx

        with (
            patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_rooms

            # First device succeeds, second fails
            mock_response_success = MagicMock()
            mock_response_success.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(
                side_effect=[
                    mock_response_success,
                    httpx.HTTPError("Device unreachable"),
                ]
            )
            mock_get_client.return_value = mock_client

            result = await control_room("Living Room", on=True)

            # Should still be considered success if at least one device worked
            assert result["success"] is True
            assert result["devices_controlled"] == 1
            assert result["total_devices"] == 2

            # Results should show individual device status
            assert len(result["results"]) == 2
            assert any(r["success"] for r in result["results"])
            assert any(not r["success"] for r in result["results"])


class TestShadeHelpers:
    """Tests for shade helper functions in rooms module."""

    def test_is_shade_device_by_type_blind_tilt(self):
        """Should identify Blind Tilt as shade device."""
        device = {"deviceType": "Blind Tilt", "name": "Office Blinds"}
        assert _is_shade_device(device) is True

    def test_is_shade_device_by_type_curtain(self):
        """Should identify Curtain as shade device."""
        device = {"deviceType": "Curtain", "name": "Living Room Curtain"}
        assert _is_shade_device(device) is True

    def test_is_shade_device_by_type_roller_shade(self):
        """Should identify Roller Shade as shade device."""
        device = {"deviceType": "Roller Shade", "name": "Bedroom Shade"}
        assert _is_shade_device(device) is True

    def test_is_shade_device_by_name_blind(self):
        """Should identify device with 'blind' in name as shade."""
        device = {"deviceType": "unknown", "name": "Kitchen Blinds"}
        assert _is_shade_device(device) is True

    def test_is_shade_device_by_name_cortina(self):
        """Should identify device with 'cortina' in name as shade."""
        device = {"deviceType": "unknown", "name": "Cortina da Sala"}
        assert _is_shade_device(device) is True

    def test_is_shade_device_by_name_persiana(self):
        """Should identify device with 'persiana' in name as shade."""
        device = {"deviceType": "unknown", "name": "Persiana Quarto"}
        assert _is_shade_device(device) is True

    def test_is_shade_device_false_for_light(self):
        """Should not identify light as shade device."""
        device = {"deviceType": "Color Bulb", "name": "Kitchen Light"}
        assert _is_shade_device(device) is False

    def test_is_blind_tilt_true(self):
        """Should identify Blind Tilt device."""
        device = {"deviceType": "Blind Tilt", "name": "Office Blinds"}
        assert _is_blind_tilt(device) is True

    def test_is_blind_tilt_false(self):
        """Should not identify Curtain as Blind Tilt."""
        device = {"deviceType": "Curtain", "name": "Living Room Curtain"}
        assert _is_blind_tilt(device) is False

    def test_get_shade_state_update_open_blind_tilt(self):
        """Should set position 50 for open Blind Tilt (horizontal slats)."""
        device = {"deviceType": "Blind Tilt", "name": "Blinds"}
        state = _get_shade_state_update(device, "open", None)

        assert state["on"] is True
        assert state["brightness"] == 50

    def test_get_shade_state_update_close_blind_tilt(self):
        """Should set position 0 for close Blind Tilt (tilted down)."""
        device = {"deviceType": "Blind Tilt", "name": "Blinds"}
        state = _get_shade_state_update(device, "close", None)

        assert state["on"] is False
        assert state["brightness"] == 0

    def test_get_shade_state_update_open_curtain(self):
        """Should set position 100 for open Curtain."""
        device = {"deviceType": "Curtain", "name": "Curtain"}
        state = _get_shade_state_update(device, "open", None)

        assert state["on"] is True
        assert state["brightness"] == 100

    def test_get_shade_state_update_close_curtain(self):
        """Should set position 0 for close Curtain."""
        device = {"deviceType": "Curtain", "name": "Curtain"}
        state = _get_shade_state_update(device, "close", None)

        assert state["on"] is False
        assert state["brightness"] == 0

    def test_get_shade_state_update_position_blind_tilt(self):
        """Should convert openness to Blind Tilt position (50% -> 25)."""
        device = {"deviceType": "Blind Tilt", "name": "Blinds"}
        state = _get_shade_state_update(device, "position", 50)

        assert state["brightness"] == 25
        assert state["on"] is True

    def test_get_shade_state_update_position_curtain(self):
        """Should pass position directly for Curtain."""
        device = {"deviceType": "Curtain", "name": "Curtain"}
        state = _get_shade_state_update(device, "position", 75)

        assert state["brightness"] == 75
        assert state["on"] is True


class TestControlRoomShades:
    """Tests for the control_room_shades function."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear the room cache before each test."""
        _room_cache.clear()

    @pytest.fixture
    def mock_rooms_with_shades(self):
        """Sample room data with shade devices."""
        return [
            {
                "id": "room-1",
                "name": "Living Room",
                "devices": [
                    {"id": "dev-1", "name": "Living Room Lamp", "externalId": "hue-1", "deviceType": "Color Bulb"},
                    {"id": "dev-2", "name": "Living Room Blinds Left", "externalId": "sb-1", "deviceType": "Blind Tilt"},
                    {"id": "dev-3", "name": "Living Room Blinds Right", "externalId": "sb-2", "deviceType": "Blind Tilt"},
                    {"id": "dev-4", "name": "Living Room Curtain", "externalId": "sb-3", "deviceType": "Curtain"},
                ],
            },
            {
                "id": "room-2",
                "name": "Kitchen",
                "devices": [
                    {"id": "dev-5", "name": "Kitchen Light", "externalId": "hue-4", "deviceType": "Color Bulb"},
                ],
            },
            {
                "id": "room-3",
                "name": "Bedroom",
                "devices": [
                    {"id": "dev-6", "name": "Bedroom Roller Shade", "externalId": "sb-4", "deviceType": "Roller Shade"},
                ],
            },
        ]

    @pytest.mark.asyncio
    async def test_room_not_found(self, mock_rooms_with_shades):
        """Should return error for unknown room."""
        with patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = mock_rooms_with_shades

            result = await control_room_shades("Nonexistent Room", "close")

            assert result["success"] is False
            assert "not found" in result["error"]
            assert "available_rooms" in result

    @pytest.mark.asyncio
    async def test_room_no_shades(self, mock_rooms_with_shades):
        """Should return error when room has no shade devices."""
        with patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = mock_rooms_with_shades

            result = await control_room_shades("Kitchen", "close")

            assert result["success"] is False
            assert "No shades" in result["error"]

    @pytest.mark.asyncio
    async def test_close_all_shades_in_room(self, mock_rooms_with_shades):
        """Should close all shades in a room."""
        with (
            patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_rooms_with_shades

            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await control_room_shades("Living Room", "close")

            assert result["success"] is True
            assert result["room"] == "Living Room"
            assert result["action"] == "closed"
            assert result["shades_controlled"] == 3  # 2 Blind Tilts + 1 Curtain
            assert result["total_shades"] == 3

            # Should have called PUT for each shade device (not the lamp)
            assert mock_client.put.call_count == 3

    @pytest.mark.asyncio
    async def test_open_all_shades_with_blind_tilt(self, mock_rooms_with_shades):
        """Should open all shades, with Blind Tilt at position 50."""
        with (
            patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_rooms_with_shades

            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await control_room_shades("Living Room", "open")

            assert result["success"] is True
            assert result["action"] == "opened"

            # Verify calls were made with correct brightness values
            calls = mock_client.put.call_args_list
            assert len(calls) == 3

            # Blind Tilt devices should get brightness=50, Curtain should get brightness=100
            brightness_values = [call[1]["json"]["brightness"] for call in calls]
            assert 50 in brightness_values  # Blind Tilt
            assert 100 in brightness_values  # Curtain

    @pytest.mark.asyncio
    async def test_set_position_shades(self, mock_rooms_with_shades):
        """Should set position for all shades in room."""
        with (
            patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_rooms_with_shades

            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await control_room_shades("Living Room", "position", position=50)

            assert result["success"] is True
            assert "50%" in result["action"]

    @pytest.mark.asyncio
    async def test_position_requires_value(self, mock_rooms_with_shades):
        """Should return error when position action has no value."""
        with patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = mock_rooms_with_shades

            result = await control_room_shades("Living Room", "position")

            assert result["success"] is False
            assert "Position is required" in result["error"]

    @pytest.mark.asyncio
    async def test_partial_name_match(self, mock_rooms_with_shades):
        """Should find room by partial name match."""
        with (
            patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_rooms_with_shades

            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            # Use partial name "sala" (Portuguese for living room, lowercase)
            result = await control_room_shades("living", "close")

            assert result["success"] is True
            assert result["room"] == "Living Room"

    @pytest.mark.asyncio
    async def test_partial_device_failure(self, mock_rooms_with_shades):
        """Should handle partial device failures."""
        import httpx

        with (
            patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_rooms_with_shades

            mock_response_success = MagicMock()
            mock_response_success.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            # First two succeed, third fails
            mock_client.put = AsyncMock(
                side_effect=[
                    mock_response_success,
                    mock_response_success,
                    httpx.HTTPError("Device unreachable"),
                ]
            )
            mock_get_client.return_value = mock_client

            result = await control_room_shades("Living Room", "close")

            # Should still be success if at least one worked
            assert result["success"] is True
            assert result["shades_controlled"] == 2
            assert result["total_shades"] == 3

            # Results should show individual device status
            assert len(result["results"]) == 3
            success_count = sum(1 for r in result["results"] if r["success"])
            assert success_count == 2

    @pytest.mark.asyncio
    async def test_close_bedroom_roller_shade(self, mock_rooms_with_shades):
        """Should close a single roller shade in bedroom."""
        with (
            patch("belle.tools.rooms._get_cached_rooms", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.rooms.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_rooms_with_shades

            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await control_room_shades("Bedroom", "close")

            assert result["success"] is True
            assert result["shades_controlled"] == 1

            # Verify brightness=0 was sent
            call_args = mock_client.put.call_args
            assert call_args[1]["json"]["brightness"] == 0
