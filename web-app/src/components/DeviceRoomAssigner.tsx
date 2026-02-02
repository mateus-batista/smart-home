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
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with device info */}
        <div className="p-6 bg-gradient-to-br from-zinc-800 to-zinc-900">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-700 flex items-center justify-center">
              {device.type === 'hue' ? (
                <svg className="w-7 h-7 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm2 15H10v-1h4v1zm0-2H10v-1h4v1zm1.5-4.59l-.5.34V12h-6v-1.25l-.5-.34A4.996 4.996 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.62-.78 3.14-2.5 4.41z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 19h20L12 2zm0 4l6.5 11h-13L12 6z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{device.name}</h2>
              <p className="text-sm text-zinc-400 capitalize">
                {device.type === 'hue' ? 'Philips Hue' : 'Nanoleaf'}
              </p>
            </div>
            <CloseButton onClick={onClose} />
          </div>
        </div>

        {/* Current room */}
        {device.roomId && device.roomName && (
          <div className="px-6 py-4 border-b border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Current Room</p>
            <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getRoomIcon(device.roomName)}</span>
                <span className="font-medium text-white">{device.roomName}</span>
              </div>
              <button
                onClick={handleRemove}
                disabled={isLoading === 'remove'}
                className="py-1.5 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
        <div className="p-6">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            {device.roomId ? 'Move to Another Room' : 'Assign to Room'}
          </p>
          
          {availableRooms.length === 0 ? (
            <EmptyState
              icon={EmptyStateIcons.rooms}
              title="No other rooms available"
              description="Create a room from the main view"
            />
          ) : (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {availableRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleAssign(room.id)}
                  disabled={isLoading !== null}
                  className="w-full p-4 bg-zinc-800 hover:bg-zinc-700 disabled:hover:bg-zinc-800 rounded-xl text-left transition-all flex items-center justify-between group disabled:opacity-75"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getRoomIcon(room.name)}</span>
                    <span className="font-medium text-white group-hover:text-green-400 transition-colors">
                      {room.name}
                    </span>
                  </div>
                  {isLoading === room.id ? (
                    <LoadingSpinner size="md" color="green" />
                  ) : (
                    <svg 
                      className="w-5 h-5 text-zinc-600 group-hover:text-green-400 group-hover:translate-x-1 transition-all" 
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
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium text-zinc-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
