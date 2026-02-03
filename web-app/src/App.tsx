import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Home, Menu, List, Eye, EyeOff, Layers, Plus, Lightbulb, Zap } from 'lucide-react';
import { useDevices, useStatus } from './hooks/useDevices';
import { useRooms } from './hooks/useRooms';
import { useGroups } from './hooks/useGroups';
import { DeviceCard } from './components/DeviceCard';
import { ShadeCard } from './components/ShadeCard';
import { LightControl } from './components/LightControl';
import { ShadeControl } from './components/ShadeControl';
import { SetupWizard } from './components/SetupWizard';
import { RoomSelector } from './components/RoomSelector';
import { RoomView } from './components/RoomView';
import { GroupCard } from './components/GroupCard';
import { GroupManager } from './components/GroupManager';
import { RoomManager } from './components/RoomManager';
import { DeviceRoomAssigner } from './components/DeviceRoomAssigner';
import { VoiceButton } from './components/VoiceButton';
import type { Light } from './types/devices';
import { isShadeDevice } from './types/devices';

type ViewMode = 'rooms' | 'devices';

// Get time-based greeting
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Format current time
function useCurrentTime() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function App() {
  const [selectedDevice, setSelectedDevice] = useState<Light | null>(null);
  const [selectedShade, setSelectedShade] = useState<Light | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showRoomManager, setShowRoomManager] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [deviceToAssignRoom, setDeviceToAssignRoom] = useState<Light | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('rooms');
  const [showHidden, setShowHidden] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentTime = useCurrentTime();

  // Pause polling when a device control modal is open
  const { devices, loading, error, toggleDevice, setBrightness, updateDevice, setDeviceHidden, refresh } = useDevices(!!selectedDevice || !!selectedShade);

  // Count hidden devices
  const hiddenCount = useMemo(() => devices.filter(d => d.hidden).length, [devices]);

  // Filter out hidden devices unless showHidden is true
  const visibleDevices = useMemo(() =>
    showHidden ? devices : devices.filter(d => !d.hidden),
    [devices, showHidden]
  );
  const { status, loading: statusLoading, refresh: refreshStatus } = useStatus();
  const { rooms, createRoom, updateRoom, deleteRoom, assignDeviceToRoom, removeDeviceFromRoom, refresh: refreshRooms } = useRooms();
  const { groups, createGroup, updateGroup, deleteGroup, addDeviceToGroup, removeDeviceFromGroup, setGroupState, refresh: refreshGroups } = useGroups();

  // Stats calculations
  const stats = useMemo(() => {
    const devicesOn = visibleDevices.filter(d => d.state.on).length;
    const lightsCount = visibleDevices.filter(d => !isShadeDevice(d)).length;
    const shadesCount = visibleDevices.filter(d => isShadeDevice(d)).length;
    return { devicesOn, lightsCount, shadesCount, totalDevices: visibleDevices.length };
  }, [visibleDevices]);

  // Filter devices by room and separate lights from shades (for devices view)
  const { filteredLights, filteredShades } = useMemo(() => {
    let filtered = visibleDevices;
    if (selectedRoomId === 'unassigned') {
      filtered = visibleDevices.filter((d) => !d.roomId);
    } else if (selectedRoomId !== null) {
      filtered = visibleDevices.filter((d) => d.roomId === selectedRoomId);
    }

    return {
      filteredLights: filtered.filter((d) => !isShadeDevice(d)),
      filteredShades: filtered.filter((d) => isShadeDevice(d)),
    };
  }, [visibleDevices, selectedRoomId]);

  // Filter groups by room (for devices view)
  const filteredGroups = useMemo(() => {
    if (selectedRoomId === null) {
      return groups;
    }
    if (selectedRoomId === 'unassigned') {
      return groups.filter((g) => !g.roomId);
    }
    return groups.filter((g) => g.roomId === selectedRoomId);
  }, [groups, selectedRoomId]);

  // Derive server error directly from error state (no useEffect needed)
  const serverError = !!(error?.includes('Failed to fetch') || error?.includes('NetworkError'));

  // Check if we need to show setup wizard (use rAF to avoid synchronous setState in effect)
  useEffect(() => {
    if (status && !statusLoading) {
      const hasNoDevices = !status.hue.configured && !status.nanoleaf.configured && !status.switchbot?.configured;
      if (hasNoDevices && devices.length === 0) {
        const frameId = requestAnimationFrame(() => setShowSetup(true));
        return () => cancelAnimationFrame(frameId);
      }
    }
  }, [status, statusLoading, devices.length]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSetupComplete = () => {
    setShowSetup(false);
    refresh();
    refreshStatus();
    refreshRooms();
    refreshGroups();
  };

  const handleDeviceSelect = (device: Light) => {
    setSelectedDevice(device);
  };

  const handleDeviceUpdate = async (state: Partial<Light['state']>) => {
    if (selectedDevice) {
      await updateDevice(selectedDevice.id, state);
      setSelectedDevice((prev) => prev ? { ...prev, state: { ...prev.state, ...state } } : null);
    }
  };

  const handleShadeUpdate = async (state: Partial<Light['state']>) => {
    if (selectedShade) {
      await updateDevice(selectedShade.id, state);
      setSelectedShade((prev) => prev ? { ...prev, state: { ...prev.state, ...state } } : null);
    }
  };

  // Server connection error view
  if (serverError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold mb-3">Server Not Connected</h1>
          <p className="text-zinc-400 mb-6">
            Make sure the Smart Home server is running on port 3001.
          </p>
          <div className="p-4 bg-zinc-800/50 backdrop-blur rounded-xl mb-6 text-left border border-zinc-700/50">
            <p className="text-sm font-mono text-zinc-300">
              cd server<br />
              npm run dev
            </p>
          </div>
          <button
            onClick={() => { refresh(); refreshStatus(); }}
            className="py-3 px-8 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/20"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Setup Wizard */}
      {showSetup && status && (
        <SetupWizard
          onComplete={handleSetupComplete}
          hueConfigured={status.hue.configured}
          nanoleafConfigured={status.nanoleaf.configured}
        />
      )}

      {/* Light Control Modal */}
      {selectedDevice && (
        <LightControl
          device={selectedDevice}
          onUpdate={handleDeviceUpdate}
          onClose={() => { setSelectedDevice(null); setTimeout(refresh, 500); }}
          onToggleHidden={(hidden) => setDeviceHidden(selectedDevice.id, hidden)}
        />
      )}

      {/* Shade Control Modal */}
      {selectedShade && (
        <ShadeControl
          device={selectedShade}
          onUpdate={handleShadeUpdate}
          onClose={() => { setSelectedShade(null); setTimeout(refresh, 500); }}
          onToggleHidden={(hidden) => setDeviceHidden(selectedShade.id, hidden)}
        />
      )}

      {/* Group Manager Modal */}
      {showGroupManager && (
        <GroupManager
          groups={groups}
          rooms={rooms}
          devices={devices}
          onCreateGroup={createGroup}
          onUpdateGroup={updateGroup}
          onDeleteGroup={deleteGroup}
          onAddDeviceToGroup={addDeviceToGroup}
          onRemoveDeviceFromGroup={removeDeviceFromGroup}
          onUpdateDevice={updateDevice}
          onSetGroupState={setGroupState}
          initialGroupId={editingGroupId}
          onClose={() => { setShowGroupManager(false); setEditingGroupId(null); refreshGroups(); refresh(); }}
        />
      )}

      {/* Room Manager Modal */}
      {showRoomManager && (
        <RoomManager
          rooms={rooms}
          devices={devices}
          onCreateRoom={createRoom}
          onUpdateRoom={updateRoom}
          onDeleteRoom={deleteRoom}
          onAssignDeviceToRoom={assignDeviceToRoom}
          onRemoveDeviceFromRoom={removeDeviceFromRoom}
          initialRoomId={editingRoomId}
          onClose={() => { setShowRoomManager(false); setEditingRoomId(null); refreshRooms(); refresh(); }}
        />
      )}

      {/* Device Room Assignment Modal */}
      {deviceToAssignRoom && (
        <DeviceRoomAssigner
          device={deviceToAssignRoom}
          rooms={rooms}
          onAssign={async (roomId) => { await assignDeviceToRoom(roomId, deviceToAssignRoom.id); refresh(); }}
          onRemove={async (roomId) => { await removeDeviceFromRoom(roomId, deviceToAssignRoom.id); refresh(); }}
          onClose={() => setDeviceToAssignRoom(null)}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/70 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Smart Home</h1>
              <p className="text-xs text-zinc-500">{currentTime}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <VoiceButton onAction={() => refresh()} />

            {/* Menu Button */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2.5 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-all"
                title="Menu"
              >
                <Menu className="w-5 h-5 text-zinc-400" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 py-2 bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-700/50 z-20 min-w-[220px]">
                  {/* View mode options */}
                  <div className="px-3 py-2 border-b border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-2 font-medium">View Mode</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setViewMode('rooms'); setShowMenu(false); }}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          viewMode === 'rooms'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        <Home className="w-4 h-4" />
                        Rooms
                      </button>
                      <button
                        onClick={() => { setViewMode('devices'); setShowMenu(false); }}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          viewMode === 'devices'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        <List className="w-4 h-4" />
                        List
                      </button>
                    </div>
                  </div>

                  {/* Hidden devices toggle */}
                  {hiddenCount > 0 && (
                    <button
                      onClick={() => { setShowHidden(!showHidden); setShowMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-800 transition-colors flex items-center gap-3"
                    >
                      {showHidden ? (
                        <Eye className="w-5 h-5 text-amber-400" />
                      ) : (
                        <EyeOff className="w-5 h-5 text-zinc-500" />
                      )}
                      <span className={showHidden ? 'text-amber-400' : 'text-zinc-300'}>
                        {showHidden ? 'Hide hidden devices' : `Show ${hiddenCount} hidden`}
                      </span>
                    </button>
                  )}

                  <div className="border-t border-zinc-800 mt-1 pt-1">
                    <button
                      onClick={() => { setShowGroupManager(true); setShowMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                    >
                      <Layers className="w-5 h-5 text-zinc-500" />
                      Manage Groups
                    </button>

                    <button
                      onClick={() => { setShowRoomManager(true); setShowMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                    >
                      <Home className="w-5 h-5 text-zinc-500" />
                      Manage Rooms
                    </button>

                    <button
                      onClick={() => { setShowSetup(true); setShowMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-3"
                    >
                      <Plus className="w-5 h-5 text-zinc-500" />
                      Add Device
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading && devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-zinc-500">Loading devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
              <Lightbulb className="w-10 h-10 text-zinc-600" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Devices Found</h2>
            <p className="text-zinc-400 mb-6">Add your first smart device to get started.</p>
            <button
              onClick={() => setShowSetup(true)}
              className="py-3 px-8 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/20"
            >
              Add Device
            </button>
          </div>
        ) : (
          <>
            {/* Dashboard Hero Section */}
            <div className="mb-8">
              {/* Greeting */}
              <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                  {getGreeting()}
                </h2>
                <p className="text-zinc-400">
                  {stats.devicesOn === 0
                    ? 'All devices are off'
                    : `${stats.devicesOn} device${stats.devicesOn !== 1 ? 's' : ''} currently on`}
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Devices On */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.devicesOn}</p>
                      <p className="text-xs text-zinc-500">Active</p>
                    </div>
                  </div>
                </div>

                {/* Total Devices */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.lightsCount}</p>
                      <p className="text-xs text-zinc-500">Lights</p>
                    </div>
                  </div>
                </div>

                {/* Rooms */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                      <Home className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{rooms.length}</p>
                      <p className="text-xs text-zinc-500">Rooms</p>
                    </div>
                  </div>
                </div>

                {/* Shades */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M4 8h16M4 11h16M4 14h16M4 17h16" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.shadesCount}</p>
                      <p className="text-xs text-zinc-500">Shades</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content based on view mode */}
            {viewMode === 'rooms' ? (
              <RoomView
                rooms={rooms}
                devices={visibleDevices}
                allDevices={devices}
                groups={groups}
                onToggleDevice={toggleDevice}
                onSetBrightness={setBrightness}
                onUpdateDevice={updateDevice}
                onSelectDevice={handleDeviceSelect}
                onSelectShade={setSelectedShade}
                onAssignDeviceRoom={setDeviceToAssignRoom}
                onEditGroup={(groupId) => { setEditingGroupId(groupId); setShowGroupManager(true); }}
                onDeleteGroup={deleteGroup}
                onSetGroupState={setGroupState}
                onDeleteRoom={deleteRoom}
                onRefresh={refresh}
              />
            ) : (
              <>
                {/* Room Selector */}
                <RoomSelector
                  rooms={rooms}
                  selectedRoomId={selectedRoomId}
                  onSelectRoom={setSelectedRoomId}
                  onCreateRoom={createRoom}
                  onDeleteRoom={deleteRoom}
                />

                {/* Groups section */}
                {filteredGroups.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Groups</h2>
                      <button
                        onClick={() => setShowGroupManager(true)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                      >
                        Manage
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {filteredGroups.map((group) => (
                        <GroupCard
                          key={group.id}
                          group={group}
                          devices={devices}
                          onToggle={async (on) => { await setGroupState(group.id, { on }); setTimeout(refresh, 300); }}
                          onBrightnessChange={async (brightness) => { await setGroupState(group.id, { brightness }); setTimeout(refresh, 300); }}
                          onDelete={() => deleteGroup(group.id)}
                          onEdit={() => { setEditingGroupId(group.id); setShowGroupManager(true); }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Shades section */}
                {filteredShades.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                      Shades & Blinds
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {filteredShades.map((shade) => (
                        <ShadeCard
                          key={shade.id}
                          device={shade}
                          onPositionChange={(position) => updateDevice(shade.id, { brightness: position, on: position > 0 })}
                          onClick={() => setSelectedShade(shade)}
                          onAssignRoom={() => setDeviceToAssignRoom(shade)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Lights section */}
                <div>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                    Lights
                  </h2>
                  {filteredLights.length === 0 && filteredShades.length === 0 ? (
                    <div className="text-center py-12 rounded-2xl bg-zinc-800/30 border border-zinc-800">
                      <p className="text-zinc-500">No devices in this room</p>
                    </div>
                  ) : filteredLights.length === 0 ? (
                    <div className="text-center py-12 rounded-2xl bg-zinc-800/30 border border-zinc-800">
                      <p className="text-zinc-500">No lights in this room</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {filteredLights.map((device) => (
                        <DeviceCard
                          key={device.id}
                          device={device}
                          onToggle={() => toggleDevice(device.id)}
                          onBrightnessChange={(brightness) => setBrightness(device.id, brightness)}
                          onClick={() => handleDeviceSelect(device)}
                          onAssignRoom={() => setDeviceToAssignRoom(device)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Error display */}
        {error && !serverError && (
          <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto p-4 bg-red-500/10 backdrop-blur border border-red-500/30 rounded-2xl text-red-400 shadow-lg">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
