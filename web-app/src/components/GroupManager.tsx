import { useState, useEffect, useMemo } from 'react';
import type { DeviceGroup, Room, Light } from '../types/devices';
import { CloseButton } from './ui/CloseButton';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { EmptyState, EmptyStateIcons } from './ui/EmptyState';
import { StatusDot } from './ui/StatusDot';
import { DeviceControlItem } from './ui/DeviceControlItem';

interface GroupManagerProps {
  groups: DeviceGroup[];
  rooms: Room[];
  devices: Light[];
  onCreateGroup: (name: string, roomId?: string | null) => Promise<DeviceGroup>;
  onUpdateGroup: (id: string, data: { name?: string; roomId?: string | null }) => Promise<DeviceGroup>;
  onDeleteGroup: (id: string) => Promise<void>;
  onAddDeviceToGroup: (groupId: string, deviceExternalId: string) => Promise<void>;
  onRemoveDeviceFromGroup: (groupId: string, deviceExternalId: string) => Promise<void>;
  onUpdateDevice: (deviceId: string, state: Partial<Light['state']>) => Promise<void>;
  onClose: () => void;
  initialGroupId?: string | null;
}

type ViewMode = 'list' | 'create' | 'edit';
type EditTab = 'controls' | 'devices';

export function GroupManager({
  groups,
  rooms,
  devices,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAddDeviceToGroup,
  onRemoveDeviceFromGroup,
  onUpdateDevice,
  onClose,
  initialGroupId,
}: GroupManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialGroupId ? 'edit' : 'list');
  const [editTab, setEditTab] = useState<EditTab>('controls');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupRoomId, setNewGroupRoomId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [pendingBrightness, setPendingBrightness] = useState<Record<string, number>>({});

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const groupDeviceIds = new Set(selectedGroup?.devices?.map((d) => d.device.externalId) ?? []);

  // Get actual device objects in the group
  const groupDevices = useMemo(() => 
    devices.filter(d => groupDeviceIds.has(d.id)),
    [devices, groupDeviceIds]
  );

  // Filter devices by search
  const filteredDevices = devices.filter(
    (d) => d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset view when groups change
  useEffect(() => {
    if (selectedGroupId && !groups.find((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(null);
      setViewMode('list');
    }
  }, [groups, selectedGroupId]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsLoading(true);
    try {
      const group = await onCreateGroup(newGroupName.trim(), newGroupRoomId);
      setNewGroupName('');
      setNewGroupRoomId(null);
      setSelectedGroupId(group.id);
      setViewMode('edit');
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    await onDeleteGroup(groupId);
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
      setViewMode('list');
    }
  };

  const handleToggleDevice = async (deviceId: string) => {
    if (!selectedGroupId) return;
    const isInGroup = groupDeviceIds.has(deviceId);
    if (isInGroup) {
      await onRemoveDeviceFromGroup(selectedGroupId, deviceId);
    } else {
      await onAddDeviceToGroup(selectedGroupId, deviceId);
    }
  };

  const handleRenameGroup = async () => {
    if (!selectedGroupId || !editingName?.trim()) return;
    setIsLoading(true);
    try {
      await onUpdateGroup(selectedGroupId, { name: editingName.trim() });
      setEditingName(null);
    } catch (error) {
      console.error('Failed to rename group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeviceToggle = async (device: Light) => {
    await onUpdateDevice(device.id, { on: !device.state.on });
  };

  const handleDeviceBrightnessChange = (deviceId: string, brightness: number) => {
    setPendingBrightness((prev) => ({ ...prev, [deviceId]: brightness }));
  };

  const handleDeviceBrightnessCommit = async (deviceId: string, brightness: number) => {
    await onUpdateDevice(deviceId, { brightness, on: brightness > 0 });
    setPendingBrightness((prev) => {
      const next = { ...prev };
      delete next[deviceId];
      return next;
    });
  };

  const handleShadePreset = async (deviceId: string, brightness: number) => {
    await onUpdateDevice(deviceId, { brightness, on: brightness > 0 });
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-zinc-800">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-linear-to-r from-zinc-900 to-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-white">
              {viewMode === 'create' ? 'Create Group' : viewMode === 'edit' ? 'Edit Group' : 'Device Groups'}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              {viewMode === 'create'
                ? 'Create a new group to control multiple devices together'
                : viewMode === 'edit'
                ? `Managing "${selectedGroup?.name}"`
                : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
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
                className="w-full mb-6 py-4 px-6 bg-linear-to-r from-green-500/10 to-emerald-500/10 hover:from-green-500/20 hover:to-emerald-500/20 border border-green-500/30 hover:border-green-500/50 rounded-2xl transition-all flex items-center justify-center gap-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="font-medium text-green-400">Create New Group</span>
              </button>

              {/* Groups grid */}
              {groups.length === 0 ? (
                <EmptyState
                  icon={EmptyStateIcons.groups}
                  title="No groups yet"
                  description="Create a group to control multiple devices at once"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {groups.map((group) => {
                    const deviceCount = group.devices?.length ?? 0;
                    return (
                      <div
                        key={group.id}
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setViewMode('edit');
                        }}
                        className="p-4 rounded-2xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 cursor-pointer transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="font-semibold text-white">{group.name}</h3>
                              <p className="text-xs text-zinc-500">
                                {deviceCount} device{deviceCount !== 1 ? 's' : ''}
                                {group.room && ` • ${group.room.name}`}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGroup(group.id);
                            }}
                            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        {/* Device preview */}
                        {deviceCount > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {group.devices?.slice(0, 4).map((d, i) => (
                              <span key={i} className="px-2 py-0.5 bg-zinc-700 rounded text-xs text-zinc-400 truncate max-w-[100px]">
                                {d.device.name}
                              </span>
                            ))}
                            {deviceCount > 4 && (
                              <span className="px-2 py-0.5 bg-zinc-700/50 rounded text-xs text-zinc-500">
                                +{deviceCount - 4}
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
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">Back to groups</span>
              </button>

              <div className="max-w-md mx-auto space-y-6">
                {/* Group name */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Group Name</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                    placeholder="e.g., Kitchen Table Lights"
                    className="w-full py-3 px-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                    autoFocus
                  />
                </div>

                {/* Room selection */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Room (optional)</label>
                  <select
                    value={newGroupRoomId ?? ''}
                    onChange={(e) => setNewGroupRoomId(e.target.value || null)}
                    className="w-full py-3 px-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">No room assigned</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Create button */}
                <button
                  onClick={handleCreateGroup}
                  disabled={isLoading || !newGroupName.trim()}
                  className="w-full py-4 bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 disabled:from-zinc-600 disabled:to-zinc-700 disabled:cursor-not-allowed rounded-xl font-semibold text-white shadow-lg shadow-green-500/25 disabled:shadow-none transition-all"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <LoadingSpinner size="md" color="white" />
                      Creating...
                    </div>
                  ) : (
                    'Create Group'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Edit View */}
          {viewMode === 'edit' && selectedGroup && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Back button and group info */}
              <div className="p-4 border-b border-zinc-800">
                <button
                  onClick={() => {
                    setSelectedGroupId(null);
                    setViewMode('list');
                    setEditingName(null);
                    setEditTab('controls');
                  }}
                  className="mb-3 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm">Back to groups</span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingName !== null ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameGroup()}
                          className="flex-1 py-1.5 px-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-lg font-semibold outline-none focus:border-purple-500"
                          autoFocus
                        />
                        <button
                          onClick={handleRenameGroup}
                          disabled={isLoading || !editingName.trim()}
                          className="p-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 disabled:bg-zinc-600 text-white transition-colors"
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
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white text-lg truncate">{selectedGroup.name}</h3>
                        <button
                          onClick={() => setEditingName(selectedGroup.name)}
                          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors"
                          title="Rename group"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-zinc-400">
                      {selectedGroup.devices?.length ?? 0} device{(selectedGroup.devices?.length ?? 0) !== 1 ? 's' : ''} in group
                      {selectedGroup.room && ` • ${selectedGroup.room.name}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-zinc-800">
                <button
                  onClick={() => setEditTab('controls')}
                  className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                    editTab === 'controls'
                      ? 'text-purple-400 border-b-2 border-purple-400'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Controls
                </button>
                <button
                  onClick={() => setEditTab('devices')}
                  className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                    editTab === 'devices'
                      ? 'text-purple-400 border-b-2 border-purple-400'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Devices
                </button>
              </div>

              {/* Controls Tab */}
              {editTab === 'controls' && (
                <div className="flex-1 overflow-y-auto p-4">
                  {groupDevices.length === 0 ? (
                    <EmptyState
                      icon={EmptyStateIcons.devices}
                      title="No devices in group"
                      description="Switch to the Devices tab to add some"
                    />
                  ) : (
                    <div className="space-y-3">
                      {groupDevices.map((device) => (
                        <DeviceControlItem
                          key={device.id}
                          device={device}
                          pendingBrightness={pendingBrightness[device.id]}
                          onToggle={handleDeviceToggle}
                          onBrightnessChange={handleDeviceBrightnessChange}
                          onBrightnessCommit={handleDeviceBrightnessCommit}
                          onShadePreset={handleShadePreset}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Devices Tab */}
              {editTab === 'devices' && (
                <>
                  {/* Search */}
                  <div className="p-4 border-b border-zinc-800">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search devices..."
                        className="w-full py-2.5 pl-10 pr-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Device list */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <p className="text-xs text-zinc-500 mb-3">Click to add or remove devices from this group</p>
                    <div className="space-y-2">
                      {filteredDevices.map((device) => {
                        const isInGroup = groupDeviceIds.has(device.id);
                        return (
                          <button
                            key={device.id}
                            onClick={() => handleToggleDevice(device.id)}
                            className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${
                              isInGroup
                                ? 'bg-purple-500/20 border border-purple-500/50 hover:bg-purple-500/30'
                                : 'bg-zinc-800/50 border border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <StatusDot connected={device.reachable} />
                              <div className="text-left">
                                <p className="font-medium text-white">{device.name}</p>
                                <p className="text-xs text-zinc-500 capitalize">
                                  {device.type === 'hue' ? 'Philips Hue' : device.type === 'nanoleaf' ? 'Nanoleaf' : 'SwitchBot'}
                                  {device.roomName && ` • ${device.roomName}`}
                                </p>
                              </div>
                            </div>
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                isInGroup
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-zinc-700 text-zinc-400'
                              }`}
                            >
                              {isInGroup ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
