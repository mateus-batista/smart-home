"""Device group control tools for Belle."""

import logging
from typing import Any

import httpx

from belle.http import SmartCache, find_by_name, get_client, get_close_matches_for_name

logger = logging.getLogger(__name__)

# Tool definitions for the LLM
GROUP_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_all_groups",
            "description": "Get a list of all device groups. Groups are custom collections of devices that can be controlled together.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "control_group",
            "description": "Control all devices in a custom group at once.",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_name": {
                        "type": "string",
                        "description": "The name of the device group",
                    },
                    "on": {
                        "type": "boolean",
                        "description": "Turn all devices in the group on (true) or off (false)",
                    },
                    "brightness": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 100,
                        "description": "Set brightness for all devices in the group (0-100)",
                    },
                    "color_temp": {
                        "type": "integer",
                        "minimum": 2000,
                        "maximum": 6500,
                        "description": "Color temperature in Kelvin for all devices that support it",
                    },
                },
                "required": ["group_name"],
            },
        },
    },
]


# Shared cache instance
# Smart cache: 30s normally, 5s after control operations
_group_cache = SmartCache(base_ttl=30.0, short_ttl=5.0, activity_window=60.0)


async def _refresh_group_cache() -> list[dict]:
    """Refresh the group cache from the server."""
    client = await get_client()
    response = await client.get("/groups")
    response.raise_for_status()
    groups = response.json()
    _group_cache.set(groups)
    return groups


async def _get_cached_groups() -> list[dict]:
    """Get groups from cache or refresh if stale."""
    cached = _group_cache.get()
    if cached is not None:
        return cached
    return await _refresh_group_cache()


async def get_all_groups() -> dict[str, Any]:
    """
    Get all device groups.

    Returns:
        dict with 'groups' list
    """
    try:
        groups = await _refresh_group_cache()

        return {
            "success": True,
            "groups": [
                {
                    "id": g.get("id"),
                    "name": g.get("name"),
                    "device_count": len(g.get("devices", [])),
                    "devices": [d.get("name") for d in g.get("devices", [])],
                }
                for g in groups
            ],
            "count": len(groups),
        }
    except httpx.HTTPError as e:
        logger.error(f"Failed to get groups: {e}")
        return {"success": False, "error": str(e)}


async def control_group(
    group_name: str,
    on: bool | None = None,
    brightness: int | None = None,
    color_temp: int | None = None,
) -> dict[str, Any]:
    """
    Control all devices in a group.

    Args:
        group_name: Name of the group
        on: Turn all devices on/off
        brightness: Brightness 0-100
        color_temp: Color temperature in Kelvin

    Returns:
        Result dict with success status
    """
    try:
        groups = await _get_cached_groups()
        group = find_by_name(groups, group_name)

        if not group:
            suggestions = get_close_matches_for_name(groups, group_name)
            return {
                "success": False,
                "error": f"Group '{group_name}' not found",
                "suggestions": suggestions if suggestions else None,
                "available_groups": [g.get("name") for g in groups],
            }

        # Build state update
        state_update: dict[str, Any] = {}

        if on is not None:
            state_update["on"] = on

        if brightness is not None:
            state_update["brightness"] = brightness
            if brightness > 0:
                state_update["on"] = True

        if color_temp is not None:
            state_update["colorTemp"] = color_temp

        if not state_update:
            return {"success": False, "error": "No state changes specified"}

        # Use the group state endpoint
        group_id = group.get("id")
        client = await get_client()
        response = await client.put(f"/groups/{group_id}/state", json=state_update)
        response.raise_for_status()
        result = response.json()

        # Clear cache
        _group_cache.clear()

        action_desc = []
        if "on" in state_update:
            action_desc.append("on" if state_update["on"] else "off")
        if "brightness" in state_update:
            action_desc.append(f"brightness {state_update['brightness']}%")
        if "colorTemp" in state_update:
            action_desc.append(f"color temp {state_update['colorTemp']}K")

        # Parse results
        results = result.get("results", [])
        success_count = sum(1 for r in results if r.get("success"))

        return {
            "success": success_count > 0,
            "group": group.get("name"),
            "action": ", ".join(action_desc),
            "devices_controlled": success_count,
            "total_devices": len(group.get("devices", [])),
            "results": results,
        }

    except httpx.HTTPError as e:
        logger.error(f"Failed to control group: {e}")
        return {"success": False, "error": str(e)}


# Map tool names to functions
GROUP_TOOL_FUNCTIONS = {
    "get_all_groups": get_all_groups,
    "control_group": control_group,
}
