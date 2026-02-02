"""Smart home context gathering for Belle.

This module fetches and formats current device/room/group state
to provide context to the LLM for smarter decision making.
"""

import json
import logging
from typing import Any

from belle.http import get_client, Cache

logger = logging.getLogger(__name__)

# Cache for smart home context (shorter TTL for freshness)
_context_cache = Cache(ttl=15.0)
_context_json_cache = Cache(ttl=15.0)


async def _fetch_devices() -> list[dict]:
    """Fetch all devices from the smart home API."""
    try:
        client = await get_client()
        response = await client.get("/devices")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.warning(f"Failed to fetch devices for context: {e}")
        return []


async def _fetch_rooms() -> list[dict]:
    """Fetch all rooms from the smart home API."""
    try:
        client = await get_client()
        response = await client.get("/rooms")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.warning(f"Failed to fetch rooms for context: {e}")
        return []


async def _fetch_groups() -> list[dict]:
    """Fetch all groups from the smart home API."""
    try:
        client = await get_client()
        response = await client.get("/groups")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.warning(f"Failed to fetch groups for context: {e}")
        return []


def _format_device_state(device: dict) -> str:
    """Format a device's state concisely."""
    state = device.get("state", {})
    name = device.get("name", "Unknown")
    
    if not state.get("reachable", True) and device.get("reachable") is False:
        return f"{name} (unreachable)"
    
    parts = [name]
    
    # On/off state
    is_on = state.get("on", False)
    if is_on:
        brightness = state.get("brightness")
        if brightness is not None:
            parts.append(f"on at {brightness}%")
        else:
            parts.append("on")
    else:
        parts.append("off")
    
    return " ".join(parts)


def _format_room_summary(room: dict) -> str:
    """Format a room summary."""
    name = room.get("name", "Unknown")
    devices = room.get("devices", [])
    device_count = len(devices)
    
    if device_count == 0:
        return f"{name} (empty)"
    
    # Count how many devices are on
    on_count = sum(
        1 for d in devices 
        if d.get("state", {}).get("on", False)
    )
    
    if on_count == 0:
        return f"{name} ({device_count} lights, all off)"
    elif on_count == device_count:
        return f"{name} ({device_count} lights, all on)"
    else:
        return f"{name} ({device_count} lights, {on_count} on)"


def _format_group_summary(group: dict) -> str:
    """Format a group summary."""
    name = group.get("name", "Unknown")
    devices = group.get("devices", [])
    return f"{name} ({len(devices)} devices)"


def _get_device_capabilities(device: dict) -> list[str]:
    """Determine device capabilities based on type and state."""
    capabilities = ["on_off"]
    state = device.get("state", {})
    device_type = device.get("deviceType", "")
    name = device.get("name", "").lower()
    
    # Check for shade/curtain devices
    shade_types = ["Curtain", "Curtain3", "Blind Tilt", "Roller Shade"]
    shade_keywords = ["shade", "curtain", "blind", "persiana", "cortina"]
    
    if device_type in shade_types or any(kw in name for kw in shade_keywords):
        return ["open", "close", "position"]
    
    # Light capabilities
    if "brightness" in state or state.get("brightness") is not None:
        capabilities.append("brightness")
    
    if "color" in state or "hue" in state or "xy" in state:
        capabilities.append("color")
    
    if "colorTemperature" in state or "ct" in state:
        capabilities.append("color_temperature")
    
    return capabilities


async def get_smart_home_context_json() -> dict:
    """
    Get structured smart home context as JSON.
    
    Returns a dict with:
    - rooms: list of room objects with name, id, device_names
    - devices: list of device objects with name, id, room, state, capabilities
    - groups: list of group objects with name, id, device_names
    - shades: list of shade objects with name, id, state, capabilities
    
    Uses caching to minimize API calls.
    """
    import asyncio
    
    # Check cache first
    cached = _context_json_cache.get()
    if cached is not None:
        return cached
    
    # Fetch all data in parallel
    devices, rooms, groups = await asyncio.gather(
        _fetch_devices(),
        _fetch_rooms(),
        _fetch_groups(),
    )
    
    # Separate devices by type
    shade_types = ["Curtain", "Curtain3", "Blind Tilt", "Roller Shade"]
    shade_keywords = ["shade", "curtain", "blind", "persiana", "cortina"]
    
    light_list = []
    shade_list = []
    
    for d in devices:
        device_type = d.get("deviceType", "")
        name = d.get("name", "Unknown")
        room_info = d.get("room", {})
        room_name = d.get("roomName") or (room_info.get("name") if room_info else None)
        state = d.get("state", {})
        
        device_obj = {
            "name": name,
            "id": d.get("id", ""),
            "room": room_name,
            "state": {
                "on": state.get("on", False),
                "brightness": state.get("brightness"),
                "reachable": state.get("reachable", True),
            },
            "capabilities": _get_device_capabilities(d),
        }
        
        # Remove None values from state
        device_obj["state"] = {k: v for k, v in device_obj["state"].items() if v is not None}
        
        if device_type in shade_types or any(kw in name.lower() for kw in shade_keywords):
            # Shades use brightness as position
            device_obj["state"] = {
                "position": state.get("brightness", 0),
                "reachable": state.get("reachable", True),
            }
            device_obj["state"] = {k: v for k, v in device_obj["state"].items() if v is not None}
            shade_list.append(device_obj)
        else:
            light_list.append(device_obj)
    
    # Format rooms
    room_list = [
        {
            "name": r.get("name", "Unknown"),
            "id": r.get("id", ""),
            "device_names": [d.get("name", "") for d in r.get("devices", [])],
        }
        for r in rooms
    ]
    
    # Format groups
    group_list = [
        {
            "name": g.get("name", "Unknown"),
            "id": g.get("id", ""),
            "device_names": [d.get("name", "") for d in g.get("devices", [])],
        }
        for g in groups
    ]
    
    result = {
        "rooms": room_list,
        "devices": light_list,
        "groups": group_list,
        "shades": shade_list,
    }
    
    # Cache the result
    _context_json_cache.set(result)
    
    logger.debug(f"Generated JSON context with {len(light_list)} devices, {len(shade_list)} shades, {len(room_list)} rooms")
    
    return result


async def get_smart_home_context() -> str:
    """
    Get formatted smart home context for the LLM.
    
    Returns a concise summary of:
    - Available rooms and their device counts/states
    - Available device groups
    - Individual devices with current states
    
    Uses caching to minimize API calls.
    """
    # Check cache first
    cached = _context_cache.get()
    if cached is not None:
        return cached
    
    # Fetch all data in parallel
    import asyncio
    devices, rooms, groups = await asyncio.gather(
        _fetch_devices(),
        _fetch_rooms(),
        _fetch_groups(),
    )
    
    lines = ["## Current Smart Home State"]
    
    # Rooms section
    if rooms:
        room_summaries = [_format_room_summary(r) for r in rooms]
        lines.append(f"**Rooms:** {', '.join(room_summaries)}")
    else:
        lines.append("**Rooms:** None configured")
    
    # Groups section
    if groups:
        group_summaries = [_format_group_summary(g) for g in groups]
        lines.append(f"**Groups:** {', '.join(group_summaries)}")
    
    # Separate devices by type
    lights = []
    shades = []
    other_devices = []
    
    shade_types = ["Curtain", "Curtain3", "Blind Tilt", "Roller Shade"]
    
    if devices:
        for d in devices:
            state = d.get("state", {})
            name = d.get("name", "Unknown")
            device_type = d.get("deviceType", "")
            room_info = d.get("room", {})
            room_name = d.get("roomName") or (room_info.get("name") if room_info else None)
            
            # Check if it's a shade
            if device_type in shade_types or any(kw in name.lower() for kw in ["shade", "curtain", "blind", "persiana", "cortina"]):
                # Format shade state (brightness = position, 100 = open, 0 = closed)
                brightness = state.get("brightness", 0)
                if brightness >= 100:
                    state_str = "open"
                elif brightness <= 0:
                    state_str = "closed"
                else:
                    state_str = f"{brightness}% open"
                
                if room_name:
                    shades.append(f"{name} [{room_name}] ({state_str})")
                else:
                    shades.append(f"{name} ({state_str})")
            else:
                # Format light/device state
                is_on = state.get("on", False)
                brightness = state.get("brightness")
                
                if is_on and brightness is not None:
                    state_str = f"on, {brightness}%"
                elif is_on:
                    state_str = "on"
                else:
                    state_str = "off"
                
                if room_name:
                    lights.append(f"{name} [{room_name}] ({state_str})")
                else:
                    lights.append(f"{name} ({state_str})")
        
        if lights:
            lines.append(f"**Lights:** {', '.join(lights)}")
        
        if shades:
            lines.append(f"**Shades/Curtains:** {', '.join(shades)}")
        
        if not lights and not shades:
            lines.append("**Devices:** None found")
    else:
        lines.append("**Devices:** None found")
    
    # Add usage hints
    lines.append("")
    lines.append("Use control_room for room names, control_device for specific device names, control_shade for shades/curtains.")
    
    context = "\n".join(lines)
    
    # Cache the result
    _context_cache.set(context)
    
    logger.debug(f"Generated smart home context:\n{context}")
    
    return context


def clear_context_cache() -> None:
    """Clear the context cache (call after state changes)."""
    _context_cache.clear()
    _context_json_cache.clear()
