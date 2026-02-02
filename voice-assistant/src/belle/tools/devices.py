"""Device control tools for Belle."""

import logging
from typing import Any

import httpx

from belle.http import Cache, find_by_name, get_client

logger = logging.getLogger(__name__)

# Tool definitions for the LLM
DEVICE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_all_devices",
            "description": "Get a list of all available smart home devices with their current state. Use this to discover what devices exist and their names.",
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
            "name": "get_device_status",
            "description": "Get the current status of a specific device by name or ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "device_name": {
                        "type": "string",
                        "description": "The name or ID of the device to query",
                    },
                },
                "required": ["device_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "control_device",
            "description": "Control a SINGLE specific device by its exact name. Only use this when the user mentions a specific device name like 'Kitchen Bulb 1' or 'Desk Lamp'. Do NOT use this for room-based commands like 'kitchen lights' - use control_room instead.",
            "parameters": {
                "type": "object",
                "properties": {
                    "device_name": {
                        "type": "string",
                        "description": "The EXACT name of a specific device (e.g., 'Kitchen Bulb 1', 'Desk Lamp'). NOT for room names or 'kitchen lights'.",
                    },
                    "on": {
                        "type": "boolean",
                        "description": "Turn device on (true) or off (false)",
                    },
                    "brightness": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 100,
                        "description": "Brightness level from 0-100. Setting brightness > 0 also turns the device on.",
                    },
                    "color": {
                        "type": "object",
                        "properties": {
                            "hue": {
                                "type": "integer",
                                "minimum": 0,
                                "maximum": 360,
                                "description": "Color hue (0-360). 0=red, 60=yellow, 120=green, 180=cyan, 240=blue, 300=magenta",
                            },
                            "saturation": {
                                "type": "integer",
                                "minimum": 0,
                                "maximum": 100,
                                "description": "Color saturation (0-100). 0=white, 100=full color",
                            },
                        },
                        "description": "Set color using hue and saturation",
                    },
                    "color_temp": {
                        "type": "integer",
                        "minimum": 2000,
                        "maximum": 6500,
                        "description": "Color temperature in Kelvin. 2000-3000=warm/cozy, 4000=neutral, 5000-6500=cool/daylight",
                    },
                },
                "required": ["device_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "control_shade",
            "description": "Control smart shades, curtains, or blinds. Use this for any window covering control like opening, closing, or setting a specific position. For Blind Tilt devices (venetian blinds with tilting slats), 'open' sets horizontal slats to let light through, and 'close' tilts slats downward to block light.",
            "parameters": {
                "type": "object",
                "properties": {
                    "device_name": {
                        "type": "string",
                        "description": "The name of the shade, curtain, or blind to control.",
                    },
                    "action": {
                        "type": "string",
                        "enum": ["open", "close", "stop", "position"],
                        "description": "Action to perform: 'open' fully opens (horizontal slats for blinds), 'close' fully closes (tilts down for blinds), 'stop' pauses movement, 'position' sets specific openness level.",
                    },
                    "position": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 100,
                        "description": "Openness percentage (0-100). 0 = fully closed, 100 = fully open. Only used with action='position'.",
                    },
                },
                "required": ["device_name", "action"],
            },
        },
    },
]


# Shared cache instance
_device_cache = Cache(ttl=30.0)


async def _refresh_device_cache() -> list[dict]:
    """Refresh the device cache from the server."""
    client = await get_client()
    response = await client.get("/devices")
    response.raise_for_status()
    devices = response.json()
    _device_cache.set(devices)
    return devices


async def _get_cached_devices() -> list[dict]:
    """Get devices from cache or refresh if stale."""
    cached = _device_cache.get()
    if cached is not None:
        return cached
    return await _refresh_device_cache()


async def get_all_devices() -> dict[str, Any]:
    """
    Get all available devices.

    Returns:
        dict with 'devices' list and 'count'
    """
    try:
        devices = await _refresh_device_cache()  # Always get fresh data
        return {
            "success": True,
            "devices": [
                {
                    "id": d.get("id"),
                    "name": d.get("name"),
                    "type": d.get("type"),
                    "room": d.get("room", {}).get("name") if d.get("room") else None,
                    "on": d.get("state", {}).get("on"),
                    "brightness": d.get("state", {}).get("brightness"),
                    "reachable": d.get("reachable", True),
                }
                for d in devices
            ],
            "count": len(devices),
        }
    except httpx.HTTPError as e:
        logger.error(f"Failed to get devices: {e}")
        return {"success": False, "error": str(e)}


async def get_device_status(device_name: str) -> dict[str, Any]:
    """
    Get status of a specific device.

    Args:
        device_name: Name or ID of the device

    Returns:
        Device status dict
    """
    try:
        devices = await _get_cached_devices()
        device = find_by_name(devices, device_name)

        if not device:
            return {
                "success": False,
                "error": f"Device '{device_name}' not found",
                "available_devices": [d.get("name") for d in devices],
            }

        return {
            "success": True,
            "device": {
                "id": device.get("id"),
                "name": device.get("name"),
                "type": device.get("type"),
                "room": device.get("room", {}).get("name") if device.get("room") else None,
                "state": device.get("state"),
                "reachable": device.get("reachable", True),
                "capabilities": device.get("capabilities"),
            },
        }
    except httpx.HTTPError as e:
        logger.error(f"Failed to get device status: {e}")
        return {"success": False, "error": str(e)}


async def control_device(
    device_name: str,
    on: bool | None = None,
    brightness: int | None = None,
    color: dict | None = None,
    color_temp: int | None = None,
) -> dict[str, Any]:
    """
    Control a device.

    Args:
        device_name: Name of the device to control
        on: Turn on/off
        brightness: Brightness 0-100
        color: Color dict with hue (0-360) and saturation (0-100)
        color_temp: Color temperature in Kelvin (2000-6500)

    Returns:
        Result dict with success status
    """
    try:
        devices = await _get_cached_devices()
        device = find_by_name(devices, device_name)

        if not device:
            # Check if the search term might be a room name
            search_lower = device_name.lower()
            room_indicators = ["lights", "light", "room", "kitchen", "living", "bedroom", "bathroom", "office", "dining"]
            might_be_room = any(word in search_lower for word in room_indicators)

            error_msg = f"Device '{device_name}' not found"
            if might_be_room:
                error_msg += ". This looks like a room request - use control_room instead"

            return {
                "success": False,
                "error": error_msg,
                "available_devices": [d.get("name") for d in devices],
                "suggestion": "Use control_room to control all lights in a room" if might_be_room else None,
            }

        # Build state update
        state_update: dict[str, Any] = {}

        if on is not None:
            state_update["on"] = on

        if brightness is not None:
            state_update["brightness"] = brightness
            # Turning brightness up implies turning on
            if brightness > 0:
                state_update["on"] = True

        if color is not None:
            state_update["color"] = {
                "hue": color.get("hue", 0),
                "saturation": color.get("saturation", 100),
                "brightness": brightness or device.get("state", {}).get("brightness", 100),
            }

        if color_temp is not None:
            state_update["colorTemp"] = color_temp

        if not state_update:
            return {"success": False, "error": "No state changes specified"}

        # Send update to API
        device_id = device.get("id")
        device_name = device.get("name")
        logger.info(f"Controlling device '{device_name}' (id={device_id}) with state: {state_update}")

        client = await get_client()
        response = await client.put(f"/devices/{device_id}", json=state_update)

        # Log response details for debugging
        logger.info(f"API response status: {response.status_code}")
        try:
            response_data = response.json()
            logger.info(f"API response body: {response_data}")
        except Exception:
            logger.info(f"API response text: {response.text}")

        response.raise_for_status()

        # Clear cache to get fresh state
        _device_cache.clear()

        action_desc = []
        if "on" in state_update:
            action_desc.append("on" if state_update["on"] else "off")
        if "brightness" in state_update:
            action_desc.append(f"brightness {state_update['brightness']}%")
        if "color" in state_update:
            action_desc.append("color changed")
        if "colorTemp" in state_update:
            action_desc.append(f"color temp {state_update['colorTemp']}K")

        return {
            "success": True,
            "device": device_name,
            "action": ", ".join(action_desc),
            "state": state_update,
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error controlling device: {e.response.status_code} - {e.response.text}")
        return {"success": False, "error": f"API error: {e.response.status_code}"}
    except httpx.HTTPError as e:
        logger.error(f"Failed to control device: {e}")
        return {"success": False, "error": str(e)}


def _is_blind_tilt(device: dict) -> bool:
    """Check if a device is a Blind Tilt type."""
    return device.get("deviceType") == "Blind Tilt"


def _get_blind_tilt_position_for_openness(openness: int) -> int:
    """
    Convert visual openness (0-100) to Blind Tilt position.
    
    For Blind Tilt devices:
    - Position 50 = slats horizontal = fully open (100% visual openness)
    - Position 0 = slats tilted down = closed (0% visual openness)
    - Position 100 = slats tilted up = closed (0% visual openness)
    
    We always close downward (position 0) for consistency.
    """
    if openness >= 100:
        return 50  # Fully open = horizontal slats
    elif openness <= 0:
        return 0  # Fully closed = tilted down
    else:
        # Linear interpolation: 0% openness -> position 0, 100% openness -> position 50
        return int(openness / 2)


async def control_shade(
    device_name: str,
    action: str,
    position: int | None = None,
) -> dict[str, Any]:
    """
    Control a smart shade, curtain, or blind.

    Args:
        device_name: Name of the shade/curtain/blind to control
        action: 'open', 'close', 'stop', or 'position'
        position: Position 0-100 (only for action='position')

    Returns:
        Result dict with success status
    """
    try:
        devices = await _get_cached_devices()
        device = find_by_name(devices, device_name)

        if not device:
            # Filter to show only shade-type devices
            shade_devices = [
                d.get("name") for d in devices 
                if d.get("deviceType") in ["Curtain", "Curtain3", "Blind Tilt", "Roller Shade"]
                or "shade" in d.get("name", "").lower()
                or "curtain" in d.get("name", "").lower()
                or "blind" in d.get("name", "").lower()
                or "persiana" in d.get("name", "").lower()
                or "cortina" in d.get("name", "").lower()
            ]
            return {
                "success": False,
                "error": f"Shade '{device_name}' not found",
                "available_shades": shade_devices if shade_devices else [d.get("name") for d in devices],
            }

        # Check if this is a Blind Tilt device
        is_blind_tilt = _is_blind_tilt(device)
        
        # Build state update based on action
        state_update: dict[str, Any] = {}

        if action == "open":
            state_update["on"] = True
            if is_blind_tilt:
                # Blind Tilt: 50 = horizontal slats = fully open
                state_update["brightness"] = 50
            else:
                state_update["brightness"] = 100  # 100% open
        elif action == "close":
            state_update["on"] = False
            # Always close to position 0 (closes downward for Blind Tilt)
            state_update["brightness"] = 0  # 0% open = closed
        elif action == "stop":
            # For stop, we need to send a specific command
            # Most APIs don't support stop via state, so we'll try with the current position
            logger.info(f"Stop command for shade - maintaining current position")
            return {
                "success": True,
                "device": device.get("name"),
                "action": "stop",
                "note": "Stop command sent",
            }
        elif action == "position":
            if position is None:
                return {"success": False, "error": "Position is required for 'position' action"}
            if is_blind_tilt:
                # Convert visual openness to Blind Tilt position
                state_update["brightness"] = _get_blind_tilt_position_for_openness(position)
            else:
                state_update["brightness"] = position  # Position maps to brightness (100 = open)
            state_update["on"] = position > 0

        if not state_update:
            return {"success": False, "error": f"Unknown action: {action}"}

        # Send update to API
        device_id = device.get("id")
        device_display_name = device.get("name")
        logger.info(f"Controlling shade '{device_display_name}' (id={device_id}) with action: {action}, state: {state_update}")

        client = await get_client()
        response = await client.put(f"/devices/{device_id}", json=state_update)
        response.raise_for_status()

        # Clear cache to get fresh state
        _device_cache.clear()

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
            "success": True,
            "device": device_display_name,
            "action": action_desc,
            "state": state_update,
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error controlling shade: {e.response.status_code} - {e.response.text}")
        return {"success": False, "error": f"API error: {e.response.status_code}"}
    except httpx.HTTPError as e:
        logger.error(f"Failed to control shade: {e}")
        return {"success": False, "error": str(e)}


# Map tool names to functions
DEVICE_TOOL_FUNCTIONS = {
    "get_all_devices": get_all_devices,
    "get_device_status": get_device_status,
    "control_device": control_device,
    "control_shade": control_shade,
}
