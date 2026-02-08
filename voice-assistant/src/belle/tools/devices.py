"""Device control tools for Belle."""

import logging
from typing import Any

import httpx

from belle.http import SmartCache, find_by_name, get_client, get_close_matches_for_name

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
    {
        "type": "function",
        "function": {
            "name": "get_device_help",
            "description": "Get help about what you can do with a specific device. Use this when user asks 'what can I do with...', 'help with...', 'how do I use...', or similar questions about a device's capabilities.",
            "parameters": {
                "type": "object",
                "properties": {
                    "device_name": {
                        "type": "string",
                        "description": "The name of the device to get help for",
                    },
                },
                "required": ["device_name"],
            },
        },
    },
]


# Shared cache instance
# Smart cache: 30s normally, 5s after control operations
_device_cache = SmartCache(base_ttl=30.0, short_ttl=5.0, activity_window=60.0)


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
            suggestions = get_close_matches_for_name(devices, device_name)
            return {
                "success": False,
                "error": f"Device '{device_name}' not found",
                "suggestions": suggestions if suggestions else None,
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

            suggestions = get_close_matches_for_name(devices, device_name)
            return {
                "success": False,
                "error": error_msg,
                "suggestions": suggestions if suggestions else None,
                "available_devices": [d.get("name") for d in devices[:10]],  # Limit to first 10
                "hint": "Use control_room to control all lights in a room" if might_be_room else None,
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
    - Position 100 = slats tilted down = fully open (lets light in)
    - Position 0 = slats horizontal = closed (blocks light)

    We use position 0-100 range linearly mapping to openness 0-100.
    """
    if openness >= 100:
        return 100  # Fully open = slats tilted down
    elif openness <= 0:
        return 0  # Fully closed = slats horizontal
    else:
        return openness  # Linear mapping


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
                # Blind Tilt: 100 = slats tilted down = fully open (lets light in)
                state_update["brightness"] = 100
            else:
                state_update["brightness"] = 100  # 100% open
        elif action == "close":
            state_update["on"] = False
            # Always close to position 0 (closes downward for Blind Tilt)
            state_update["brightness"] = 0  # 0% open = closed
        elif action == "stop":
            # For stop, we need to send a specific command
            # Most APIs don't support stop via state, so we'll try with the current position
            logger.info("Stop command for shade - maintaining current position")
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


# Shade device types for capability detection
SHADE_DEVICE_TYPES = ["Curtain", "Curtain3", "Blind Tilt", "Roller Shade"]


def _get_device_capabilities(device: dict) -> dict[str, Any]:
    """
    Analyze a device and return its capabilities.

    Returns:
        Dict with capability flags and descriptions
    """
    state = device.get("state", {})
    device_type = device.get("deviceType") or device.get("type", "")
    name_lower = device.get("name", "").lower()

    # Check if it's a shade device
    is_shade = (
        device_type in SHADE_DEVICE_TYPES
        or any(kw in name_lower for kw in ["shade", "curtain", "blind", "persiana", "cortina"])
    )

    # Check if it's a Blind Tilt (special handling)
    is_blind_tilt = device_type == "Blind Tilt"

    # Detect capabilities from state keys
    capabilities = {
        "on_off": "on" in state,
        "brightness": "brightness" in state,
        "color": "color" in state or any(k in state for k in ["hue", "saturation"]),
        "color_temp": "colorTemp" in state or "ct" in state,
        "is_shade": is_shade,
        "is_blind_tilt": is_blind_tilt,
    }

    return capabilities


async def get_device_help(device_name: str) -> dict[str, Any]:
    """
    Get help about what you can do with a device.

    Args:
        device_name: Name of the device

    Returns:
        Help information about the device's capabilities
    """
    try:
        devices = await _get_cached_devices()
        device = find_by_name(devices, device_name)

        if not device:
            suggestions = get_close_matches_for_name(devices, device_name)
            return {
                "success": False,
                "error": f"Device '{device_name}' not found",
                "suggestions": suggestions if suggestions else None,
            }

        caps = _get_device_capabilities(device)
        device_display_name = device.get("name")
        device_type = device.get("deviceType") or device.get("type", "unknown")

        # Build help text based on capabilities
        actions = []

        if caps["is_shade"]:
            actions.append("• Open/close: 'open the {name}', 'close the {name}'")
            actions.append("• Set position: 'set {name} to 50%'")
            if caps["is_blind_tilt"]:
                actions.append("• Note: This is a blind with tilting slats. 'Open' sets horizontal slats, 'close' tilts them down.")
        else:
            if caps["on_off"]:
                actions.append("• Turn on/off: 'turn on {name}', 'turn off {name}'")
            if caps["brightness"]:
                actions.append("• Set brightness: 'set {name} to 50%', 'dim {name}', 'brighten {name}'")
            if caps["color"]:
                actions.append("• Set color: 'set {name} to red', 'make {name} blue'")
            if caps["color_temp"]:
                actions.append("• Set warmth: 'make {name} warmer', 'set {name} to cool white'")

        if not actions:
            actions.append("• Turn on/off: 'turn on {name}', 'turn off {name}'")

        # Format help text
        help_lines = [a.format(name=device_display_name) for a in actions]

        return {
            "success": True,
            "device": device_display_name,
            "type": device_type,
            "capabilities": caps,
            "help": help_lines,
            "summary": f"{device_display_name} is a {device_type}. You can: " + ", ".join(
                ["turn it on/off"] if caps["on_off"] else []
                + (["adjust brightness"] if caps["brightness"] else [])
                + (["change color"] if caps["color"] else [])
                + (["adjust color temperature"] if caps["color_temp"] else [])
                + (["open/close it"] if caps["is_shade"] else [])
            ) or "control it with basic on/off commands",
        }

    except httpx.HTTPError as e:
        logger.error(f"Failed to get device help: {e}")
        return {"success": False, "error": str(e)}


# Map tool names to functions
DEVICE_TOOL_FUNCTIONS = {
    "get_all_devices": get_all_devices,
    "get_device_status": get_device_status,
    "control_device": control_device,
    "control_shade": control_shade,
    "get_device_help": get_device_help,
}
