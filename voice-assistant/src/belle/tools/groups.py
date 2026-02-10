"""Device group control tools for Belle."""

import logging
from typing import Any

import httpx

from belle.http import SmartCache, find_by_name, get_client, get_close_matches_for_name
from belle.tools.rooms import SHADE_DEVICE_TYPES

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
            "description": "Control all LIGHTS in a custom group at once. This does NOT control shades/blinds/curtains — only use control_shade or control_room_shades for those, and ONLY when the user explicitly mentions them.",
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

        # Filter out shade devices — only control lights
        all_devices = group.get("devices", [])
        light_devices = [
            d for d in all_devices
            if not _is_shade_device(d.get("device", d))
        ]

        if not light_devices:
            return {
                "success": True,
                "group": group.get("name"),
                "message": "Group has no light devices (only shades/blinds)",
                "devices_controlled": 0,
            }

        # Control each light device individually (skipping shades)
        client = await get_client()
        results = []
        logger.info(f"Controlling {len(light_devices)} lights in group '{group.get('name')}' with state: {state_update}")

        for membership in light_devices:
            device = membership.get("device", membership)
            device_id = device.get("externalId") or device.get("id")
            device_name = device.get("name")
            try:
                response = await client.put(f"/devices/{device_id}", json=state_update)
                response.raise_for_status()
                results.append({"device": device_name, "success": True})
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error for '{device_name}': {e.response.status_code}")
                results.append({"device": device_name, "success": False, "error": str(e)})
            except httpx.HTTPError as e:
                logger.error(f"Error for '{device_name}': {e}")
                results.append({"device": device_name, "success": False, "error": str(e)})

        # Clear cache
        _group_cache.clear()

        action_desc = []
        if "on" in state_update:
            action_desc.append("on" if state_update["on"] else "off")
        if "brightness" in state_update:
            action_desc.append(f"brightness {state_update['brightness']}%")
        if "colorTemp" in state_update:
            action_desc.append(f"color temp {state_update['colorTemp']}K")

        success_count = sum(1 for r in results if r.get("success"))

        return {
            "success": success_count > 0,
            "group": group.get("name"),
            "action": ", ".join(action_desc),
            "devices_controlled": success_count,
            "total_devices": len(light_devices),
            "results": results,
        }

    except httpx.HTTPError as e:
        logger.error(f"Failed to control group: {e}")
        return {"success": False, "error": str(e)}


def _is_shade_device(device: dict) -> bool:
    """Check if a device is a shade/curtain/blind."""
    device_type = device.get("deviceType") or device.get("type")
    if device_type in SHADE_DEVICE_TYPES:
        return True
    name_lower = (device.get("name") or "").lower()
    return any(kw in name_lower for kw in ["shade", "curtain", "blind", "persiana", "cortina"])


# Map tool names to functions
GROUP_TOOL_FUNCTIONS = {
    "get_all_groups": get_all_groups,
    "control_group": control_group,
}
