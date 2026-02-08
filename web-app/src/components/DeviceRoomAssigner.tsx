import { useState } from 'react';
import type { Room, Light } from '../types/devices';
import { getRoomIcon } from '../utils/rooms';
import { CloseButton } from './ui/CloseButton';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { EmptyState, EmptyStateIcons } from './ui/EmptyState';

interface DeviceRoomAssignerProps {
  device: Light;
  rooms: Room[];
  onAssign: (roomId: string) => Promise<void>;
  onRemove: (roomId: string) => Promise<void>;
  onClose: () => void;
}

export function DeviceRoomAssigner({
  device,
  rooms,
  onAssign,
  onRemove,
  onClose,
}: DeviceRoomAssignerProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleAssign = async (roomId: string) => {
    setIsLoading(roomId);
    try {
      await onAssign(roomId);
      onClose();
    } catch (error) {
      console.error('Failed to assign room:', error);
    } finally {
      setIsLoading(null);
    }
  };

  const handleRemove = async () => {
    if (!device.roomId) return;
    setIsLoading('remove');
    try {
      await onRemove(device.roomId);
      onClose();
    } catch (error) {
      console.error('Failed to remove from room:', error);
    } finally {
      setIsLoading(null);
    }
  };

  const availableRooms = rooms.filter((room) => room.id !== device.roomId);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-surface w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl overflow-hidden max-h-[90vh] sm:max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">{device.name}</h2>
            <p className="text-xs text-zinc-500">
              {device.type === 'hue' ? 'Philips Hue' : device.type === 'nanoleaf' ? 'Nanoleaf' : 'SwitchBot'}
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {/* Current room */}
        {device.roomId && device.roomName && (
          <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
            <p className="text-xs font-medium text-zinc-500 mb-2">Current Room</p>
            <div className="flex items-center justify-between p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getRoomIcon(device.roomName)}</span>
                <span className="font-medium text-white text-sm">{device.roomName}</span>
              </div>
              <button
                onClick={handleRemove}
                disabled={isLoading === 'remove'}
                className="py-1 px-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isLoading === 'remove' ? (
                  <LoadingSpinner size="sm" color="red" />
                ) : (
                  'Remove'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Room selection */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs font-medium text-zinc-500 mb-2">
            {device.roomId ? 'Move to' : 'Assign to Room'}
          </p>

          {availableRooms.length === 0 ? (
            <EmptyState
              icon={EmptyStateIcons.rooms}
              title="No rooms available"
              description="Create a room first"
            />
          ) : (
            <div className="space-y-1.5">
              {availableRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleAssign(room.id)}
                  disabled={isLoading !== null}
                  className="w-full p-3 bg-zinc-800 hover:bg-zinc-700 disabled:hover:bg-zinc-800 rounded-xl text-left transition-all flex items-center justify-between group disabled:opacity-75"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{getRoomIcon(room.name)}</span>
                    <span className="font-medium text-white text-sm group-hover:text-amber-400 transition-colors">
                      {room.name}
                    </span>
                  </div>
                  {isLoading === room.id ? (
                    <LoadingSpinner size="sm" color="blue" />
                  ) : (
                    <svg
                      className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
