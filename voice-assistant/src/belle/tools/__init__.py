"""Tool definitions for Belle's function calling capabilities."""

from belle.tools.devices import (
    DEVICE_TOOLS,
    control_device,
    control_shade,
    get_all_devices,
    get_device_status,
)
from belle.tools.groups import (
    GROUP_TOOLS,
    control_group,
    get_all_groups,
)
from belle.tools.rooms import (
    ROOM_TOOLS,
    control_room,
    control_room_shades,
    get_all_rooms,
)

# All available tools for the LLM
ALL_TOOLS = DEVICE_TOOLS + ROOM_TOOLS + GROUP_TOOLS

__all__ = [
    "control_device",
    "control_shade",
    "get_all_devices",
    "get_device_status",
    "control_room",
    "control_room_shades",
    "get_all_rooms",
    "control_group",
    "get_all_groups",
    "ALL_TOOLS",
    "DEVICE_TOOLS",
    "ROOM_TOOLS",
    "GROUP_TOOLS",
]
