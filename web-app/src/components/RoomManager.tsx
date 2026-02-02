import { useState, useEffect, useMemo } from 'react';
import type { Room, Light } from '../types/devices';
import { CloseButton } from './ui/CloseButton';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { EmptyState, EmptyStateIcons } from './ui/EmptyState';
import { StatusDot } from './ui/StatusDot';
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
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-zinc-800">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-linear-to-r from-zinc-900 to-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-white">
              {viewMode === 'create'
                ? 'Create Room'
                : viewMode === 'edit'
                ? 'Edit Room'
                : 'Rooms'}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              {viewMode === 'create'
                ? 'Create a new room to organize your devices'
                : viewMode === 'edit'
                ? `Managing "${selectedRoom?.name}"`
                : `${rooms.length} room${rooms.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* List View */}
          {viewMode === 'list' && (
            <div className="flex-1 p-6 overflow-y-auto">
              {/* Create button */}
              <button
                onClick={() => setViewMode('create')}
                className="w-full mb-6 py-4 px-6 bg-linear-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border border-blue-500/30 hover:border-blue-500/50 rounded-2xl transition-all flex items-center justify-center gap-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg
                    className="w-5 h-5 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <span className="font-medium text-blue-400">Create New Room</span>
              </button>

              {/* Rooms grid */}
              {rooms.length === 0 ? (
                <EmptyState
                  icon={EmptyStateIcons.rooms}
                  title="No rooms yet"
                  description="Create a room to organize your devices"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {rooms.map((room) => {
                    const roomDeviceCount = devicesByRoom[room.id]?.length ?? 0;
                    return (
                      <div
                        key={room.id}
                        onClick={() => {
                          setSelectedRoomId(room.id);
                          setViewMode('edit');
                        }}
                        className="p-4 rounded-2xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 cursor-pointer transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-xl">
                              {getRoomIcon(room.name)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-white">{room.name}</h3>
                              <p className="text-xs text-zinc-500">
                                {roomDeviceCount} device{roomDeviceCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRoom(room.id);
                            }}
                            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                        {/* Device preview */}
                        {roomDeviceCount > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {devicesByRoom[room.id]?.slice(0, 4).map((d) => (
                              <span
                                key={d.id}
                                className="px-2 py-0.5 bg-zinc-700 rounded text-xs text-zinc-400 truncate max-w-[100px]"
                              >
                                {d.name}
                              </span>
                            ))}
                            {roomDeviceCount > 4 && (
                              <span className="px-2 py-0.5 bg-zinc-700/50 rounded text-xs text-zinc-500">
                                +{roomDeviceCount - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Create View */}
          {viewMode === 'create' && (
            <div className="flex-1 p-6 overflow-y-auto">
              <button
                onClick={() => setViewMode('list')}
                className="mb-6 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span className="text-sm">Back to rooms</span>
              </button>

              <div className="max-w-md mx-auto space-y-6">
                {/* Room name */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Room Name
                  </label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                    placeholder="e.g., Living Room, Bedroom, Kitchen"
                    className="w-full py-3 px-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    autoFocus
                  />
                </div>

                {/* Create button */}
                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading || !newRoomName.trim()}
                  className="w-full py-4 bg-linear-to-r from-blue-500 to-cyan-600 hover:from-blue-400 hover:to-cyan-500 disabled:from-zinc-600 disabled:to-zinc-700 disabled:cursor-not-allowed rounded-xl font-semibold text-white shadow-lg shadow-blue-500/25 disabled:shadow-none transition-all"
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
              {/* Back button and room info */}
              <div className="p-4 border-b border-zinc-800">
                <button
                  onClick={() => {
                    setSelectedRoomId(null);
                    setViewMode('list');
                    setEditingName(null);
                  }}
                  className="mb-3 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span className="text-sm">Back to rooms</span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0 text-2xl">
                    {getRoomIcon(selectedRoom.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingName !== null ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameRoom()}
                          className="flex-1 py-1.5 px-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-lg font-semibold outline-none focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={handleRenameRoom}
                          disabled={isLoading || !editingName.trim()}
                          className="p-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:bg-zinc-600 text-white transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => setEditingName(null)}
                          className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-400 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white text-lg truncate">
                          {selectedRoom.name}
                        </h3>
                        <button
                          onClick={() => setEditingName(selectedRoom.name)}
                          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors"
                          title="Rename room"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-zinc-400">
                      {roomDevices.length} device{roomDevices.length !== 1 ? 's' : ''} in room
                    </p>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-zinc-800">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search devices..."
                    className="w-full py-2.5 pl-10 pr-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Device list */}
              <div className="flex-1 overflow-y-auto p-4">
                <p className="text-xs text-zinc-500 mb-3">
                  Click to add or remove devices from this room
                </p>
                <div className="space-y-2">
                  {filteredDevices.map((device) => {
                    const isInRoom = device.roomId === selectedRoomId;
                    const isInOtherRoom = device.roomId && device.roomId !== selectedRoomId;
                    return (
                      <button
                        key={device.id}
                        onClick={() => handleToggleDevice(device.id)}
                        className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${
                          isInRoom
                            ? 'bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500/30'
                            : 'bg-zinc-800/50 border border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <StatusDot connected={device.reachable} />
                          <div className="text-left">
                            <p className="font-medium text-white">{device.name}</p>
                            <p className="text-xs text-zinc-500 capitalize">
                              {device.type === 'hue'
                                ? 'Philips Hue'
                                : device.type === 'nanoleaf'
                                ? 'Nanoleaf'
                                : 'SwitchBot'}
                              {isInOtherRoom && device.roomName && (
                                <span className="text-amber-400"> • In {device.roomName}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            isInRoom ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-400'
                          }`}
                        >
                          {isInRoom ? (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {filteredDevices.length === 0 && (
                    <p className="text-center text-zinc-500 py-8">No devices found</p>
                  )}
                </div>
              </div>

              {/* Delete room button */}
              <div className="p-4 border-t border-zinc-800">
                <button
                  onClick={() => handleDeleteRoom(selectedRoom.id)}
                  className="w-full py-3 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-xl text-red-400 font-medium transition-all flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Room
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
