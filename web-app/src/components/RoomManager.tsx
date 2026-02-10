import { useState, useEffect, useMemo } from 'react';
import type { Room, Light } from '../types/devices';
import { Modal } from './ui/Modal';
import { CloseButton } from './ui/CloseButton';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { EmptyState, EmptyStateIcons } from './ui/EmptyState';
import { StatusDot } from './ui/StatusDot';
import { SearchInput } from './ui/SearchInput';
import { getRoomIcon } from '../utils/rooms';

interface RoomManagerProps {
  rooms: Room[];
  devices: Light[];
  onCreateRoom: (name: string) => Promise<Room>;
  onUpdateRoom: (id: string, data: { name?: string }) => Promise<Room>;
  onDeleteRoom: (id: string) => Promise<void>;
  onAssignDeviceToRoom: (roomId: string, deviceExternalId: string) => Promise<void>;
  onRemoveDeviceFromRoom: (roomId: string, deviceExternalId: string) => Promise<void>;
  onClose: () => void;
  initialRoomId?: string | null;
}

type ViewMode = 'list' | 'create' | 'edit';

export function RoomManager({
  rooms,
  devices,
  onCreateRoom,
  onUpdateRoom,
  onDeleteRoom,
  onAssignDeviceToRoom,
  onRemoveDeviceFromRoom,
  onClose,
  initialRoomId,
}: RoomManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialRoomId ? 'edit' : 'list');
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRoomId ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // Get devices in the selected room
  const roomDevices = useMemo(
    () => devices.filter((d) => d.roomId === selectedRoomId),
    [devices, selectedRoomId]
  );

  // Get devices by room for the list view
  const devicesByRoom = useMemo(() => {
    const map: Record<string, Light[]> = {};
    for (const room of rooms) {
      map[room.id] = devices.filter((d) => d.roomId === room.id);
    }
    return map;
  }, [rooms, devices]);

  // Filter devices by search
  const filteredDevices = devices.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset view when rooms change
  useEffect(() => {
    if (selectedRoomId && !rooms.find((r) => r.id === selectedRoomId)) {
      setSelectedRoomId(null);
      setViewMode('list');
    }
  }, [rooms, selectedRoomId]);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setIsLoading(true);
    try {
      const room = await onCreateRoom(newRoomName.trim());
      setNewRoomName('');
      setSelectedRoomId(room.id);
      setViewMode('edit');
    } catch (error) {
      console.error('Failed to create room:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    await onDeleteRoom(roomId);
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
      setViewMode('list');
    }
  };

  const handleToggleDevice = async (deviceId: string) => {
    if (!selectedRoomId) return;
    const isInRoom = roomDevices.some((d) => d.id === deviceId);
    if (isInRoom) {
      await onRemoveDeviceFromRoom(selectedRoomId, deviceId);
    } else {
      await onAssignDeviceToRoom(selectedRoomId, deviceId);
    }
  };

  const handleRenameRoom = async () => {
    if (!selectedRoomId || !editingName?.trim()) return;
    setIsLoading(true);
    try {
      await onUpdateRoom(selectedRoomId, { name: editingName.trim() });
      setEditingName(null);
    } catch (error) {
      console.error('Failed to rename room:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" contentClassName="sm:max-h-[85vh]">
        {/* Header */}
        <div className="p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">
              {viewMode === 'create' ? 'New Room' : viewMode === 'edit' ? selectedRoom?.name : 'Rooms'}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {viewMode === 'create'
                ? 'Organize your devices by location'
                : viewMode === 'edit'
                  ? `${roomDevices.length} device${roomDevices.length !== 1 ? 's' : ''}`
                  : `${rooms.length} room${rooms.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* List View */}
          {viewMode === 'list' && (
            <div className="flex-1 p-4 overflow-y-auto">
              {/* Create button */}
              <button
                onClick={() => setViewMode('create')}
                className="w-full mb-4 py-3 px-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-medium text-amber-400">New Room</span>
              </button>

              {/* Rooms list */}
              {rooms.length === 0 ? (
                <EmptyState
                  icon={EmptyStateIcons.rooms}
                  title="No rooms yet"
                  description="Create a room to organize your devices"
                />
              ) : (
                <div className="space-y-2">
                  {rooms.map((room) => {
                    const roomDeviceCount = devicesByRoom[room.id]?.length ?? 0;
                    return (
                      <div
                        key={room.id}
                        onClick={() => {
                          setSelectedRoomId(room.id);
                          setViewMode('edit');
                        }}
                        className="p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 cursor-pointer transition-all group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center text-lg shrink-0">
                            {getRoomIcon(room.name)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-white text-sm truncate">{room.name}</h3>
                            <p className="text-xs text-zinc-500">
                              {roomDeviceCount} device{roomDeviceCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRoom(room.id);
                            }}
                            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Create View */}
          {viewMode === 'create' && (
            <div className="flex-1 p-4 overflow-y-auto">
              <button
                onClick={() => setViewMode('list')}
                className="mb-4 flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">Back</span>
              </button>

              <div className="space-y-4">
                {/* Room name */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                    placeholder="e.g., Living Room"
                    className="w-full py-2.5 px-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition-all"
                    autoFocus
                  />
                </div>

                {/* Create button */}
                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading || !newRoomName.trim()}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-all"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <LoadingSpinner size="md" color="white" />
                      Creating...
                    </div>
                  ) : (
                    'Create Room'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Edit View */}
          {viewMode === 'edit' && selectedRoom && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Back button */}
              <div className="px-4 pt-3 shrink-0">
                <button
                  onClick={() => {
                    setSelectedRoomId(null);
                    setViewMode('list');
                    setEditingName(null);
                  }}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm">Back</span>
                </button>
              </div>

              {/* Room name (editable) */}
              <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
                {editingName !== null ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameRoom();
                        if (e.key === 'Escape') setEditingName(null);
                      }}
                      className="flex-1 py-1.5 px-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white font-medium outline-none focus:border-amber-500"
                      autoFocus
                    />
                    <button
                      onClick={handleRenameRoom}
                      disabled={isLoading || !editingName.trim()}
                      className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-600 text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditingName(null)}
                      className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingName(selectedRoom.name)}
                    className="flex items-center gap-2 text-left group"
                  >
                    <span className="text-lg">{getRoomIcon(selectedRoom.name)}</span>
                    <span className="font-semibold text-white text-lg">{selectedRoom.name}</span>
                    <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Search */}
              <SearchInput value={searchQuery} onChange={setSearchQuery} />

              {/* Device list */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="space-y-1.5">
                  {filteredDevices.map((device) => {
                    const isInRoom = device.roomId === selectedRoomId;
                    const isInOtherRoom = device.roomId && device.roomId !== selectedRoomId;
                    return (
                      <button
                        key={device.id}
                        onClick={() => handleToggleDevice(device.id)}
                        className={`w-full p-2.5 rounded-lg flex items-center justify-between transition-all ${
                          isInRoom
                            ? 'bg-amber-500/15 border border-amber-500/30'
                            : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <StatusDot connected={device.reachable} />
                          <div className="text-left min-w-0">
                            <p className="font-medium text-white text-sm truncate">{device.name}</p>
                            <p className="text-xs text-zinc-500 truncate">
                              {isInOtherRoom && device.roomName ? (
                                <span className="text-amber-400">In {device.roomName}</span>
                              ) : (
                                device.type === 'hue' ? 'Philips Hue' : device.type === 'nanoleaf' ? 'Nanoleaf' : 'SwitchBot'
                              )}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                            isInRoom ? 'bg-amber-500 text-white' : 'bg-zinc-700 text-zinc-500'
                          }`}
                        >
                          {isInRoom && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {filteredDevices.length === 0 && (
                    <p className="text-center text-zinc-500 py-6 text-sm">No devices found</p>
                  )}
                </div>
              </div>

              {/* Delete room button */}
              <div className="p-3 border-t border-white/[0.06] shrink-0">
                <button
                  onClick={() => handleDeleteRoom(selectedRoom.id)}
                  className="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Room
                </button>
              </div>
            </div>
          )}
        </div>
    </Modal>
  );
}
