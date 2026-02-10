"""Room control tools for Belle."""

import logging
from typing import Any

import httpx

from belle.http import SmartCache, find_by_name, get_client, get_close_matches_for_name

logger = logging.getLogger(__name__)

# Shade device types
SHADE_DEVICE_TYPES = ["Curtain", "Curtain3", "Blind Tilt", "Roller Shade"]

# Tool definitions for the LLM
ROOM_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_all_rooms",
            "description": "Get a list of all rooms and their devices. Use this to see how devices are organized by room.",
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
            "name": "control_room",
            "description": "Control ALL LIGHTS in a room at once (excludes shades/blinds). USE THIS when user says 'kitchen lights', 'bedroom lights', 'turn on the kitchen', 'turn off the living room', 'turn off everything', etc. This controls lights ONLY — shades/blinds are never affected.",
            "parameters": {
                "type": "object",
                "properties": {
                    "room_name": {
                        "type": "string",
                        "description": "The name of the room (e.g., 'Kitchen', 'Living Room', 'Bedroom'). Extract just the room name without 'lights' or 'light'.",
                    },
                    "on": {
                        "type": "boolean",
                        "description": "Turn all devices in the room on (true) or off (false)",
                    },
                    "brightness": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 100,
                        "description": "Set brightness for all devices in the room (0-100)",
                    },
                    "color_temp": {
                        "type": "integer",
                        "minimum": 2000,
                        "maximum": 6500,
                        "description": "Color temperature in Kelvin for all devices that support it",
                    },
                },
                "required": ["room_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "control_room_shades",
            "description": "Control ALL shades, curtains, or blinds in a room at once. ONLY use this when the user EXPLICITLY mentions shades, blinds, curtains, persianas, or cortinas. Examples: 'close the living room blinds', 'open bedroom curtains', 'fecha as cortinas da sala'. NEVER use for generic room commands like 'turn off the living room' or 'desliga a sala' — those are for lights only.",
            "parameters": {
                "type": "object",
                "properties": {
                    "room_name": {
                        "type": "string",
                        "description": "The name of the room (e.g., 'Kitchen', 'Living Room', 'Bedroom', 'Sala'). Extract just the room name without 'blinds', 'curtains', etc.",
                    },
                    "action": {
                        "type": "string",
                        "enum": ["open", "close", "position"],
                        "description": "Action to perform: 'open' fully opens all shades, 'close' fully closes all shades, 'position' sets specific openness.",
                    },
                    "position": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 100,
                        "description": "Openness percentage (0-100). 0 = fully closed, 100 = fully open. Only used with action='position'.",
                    },
                },
                "required": ["room_name", "action"],
            },
        },
    },
]


# Shared cache instance
# Smart cache: 30s normally, 5s after control operations
_room_cache = SmartCache(base_ttl=30.0, short_ttl=5.0, activity_window=60.0)


async def _refresh_room_cache() -> list[dict]:
    """Refresh the room cache from the server."""
    client = await get_client()
    response = await client.get("/rooms")
    response.raise_for_status()
    rooms = response.json()
    _room_cache.set(rooms)
    return rooms


async def _get_cached_rooms() -> list[dict]:
    """Get rooms from cache or refresh if stale."""
    cached = _room_cache.get()
    if cached is not None:
        return cached
    return await _refresh_room_cache()


async def get_all_rooms() -> dict[str, Any]:
    """
    Get all rooms and their devices.

    Returns:
        dict with 'rooms' list
    """
    try:
        rooms = await _refresh_room_cache()

        return {
            "success": True,
            "rooms": [
                {
                    "id": r.get("id"),
                    "name": r.get("name"),
                    "device_count": len(r.get("devices", [])),
                    "devices": [d.get("name") for d in r.get("devices", [])],
                }
                for r in rooms
            ],
            "count": len(rooms),
        }
    except httpx.HTTPError as e:
        logger.error(f"Failed to get rooms: {e}")
        return {"success": False, "error": str(e)}


async def control_room(
    room_name: str,
    on: bool | None = None,
    brightness: int | None = None,
    color_temp: int | None = None,
) -> dict[str, Any]:
    """
    Control all devices in a room.

    Args:
        room_name: Name of the room
        on: Turn all devices on/off
        brightness: Brightness 0-100
        color_temp: Color temperature in Kelvin

    Returns:
        Result dict with success status
    """
    try:
        rooms = await _get_cached_rooms()
        room = find_by_name(rooms, room_name)

        if not room:
            suggestions = get_close_matches_for_name(rooms, room_name)
            return {
                "success": False,
                "error": f"Room '{room_name}' not found",
                "suggestions": suggestions if suggestions else None,
                "available_rooms": [r.get("name") for r in rooms],
            }

        all_devices = room.get("devices", [])
        # Filter out shade devices - they should only be controlled via control_room_shades
        devices = [d for d in all_devices if not _is_shade_device(d)]
        if not devices:
            return {
                "success": True,
                "room": room.get("name"),
                "message": "Room has no devices",
                "devices_controlled": 0,
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

        # Control each device in the room
        client = await get_client()
        results = []
        logger.info(f"Controlling {len(devices)} devices in room '{room.get('name')}' with state: {state_update}")

        for device in devices:
            device_id = device.get("externalId") or device.get("id")
            device_name = device.get("name")
            try:
                logger.info(f"  Sending to device '{device_name}' (id={device_id})")
                response = await client.put(f"/devices/{device_id}", json=state_update)
                logger.info(f"  Response for '{device_name}': {response.status_code}")
                response.raise_for_status()
                results.append({"device": device_name, "success": True})
            except httpx.HTTPStatusError as e:
                logger.error(f"  HTTP error for '{device_name}': {e.response.status_code} - {e.response.text}")
                results.append({"device": device_name, "success": False, "error": str(e)})
            except httpx.HTTPError as e:
                logger.error(f"  Error for '{device_name}': {e}")
                results.append({"device": device_name, "success": False, "error": str(e)})

        # Clear cache
        _room_cache.clear()

        success_count = sum(1 for r in results if r["success"])
        action_desc = []
        if "on" in state_update:
            action_desc.append("on" if state_update["on"] else "off")
        if "brightness" in state_update:
            action_desc.append(f"brightness {state_update['brightness']}%")
        if "colorTemp" in state_update:
            action_desc.append(f"color temp {state_update['colorTemp']}K")

        return {
            "success": success_count > 0,
            "room": room.get("name"),
            "action": ", ".join(action_desc),
            "devices_controlled": success_count,
            "total_devices": len(devices),
            "results": results,
        }

    except httpx.HTTPError as e:
        logger.error(f"Failed to control room: {e}")
        return {"success": False, "error": str(e)}


def _is_shade_device(device: dict) -> bool:
    """Check if a device is a shade/curtain/blind."""
    device_type = device.get("deviceType") or device.get("type")
    if device_type in SHADE_DEVICE_TYPES:
        return True
    name_lower = (device.get("name") or "").lower()
    return any(kw in name_lower for kw in ["shade", "curtain", "blind", "persiana", "cortina"])


def _is_blind_tilt(device: dict) -> bool:
    """Check if a device is a Blind Tilt type."""
    return device.get("deviceType") == "Blind Tilt"


def _get_shade_state_update(device: dict, action: str, position: int | None) -> dict[str, Any]:
    """
    Get the state update for a shade device based on action.
    
    For Blind Tilt devices:
    - position 50 = slats horizontal = fully open
    - position 0 = slats tilted down = closed
    """
    is_blind_tilt = _is_blind_tilt(device)
    state_update: dict[str, Any] = {}

    if action == "open":
        state_update["on"] = True
        if is_blind_tilt:
            state_update["brightness"] = 50  # Horizontal slats = fully open
        else:
            state_update["brightness"] = 100
    elif action == "close":
        state_update["on"] = False
        state_update["brightness"] = 0  # Always close downward
    elif action == "position" and position is not None:
        if is_blind_tilt:
            # Convert visual openness to Blind Tilt position
            # 100% openness -> position 50, 0% openness -> position 0
            state_update["brightness"] = int(position / 2)
        else:
            state_update["brightness"] = position
        state_update["on"] = position > 0

    return state_update


async def control_room_shades(
    room_name: str,
    action: str,
    position: int | None = None,
) -> dict[str, Any]:
    """
    Control all shades/curtains/blinds in a room.

    Args:
        room_name: Name of the room
        action: 'open', 'close', or 'position'
        position: Position 0-100 (only for action='position')

    Returns:
        Result dict with success status
    """
    try:
        rooms = await _get_cached_rooms()
        room = find_by_name(rooms, room_name)

        if not room:
            suggestions = get_close_matches_for_name(rooms, room_name)
            return {
                "success": False,
                "error": f"Room '{room_name}' not found",
                "suggestions": suggestions if suggestions else None,
                "available_rooms": [r.get("name") for r in rooms],
            }

        devices = room.get("devices", [])

        # Filter to shade devices only
        shade_devices = [d for d in devices if _is_shade_device(d)]

        if not shade_devices:
            return {
                "success": False,
                "room": room.get("name"),
                "error": f"No shades/curtains/blinds found in {room.get('name')}",
                "all_devices": [d.get("name") for d in devices],
            }

        if action == "position" and position is None:
            return {"success": False, "error": "Position is required for 'position' action"}

        # Control each shade device in the room
        client = await get_client()
        results = []
        logger.info(f"Controlling {len(shade_devices)} shades in room '{room.get('name')}' with action: {action}")

        for device in shade_devices:
            device_id = device.get("externalId") or device.get("id")
            device_name = device.get("name")
            state_update = _get_shade_state_update(device, action, position)

            try:
                logger.info(f"  Sending to shade '{device_name}' (id={device_id}): {state_update}")
                response = await client.put(f"/devices/{device_id}", json=state_update)
                logger.info(f"  Response for '{device_name}': {response.status_code}")
                response.raise_for_status()
                results.append({"device": device_name, "success": True})
            except httpx.HTTPStatusError as e:
                logger.error(f"  HTTP error for '{device_name}': {e.response.status_code} - {e.response.text}")
                results.append({"device": device_name, "success": False, "error": str(e)})
            except httpx.HTTPError as e:
                logger.error(f"  Error for '{device_name}': {e}")
                results.append({"device": device_name, "success": False, "error": str(e)})

        # Clear cache
        _room_cache.clear()

        success_count = sum(1 for r in results if r["success"])

        # Build action description
        if action == "open":
            action_desc = "opened"
        elif action == "close":
            action_desc = "closed"
        elif action == "position":
            action_desc = f"set to {position}%"
        else:
            action_desc = action

        return {
            "success": success_count > 0,
            "room": room.get("name"),
            "action": action_desc,
            "shades_controlled": success_count,
            "total_shades": len(shade_devices),
            "results": results,
        }

    except httpx.HTTPError as e:
        logger.error(f"Failed to control room shades: {e}")
        return {"success": False, "error": str(e)}


# Map tool names to functions
ROOM_TOOL_FUNCTIONS = {
    "get_all_rooms": get_all_rooms,
    "control_room": control_room,
    "control_room_shades": control_room_shades,
}
