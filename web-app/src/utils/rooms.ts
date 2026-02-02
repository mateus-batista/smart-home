// Room icons mapping - shared between RoomSelector and DeviceRoomAssigner
export const roomIcons: Record<string, string> = {
  kitchen: '🍳',
  bedroom: '🛏️',
  'living room': '🛋️',
  bathroom: '🚿',
  office: '💼',
  garage: '🚗',
  garden: '🌿',
  balcony: '🌅',
  dining: '🍽️',
};

export function getRoomIcon(name: string): string {
  const lowerName = name.toLowerCase();
  for (const [key, icon] of Object.entries(roomIcons)) {
    if (lowerName.includes(key)) return icon;
  }
  return '🏠';
}
