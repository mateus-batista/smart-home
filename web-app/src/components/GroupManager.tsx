import { useState, useEffect, useMemo } from 'react';
import type { DeviceGroup, Room, Light } from '../types/devices';
import { isShadeDevice } from '../types/devices';
import { CloseButton } from './ui/CloseButton';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { EmptyState, EmptyStateIcons } from './ui/EmptyState';
import { StatusDot } from './ui/StatusDot';
import { ToggleSwitch } from './ui/ToggleSwitch';
import { ShadeOpenCloseButtons } from './ui/ShadeOpenCloseButtons';
import { InlineSlider } from './ui/Slider';
import { LightControl } from './LightControl';
import { ShadeControl } from './ShadeControl';

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
  onSetGroupState: (groupId: string, state: { on?: boolean; brightness?: number }) => Promise<unknown>;
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
  onSetGroupState,
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
  const [pendingGroupBrightness, setPendingGroupBrightness] = useState<number | null>(null);
  const [isGroupControlling, setIsGroupControlling] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Light | null>(null);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const groupDeviceIds = new Set(selectedGroup?.devices?.map((d) => d.device.externalId) ?? []);

  // Get actual device objects in the group
  const groupDevices = useMemo(() =>
    devices.filter(d => groupDeviceIds.has(d.id)),
    [devices, groupDeviceIds]
  );

  // Check if this is a shade group (majority of devices are shades)
  const isShadeGroup = useMemo(() => {
    if (groupDevices.length === 0) return false;
    const shadeCount = groupDevices.filter(d => isShadeDevice(d)).length;
    return shadeCount > groupDevices.length / 2;
  }, [groupDevices]);

  // Derive group state from actual devices
  const groupState = useMemo(() => {
    if (groupDevices.length === 0) {
      return { isOn: false, anyOn: false, brightness: 0 };
    }

    const onDevices = groupDevices.filter(d => d.state.on && d.reachable);
    const anyOn = onDevices.length > 0;
    const reachableDevices = groupDevices.filter(d => d.reachable);
    const avgBrightness = reachableDevices.length > 0
      ? Math.round(reachableDevices.reduce((sum, d) => sum + d.state.brightness, 0) / reachableDevices.length)
      : 0;

    return { isOn: anyOn, anyOn, brightness: avgBrightness };
  }, [groupDevices]);

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

  // Device modal handlers
  const handleDeviceUpdate = async (state: Partial<Light['state']>) => {
    if (selectedDevice) {
      await onUpdateDevice(selectedDevice.id, state);
      // Update local selected device state for immediate feedback
      setSelectedDevice((prev) =>
        prev ? { ...prev, state: { ...prev.state, ...state } } : null
      );
    }
  };

  // Group-level control handlers
  const handleGroupToggle = async () => {
    if (!selectedGroupId || groupDevices.length === 0) return;
    setIsGroupControlling(true);
    try {
      await onSetGroupState(selectedGroupId, { on: !groupState.anyOn });
    } finally {
      setTimeout(() => setIsGroupControlling(false), 500);
    }
  };

  const handleGroupOpen = async () => {
    if (!selectedGroupId || groupDevices.length === 0) return;
    setIsGroupControlling(true);
    try {
      await onSetGroupState(selectedGroupId, { brightness: 100 });
    } finally {
      setTimeout(() => setIsGroupControlling(false), 500);
    }
  };

  const handleGroupClose = async () => {
    if (!selectedGroupId || groupDevices.length === 0) return;
    setIsGroupControlling(true);
    try {
      await onSetGroupState(selectedGroupId, { brightness: 0 });
    } finally {
      setTimeout(() => setIsGroupControlling(false), 500);
    }
  };

  const handleGroupBrightnessChange = (value: number) => {
    setPendingGroupBrightness(value);
  };

  const handleGroupBrightnessCommit = async () => {
    if (!selectedGroupId || pendingGroupBrightness === null) return;
    setIsGroupControlling(true);
    try {
      await onSetGroupState(selectedGroupId, { brightness: pendingGroupBrightness });
    } finally {
      setPendingGroupBrightness(null);
      setTimeout(() => setIsGroupControlling(false), 500);
    }
  };

  const displayGroupBrightness = pendingGroupBrightness ?? groupState.brightness;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-zinc-900 w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col shadow-2xl border-t sm:border border-zinc-800">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">
              {viewMode === 'create' ? 'New Group' : viewMode === 'edit' ? selectedGroup?.name : 'Groups'}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {viewMode === 'create'
                ? 'Control multiple devices together'
                : viewMode === 'edit'
                  ? `${selectedGroup?.devices?.length ?? 0} devices${selectedGroup?.room ? ` • ${selectedGroup.room.name}` : ''}`
                  : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
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
                className="w-full mb-4 py-3 px-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-medium text-green-400">New Group</span>
              </button>

              {/* Groups list */}
              {groups.length === 0 ? (
                <EmptyState
                  icon={EmptyStateIcons.groups}
                  title="No groups yet"
                  description="Create a group to control multiple devices at once"
                />
              ) : (
                <div className="space-y-2">
                  {groups.map((group) => {
                    const deviceCount = group.devices?.length ?? 0;
                    return (
                      <div
                        key={group.id}
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setViewMode('edit');
                        }}
                        className="p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600 cursor-pointer transition-all group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-white text-sm truncate">{group.name}</h3>
                            <p className="text-xs text-zinc-500">
                              {deviceCount} device{deviceCount !== 1 ? 's' : ''}
                              {group.room && ` • ${group.room.name}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
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
                {/* Group name */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                    placeholder="e.g., Kitchen Lights"
                    className="w-full py-2.5 px-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 outline-none focus:border-green-500 transition-all"
                    autoFocus
                  />
                </div>

                {/* Room selection */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Room (optional)</label>
                  <select
                    value={newGroupRoomId ?? ''}
                    onChange={(e) => setNewGroupRoomId(e.target.value || null)}
                    className="w-full py-2.5 px-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:border-green-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">No room</option>
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
                  className="w-full py-3 bg-green-500 hover:bg-green-400 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-all"
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
              {/* Back button */}
              <div className="px-4 pt-3 shrink-0">
                <button
                  onClick={() => {
                    setSelectedGroupId(null);
                    setViewMode('list');
                    setEditingName(null);
                    setEditTab('controls');
                  }}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm">Back</span>
                </button>
              </div>

              {/* Group name (editable) */}
              <div className="px-4 py-3 shrink-0">
                {editingName !== null ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameGroup();
                        if (e.key === 'Escape') setEditingName(null);
                      }}
                      className="flex-1 py-1.5 px-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white font-medium outline-none focus:border-purple-500"
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
                  <button
                    onClick={() => setEditingName(selectedGroup.name)}
                    className="flex items-center gap-2 text-left group"
                  >
                    <span className="font-semibold text-white text-lg">{selectedGroup.name}</span>
                    <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Group-level controls */}
              {groupDevices.length > 0 && (
                <div className="px-4 pb-4 space-y-3 border-b border-zinc-800 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">All {isShadeGroup ? 'Shades' : 'Lights'}</span>
                    {isShadeGroup ? (
                      <ShadeOpenCloseButtons
                        visualOpenness={displayGroupBrightness}
                        onOpen={handleGroupOpen}
                        onClose={handleGroupClose}
                        disabled={groupDevices.length === 0}
                        loading={isGroupControlling}
                        size="sm"
                      />
                    ) : (
                      <ToggleSwitch
                        on={groupState.anyOn}
                        onChange={handleGroupToggle}
                        disabled={groupDevices.length === 0}
                        loading={isGroupControlling}
                      />
                    )}
                  </div>
                  <InlineSlider
                    value={displayGroupBrightness}
                    onChange={handleGroupBrightnessChange}
                    onCommit={handleGroupBrightnessCommit}
                    min={0}
                    max={100}
                    disabled={groupDevices.length === 0}
                    label={isShadeGroup ? 'Position' : 'Brightness'}
                    valueDisplay={`${displayGroupBrightness}%`}
                    fillColor={isShadeGroup ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.4)'}
                  />
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-zinc-800 shrink-0">
                <button
                  onClick={() => setEditTab('controls')}
                  className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${
                    editTab === 'controls'
                      ? 'text-white border-b-2 border-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Individual
                </button>
                <button
                  onClick={() => setEditTab('devices')}
                  className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${
                    editTab === 'devices'
                      ? 'text-white border-b-2 border-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Manage
                </button>
              </div>

              {/* Controls Tab */}
              {editTab === 'controls' && (
                <div className="flex-1 overflow-y-auto p-4">
                  {groupDevices.length === 0 ? (
                    <EmptyState
                      icon={EmptyStateIcons.devices}
                      title="No devices"
                      description="Go to Manage tab to add devices"
                    />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {groupDevices.map((device) => {
                        const isShade = isShadeDevice(device);
                        return (
                          <button
                            key={device.id}
                            onClick={() => setSelectedDevice(device)}
                            className={`p-3 rounded-xl text-left transition-all ${
                              device.state.on && device.reachable
                                ? 'bg-zinc-800 border border-zinc-600'
                                : 'bg-zinc-800/50 border border-zinc-700/50'
                            } ${!device.reachable ? 'opacity-60' : 'hover:bg-zinc-700/80'}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <StatusDot connected={device.reachable} />
                              <span className="text-xs text-zinc-500">
                                {isShade ? 'Shade' : 'Light'}
                              </span>
                            </div>
                            <p className="font-medium text-white text-sm truncate">{device.name}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {device.state.on ? `${device.state.brightness}%` : 'Off'}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Devices Tab */}
              {editTab === 'devices' && (
                <>
                  {/* Search */}
                  <div className="p-3 border-b border-zinc-800 shrink-0">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full py-2 pl-9 pr-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Device list */}
                  <div className="flex-1 overflow-y-auto p-3">
                    <div className="space-y-1.5">
                      {filteredDevices.map((device) => {
                        const isInGroup = groupDeviceIds.has(device.id);
                        return (
                          <button
                            key={device.id}
                            onClick={() => handleToggleDevice(device.id)}
                            className={`w-full p-2.5 rounded-lg flex items-center justify-between transition-all ${
                              isInGroup
                                ? 'bg-green-500/15 border border-green-500/30'
                                : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <StatusDot connected={device.reachable} />
                              <div className="text-left min-w-0">
                                <p className="font-medium text-white text-sm truncate">{device.name}</p>
                                <p className="text-xs text-zinc-500 truncate">
                                  {device.roomName || (device.type === 'hue' ? 'Philips Hue' : device.type === 'nanoleaf' ? 'Nanoleaf' : 'SwitchBot')}
                                </p>
                              </div>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                isInGroup
                                  ? 'bg-green-500 text-white'
                                  : 'bg-zinc-700 text-zinc-500'
                              }`}
                            >
                              {isInGroup && (
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
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Device Control Modals */}
      {selectedDevice && !isShadeDevice(selectedDevice) && (
        <LightControl
          device={selectedDevice}
          onUpdate={handleDeviceUpdate}
          onClose={() => setSelectedDevice(null)}
        />
      )}

      {selectedDevice && isShadeDevice(selectedDevice) && (
        <ShadeControl
          device={selectedDevice}
          onUpdate={handleDeviceUpdate}
          onClose={() => setSelectedDevice(null)}
        />
      )}
    </div>
  );
}
