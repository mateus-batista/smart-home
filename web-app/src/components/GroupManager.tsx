import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Pencil, Plus, Trash2, Search, Sun, Layers, Ban } from 'lucide-react';
import type { DeviceGroup, Room, Light } from '../types/devices';
import { isShadeDevice, getGroupType, canAddDeviceToGroup } from '../types/devices';
import { CloseButton } from './ui/CloseButton';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { EmptyState, EmptyStateIcons } from './ui/EmptyState';
import { StatusDot } from './ui/StatusDot';
import { ShadeOpenCloseButtons } from './ui/ShadeOpenCloseButtons';
import { Slider } from './ui/Slider';
import { LightControl } from './LightControl';
import { ShadeControl } from './ShadeControl';
import { TiltBlindControl } from './ui/TiltBlindControl';
import { BulbControl } from './ui/BulbControl';

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

  // Memoize the set of device IDs in the group
  const groupDeviceIds = useMemo(
    () => new Set(selectedGroup?.devices?.map((d) => d.device.externalId) ?? []),
    [selectedGroup?.devices]
  );

  // Get actual device objects in the group
  const groupDevices = useMemo(
    () => devices.filter(d => groupDeviceIds.has(d.id)),
    [devices, groupDeviceIds]
  );

  // Determine group type for consistent behavior
  const groupType = useMemo(() => getGroupType(groupDevices), [groupDevices]);
  const isShadeGroup = groupType === 'shade';
  const isTiltGroup = isShadeGroup && groupDevices.length > 0 && groupDevices.every(d => d.deviceType === 'Blind Tilt');

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
      // Check type compatibility before adding
      const device = devices.find(d => d.id === deviceId);
      if (device) {
        const { allowed } = canAddDeviceToGroup(device, groupDevices);
        if (!allowed) {
          return; // Don't add incompatible device
        }
      }
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

  const handleTiltGroupPosition = async (position: number) => {
    if (!selectedGroupId) return;
    setIsGroupControlling(true);
    try {
      await onSetGroupState(selectedGroupId, { brightness: position });
    } finally {
      setTimeout(() => setIsGroupControlling(false), 500);
    }
  };

  const displayGroupBrightness = pendingGroupBrightness ?? groupState.brightness;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="glass-surface w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div className="min-w-0 flex items-center gap-3">
            {/* Show back arrow only when navigating from list (not opened directly) */}
            {viewMode === 'edit' && !initialGroupId && (
              <button
                onClick={() => {
                  setSelectedGroupId(null);
                  setViewMode('list');
                  setEditingName(null);
                  setEditTab('controls');
                }}
                className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              {viewMode === 'edit' && editingName !== null ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameGroup();
                      if (e.key === 'Escape') setEditingName(null);
                    }}
                    className="py-1 px-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white font-semibold text-lg outline-none focus:border-purple-500 w-48"
                    autoFocus
                  />
                  <button
                    onClick={handleRenameGroup}
                    disabled={isLoading || !editingName.trim()}
                    className="p-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 disabled:bg-zinc-600 text-white transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingName(null)}
                    className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  {viewMode === 'edit' ? (
                    <button
                      onClick={() => setEditingName(selectedGroup?.name ?? '')}
                      className="flex items-center gap-2 group"
                    >
                      <h2 className="text-lg font-semibold text-white truncate">{selectedGroup?.name}</h2>
                      <Pencil className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors shrink-0" />
                    </button>
                  ) : (
                    <h2 className="text-lg font-semibold text-white truncate">
                      {viewMode === 'create' ? 'New Group' : 'Groups'}
                    </h2>
                  )}
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {viewMode === 'create'
                      ? 'Control multiple devices together'
                      : viewMode === 'edit'
                        ? `${selectedGroup?.devices?.length ?? 0} devices${selectedGroup?.room ? ` • ${selectedGroup.room.name}` : ''}`
                        : `${groups.length} group${groups.length !== 1 ? 's' : ''}`}
                  </p>
                </>
              )}
            </div>
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
                <Plus className="w-5 h-5 text-amber-400" />
                <span className="font-medium text-amber-400">New Group</span>
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
                    // Get actual devices in this group to determine type
                    const groupDeviceIdsForList = new Set(group.devices?.map(d => d.device.externalId) ?? []);
                    const groupDevicesForList = devices.filter(d => groupDeviceIdsForList.has(d.id));
                    const groupTypeForList = getGroupType(groupDevicesForList);
                    const isShadeGroupForList = groupTypeForList === 'shade';

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
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isShadeGroupForList
                              ? 'bg-blue-500/20'
                              : groupTypeForList === 'empty'
                              ? 'bg-rose-500/20'
                              : 'bg-amber-500/20'
                          }`}>
                            {isShadeGroupForList ? (
                              <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <line x1="5" y1="8" x2="19" y2="8" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <line x1="5" y1="16" x2="19" y2="16" />
                              </svg>
                            ) : groupTypeForList === 'empty' ? (
                              <Layers className="w-4 h-4 text-rose-400" />
                            ) : (
                              <Sun className="w-4 h-4 text-amber-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-white text-sm truncate">{group.name}</h3>
                            <p className="text-xs text-zinc-500">
                              {deviceCount} {isShadeGroupForList ? 'shade' : groupTypeForList === 'empty' ? 'device' : 'light'}{deviceCount !== 1 ? 's' : ''}
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
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-zinc-500" />
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
                <ChevronLeft className="w-4 h-4" />
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
                    className="w-full py-2.5 px-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition-all"
                    autoFocus
                  />
                </div>

                {/* Room selection */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Room (optional)</label>
                  <select
                    value={newGroupRoomId ?? ''}
                    onChange={(e) => setNewGroupRoomId(e.target.value || null)}
                    className="w-full py-2.5 px-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
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
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-xl font-medium text-white transition-all"
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
              {/* Group-level controls */}
              {groupDevices.length > 0 && (
                <div className={`px-4 sm:px-5 py-4 ${isTiltGroup ? '' : 'space-y-5'} border-b border-white/[0.06] shrink-0 bg-white/[0.03]`}>
                  {isTiltGroup ? (
                    <TiltBlindControl
                      position={displayGroupBrightness}
                      onPositionChange={handleTiltGroupPosition}
                      disabled={isGroupControlling}
                    />
                  ) : isShadeGroup ? (
                    <>
                      {/* Shade group: Open/Close + Position slider */}
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-medium">All Shades</span>
                        <ShadeOpenCloseButtons
                          visualOpenness={displayGroupBrightness}
                          onOpen={handleGroupOpen}
                          onClose={handleGroupClose}
                          disabled={groupDevices.length === 0}
                          loading={isGroupControlling}
                          size="lg"
                        />
                      </div>

                      <Slider
                        value={displayGroupBrightness}
                        onChange={handleGroupBrightnessChange}
                        onCommit={handleGroupBrightnessCommit}
                        min={0}
                        max={100}
                        disabled={groupDevices.length === 0}
                        label="Position"
                        valueDisplay={`${displayGroupBrightness}%`}
                        gradient="linear-gradient(to right, #374151, #3b82f6, #87ceeb)"
                        hints={{ start: 'Closed', end: 'Open' }}
                      />
                    </>
                  ) : (
                    /* Light group: BulbControl */
                    <BulbControl
                      brightness={displayGroupBrightness}
                      onBrightnessChange={async (brightness) => {
                        if (!selectedGroupId) return;
                        setIsGroupControlling(true);
                        try {
                          await onSetGroupState(selectedGroupId, { brightness, on: brightness > 0 });
                        } finally {
                          setTimeout(() => setIsGroupControlling(false), 500);
                        }
                      }}
                      disabled={groupDevices.length === 0 || isGroupControlling}
                    />
                  )}
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-white/[0.06] shrink-0">
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
                  <div className="p-3 border-b border-white/[0.06] shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full py-2 pl-9 pr-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Group type indicator */}
                  {groupDevices.length > 0 && (
                    <div className="px-3 pb-2">
                      <div className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1.5 ${
                        isShadeGroup
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {isShadeGroup ? (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="5" y1="8" x2="19" y2="8" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        ) : (
                          <Sun className="w-3 h-3" />
                        )}
                        <span>{isShadeGroup ? 'Shade group' : 'Light group'} - only {isShadeGroup ? 'shades' : 'lights'} can be added</span>
                      </div>
                    </div>
                  )}

                  {/* Device list */}
                  <div className="flex-1 overflow-y-auto p-3">
                    <div className="space-y-1.5">
                      {filteredDevices.map((device) => {
                        const isInGroup = groupDeviceIds.has(device.id);
                        const { allowed, reason } = canAddDeviceToGroup(device, groupDevices);
                        const isDeviceShade = isShadeDevice(device);
                        const isDisabled = !isInGroup && !allowed;

                        return (
                          <button
                            key={device.id}
                            onClick={() => !isDisabled && handleToggleDevice(device.id)}
                            disabled={isDisabled}
                            title={isDisabled ? reason : undefined}
                            className={`w-full p-2.5 rounded-lg flex items-center justify-between transition-all ${
                              isInGroup
                                ? 'bg-amber-500/15 border border-amber-500/30'
                                : isDisabled
                                ? 'bg-zinc-800/30 border border-transparent opacity-50 cursor-not-allowed'
                                : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <StatusDot connected={device.reachable} />
                              <div className="text-left min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-white text-sm truncate">{device.name}</p>
                                  {/* Device type badge */}
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                                    isDeviceShade
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : 'bg-amber-500/20 text-amber-400'
                                  }`}>
                                    {isDeviceShade ? 'shade' : 'light'}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-500 truncate">
                                  {device.roomName || (device.type === 'hue' ? 'Philips Hue' : device.type === 'nanoleaf' ? 'Nanoleaf' : 'SwitchBot')}
                                </p>
                              </div>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                isInGroup
                                  ? 'bg-amber-500 text-white'
                                  : isDisabled
                                  ? 'bg-zinc-800 text-zinc-600'
                                  : 'bg-zinc-700 text-zinc-500'
                              }`}
                            >
                              {isInGroup && (
                                <Check className="w-3 h-3" strokeWidth={3} />
                              )}
                              {isDisabled && (
                                <Ban className="w-3 h-3" />
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
