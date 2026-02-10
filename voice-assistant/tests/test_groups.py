"""Tests for group control tools."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from belle.tools.groups import _group_cache, control_group, get_all_groups


class TestGetAllGroups:
    """Tests for the get_all_groups function."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear the group cache before each test."""
        _group_cache.clear()

    @pytest.fixture
    def mock_groups(self):
        """Sample group data."""
        return [
            {
                "id": "group-1",
                "name": "All Lights",
                "devices": [
                    {"id": "dev-1", "name": "Kitchen Light", "externalId": "hue-1"},
                    {"id": "dev-2", "name": "Living Room Light", "externalId": "hue-2"},
                    {"id": "dev-3", "name": "Bedroom Light", "externalId": "hue-3"},
                ],
            },
            {
                "id": "group-2",
                "name": "Movie Mode",
                "devices": [
                    {"id": "dev-2", "name": "Living Room Light", "externalId": "hue-2"},
                ],
            },
            {
                "id": "group-3",
                "name": "Empty Group",
                "devices": [],
            },
        ]

    @pytest.mark.asyncio
    async def test_get_all_groups_success(self, mock_groups):
        """Should return all groups with device counts."""
        with patch("belle.tools.groups.get_client", new_callable=AsyncMock) as mock_get_client:
            mock_response = MagicMock()
            mock_response.json.return_value = mock_groups
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await get_all_groups()

            assert result["success"] is True
            assert result["count"] == 3
            assert len(result["groups"]) == 3

            # Check All Lights group
            all_lights = next(g for g in result["groups"] if g["name"] == "All Lights")
            assert all_lights["device_count"] == 3

    @pytest.mark.asyncio
    async def test_get_all_groups_http_error(self):
        """Should handle HTTP errors gracefully."""
        import httpx

        with patch("belle.tools.groups.get_client", new_callable=AsyncMock) as mock_get_client:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=httpx.HTTPError("Connection failed"))
            mock_get_client.return_value = mock_client

            result = await get_all_groups()

            assert result["success"] is False
            assert "error" in result


class TestControlGroup:
    """Tests for the control_group function."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear the group cache before each test."""
        _group_cache.clear()

    @pytest.fixture
    def mock_groups(self):
        """Sample group data."""
        return [
            {
                "id": "group-1",
                "name": "All Lights",
                "devices": [
                    {"id": "dev-1", "name": "Kitchen Light"},
                    {"id": "dev-2", "name": "Living Room Light"},
                ],
            },
            {
                "id": "group-2",
                "name": "Movie Mode",
                "devices": [
                    {"id": "dev-2", "name": "Living Room Light"},
                ],
            },
        ]

    @pytest.mark.asyncio
    async def test_control_group_not_found(self, mock_groups):
        """Should return error for unknown group."""
        with patch("belle.tools.groups._get_cached_groups", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = mock_groups

            result = await control_group("Nonexistent Group", on=True)

            assert result["success"] is False
            assert "not found" in result["error"]
            assert "available_groups" in result

    @pytest.mark.asyncio
    async def test_control_group_no_state(self, mock_groups):
        """Should return error when no state changes specified."""
        with patch("belle.tools.groups._get_cached_groups", new_callable=AsyncMock) as mock_cache:
            mock_cache.return_value = mock_groups

            result = await control_group("All Lights")

            assert result["success"] is False
            assert "No state changes" in result["error"]

    @pytest.mark.asyncio
    async def test_control_group_turn_on(self, mock_groups):
        """Should turn on all devices in a group."""
        with (
            patch("belle.tools.groups._get_cached_groups", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.groups.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_groups

            mock_response = MagicMock()
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await control_group("All Lights", on=True)

            assert result["success"] is True
            assert result["group"] == "All Lights"
            assert "on" in result["action"]
            assert result["devices_controlled"] == 2

            # Verify each device was controlled individually
            assert mock_client.put.call_count == 2
            for call in mock_client.put.call_args_list:
                assert call[1]["json"]["on"] is True

    @pytest.mark.asyncio
    async def test_control_group_turn_off(self, mock_groups):
        """Should turn off all devices in a group."""
        with (
            patch("belle.tools.groups._get_cached_groups", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.groups.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_groups

            mock_response = MagicMock()
            mock_response.json.return_value = {
                "results": [{"device": "Living Room Light", "success": True}],
            }
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await control_group("Movie Mode", on=False)

            assert result["success"] is True
            assert result["group"] == "Movie Mode"
            assert "off" in result["action"]

    @pytest.mark.asyncio
    async def test_control_group_set_brightness(self, mock_groups):
        """Should set brightness and auto-turn on."""
        with (
            patch("belle.tools.groups._get_cached_groups", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.groups.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_groups

            mock_response = MagicMock()
            mock_response.json.return_value = {
                "results": [
                    {"device": "Kitchen Light", "success": True},
                    {"device": "Living Room Light", "success": True},
                ],
            }
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await control_group("All Lights", brightness=50)

            assert result["success"] is True
            assert "brightness 50%" in result["action"]

            # Verify brightness and on were sent
            call_args = mock_client.put.call_args
            assert call_args[1]["json"]["brightness"] == 50
            assert call_args[1]["json"]["on"] is True

    @pytest.mark.asyncio
    async def test_control_group_set_color_temp(self, mock_groups):
        """Should set color temperature."""
        with (
            patch("belle.tools.groups._get_cached_groups", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.groups.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_groups

            mock_response = MagicMock()
            mock_response.json.return_value = {
                "results": [{"device": "Kitchen Light", "success": True}],
            }
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await control_group("All Lights", on=True, color_temp=4000)

            assert result["success"] is True
            assert "color temp 4000K" in result["action"]

    @pytest.mark.asyncio
    async def test_control_group_partial_match(self, mock_groups):
        """Should find group by partial name match."""
        with (
            patch("belle.tools.groups._get_cached_groups", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.groups.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_groups

            mock_response = MagicMock()
            mock_response.json.return_value = {
                "results": [{"device": "Living Room Light", "success": True}],
            }
            mock_response.raise_for_status = MagicMock()

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            # Use partial name "movie" (lowercase)
            result = await control_group("movie", on=True)

            assert result["success"] is True
            assert result["group"] == "Movie Mode"

    @pytest.mark.asyncio
    async def test_control_group_http_error(self, mock_groups):
        """Should handle HTTP errors for individual devices."""
        import httpx

        with (
            patch("belle.tools.groups._get_cached_groups", new_callable=AsyncMock) as mock_cache,
            patch("belle.tools.groups.get_client", new_callable=AsyncMock) as mock_get_client,
        ):
            mock_cache.return_value = mock_groups

            mock_client = AsyncMock()
            mock_client.put = AsyncMock(side_effect=httpx.HTTPError("Server error"))
            mock_get_client.return_value = mock_client

            result = await control_group("All Lights", on=True)

            # All individual device calls fail
            assert result["success"] is False
            assert result["devices_controlled"] == 0
