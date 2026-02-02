import { useState, useRef, useEffect } from 'react';
import type { Room } from '../types/devices';
import { getRoomIcon } from '../utils/rooms';

interface RoomSelectorProps {
  rooms: Room[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  onCreateRoom: (name: string) => Promise<Room>;
  onDeleteRoom: (id: string) => Promise<void>;
}

export function RoomSelector({
  rooms,
  selectedRoomId,
  onSelectRoom,
  onCreateRoom,
  onDeleteRoom,
}: RoomSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showManageMenu, setShowManageMenu] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowManageMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreate = async () => {
    if (!newRoomName.trim()) return;
    setIsLoading(true);
    try {
      await onCreateRoom(newRoomName.trim());
      setNewRoomName('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create room:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (room: Room) => {
    setShowManageMenu(null);
    await onDeleteRoom(room.id);
    if (selectedRoomId === room.id) {
      onSelectRoom(null);
    }
  };

  return (
    <div className="mb-6">
      {/* Scrollable room tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {/* All tab */}
        <button
          onClick={() => onSelectRoom(null)}
          className={`flex-shrink-0 flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
            selectedRoomId === null
              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25'
              : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
          }`}
        >
          <span className="text-base">🏡</span>
          <span>All Devices</span>
        </button>

        {/* Unassigned tab */}
        <button
          onClick={() => onSelectRoom('unassigned')}
          className={`flex-shrink-0 flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
            selectedRoomId === 'unassigned'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25'
              : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
          }`}
        >
          <span className="text-base">📦</span>
          <span>Unassigned</span>
        </button>

        {/* Divider */}
        {rooms.length > 0 && (
          <div className="flex-shrink-0 w-px h-8 bg-zinc-700" />
        )}

        {/* Room tabs */}
        {rooms.map((room) => (
          <div key={room.id} className="relative flex-shrink-0">
            <button
              onClick={() => onSelectRoom(room.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowManageMenu(room.id);
              }}
              className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                selectedRoomId === room.id
                  ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <span className="text-base">{getRoomIcon(room.name)}</span>
              <span>{room.name}</span>
            </button>

            {/* Context menu */}
            {showManageMenu === room.id && (
              <div
                ref={menuRef}
                className="absolute top-full left-0 mt-2 py-1 bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 z-20 min-w-[120px]"
              >
                <button
                  onClick={() => handleDelete(room)}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add room button / input */}
        {isCreating ? (
          <div className="flex-shrink-0 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewRoomName('');
                }
              }}
              placeholder="Room name..."
              className="py-2.5 px-4 bg-zinc-800 border border-zinc-600 rounded-xl text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 w-36 transition-all"
            />
            <button
              onClick={handleCreate}
              disabled={isLoading || !newRoomName.trim()}
              className="p-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:hover:bg-green-500 rounded-xl transition-colors"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewRoomName('');
              }}
              className="p-2.5 bg-zinc-700 hover:bg-zinc-600 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="flex-shrink-0 flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-dashed border-zinc-700 hover:border-zinc-500 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Room</span>
          </button>
        )}
      </div>

      {/* Hint text */}
      <p className="text-xs text-zinc-500 mt-2">
        Right-click a room to delete it
      </p>
    </div>
  );
}
