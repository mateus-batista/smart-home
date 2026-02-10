import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Home, Menu, Eye, EyeOff, Layers, Plus, Lightbulb, Zap } from 'lucide-react';
import { useDevices, useStatus } from './hooks/useDevices';
import { useRooms } from './hooks/useRooms';
import { useGroups } from './hooks/useGroups';
import { LightControl } from './components/LightControl';
import { ShadeControl } from './components/ShadeControl';
import { SetupWizard } from './components/SetupWizard';
import { RoomView } from './components/RoomView';
import { GroupManager } from './components/GroupManager';
import { RoomManager } from './components/RoomManager';
import { DeviceRoomAssigner } from './components/DeviceRoomAssigner';
import { VoiceButton } from './components/VoiceButton';
import { SplashScreen } from './components/SplashScreen';
import type { Light } from './types/devices';
import { isShadeDevice } from './types/devices';

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
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showRoomManager, setShowRoomManager] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [deviceToAssignRoom, setDeviceToAssignRoom] = useState<Light | null>(null);
  const [showSplash, setShowSplash] = useState(() => (navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches);
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
    const allOnDeviceIds = new Set(devices.filter(d => d.state.on).map(d => d.id));
    const groupsOn = groups.filter(g =>
      g.devices?.some(gd => allOnDeviceIds.has(gd.device.externalId))
    ).length;
    const lightsCount = visibleDevices.filter(d => !isShadeDevice(d)).length;
    const shadesCount = visibleDevices.filter(d => isShadeDevice(d)).length;
    return { devicesOn: devicesOn + groupsOn, lightsCount, shadesCount, totalDevices: visibleDevices.length };
  }, [visibleDevices, devices, groups]);

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
          <div className="p-4 glass-card rounded-xl mb-6 text-left">
            <p className="text-sm font-mono text-zinc-300">
              cd server<br />
              npm run dev
            </p>
          </div>
          <button
            onClick={() => { refresh(); refreshStatus(); }}
            className="py-3 px-8 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 rounded-xl font-medium transition-all shadow-lg shadow-amber-500/20"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

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
      <header className="sticky top-[var(--safe-area-inset-top)] z-10 glass-surface border-b-0 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5L12 3l9 7.5" />
                <path d="M5 9.5V19a1 1 0 001 1h12a1 1 0 001-1V9.5" />
                {/* Signal arcs — smart indicator */}
                <path d="M9.5 14.5a3.5 3.5 0 015 0" strokeWidth="1.5" />
                <path d="M8 12.5a6 6 0 018 0" strokeWidth="1.5" />
                <circle cx="12" cy="16" r="0.75" fill="currentColor" stroke="none" />
              </svg>
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
                className="p-2.5 rounded-xl glass-pill hover:bg-white/10 transition-all"
                title="Menu"
              >
                <Menu className="w-5 h-5 text-zinc-400" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 py-2 glass-surface rounded-2xl shadow-2xl z-20 min-w-[220px]">
                  {/* Hidden devices toggle */}
                  {hiddenCount > 0 && (
                    <button
                      onClick={() => { setShowHidden(!showHidden); setShowMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors flex items-center gap-3"
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

                  <div className="border-t border-white/[0.06] mt-1 pt-1">
                    <button
                      onClick={() => { setShowGroupManager(true); setShowMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-white/10 transition-colors flex items-center gap-3"
                    >
                      <Layers className="w-5 h-5 text-zinc-500" />
                      Manage Groups
                    </button>

                    <button
                      onClick={() => { setShowRoomManager(true); setShowMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-white/10 transition-colors flex items-center gap-3"
                    >
                      <Home className="w-5 h-5 text-zinc-500" />
                      Manage Rooms
                    </button>

                    <button
                      onClick={() => { setShowSetup(true); setShowMenu(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-white/10 transition-colors flex items-center gap-3"
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
            <div className="w-16 h-16 rounded-2xl glass-pill flex items-center justify-center mb-4">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-zinc-500">Loading devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl glass-pill flex items-center justify-center">
              <Lightbulb className="w-10 h-10 text-zinc-600" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Devices Found</h2>
            <p className="text-zinc-400 mb-6">Add your first smart device to get started.</p>
            <button
              onClick={() => setShowSetup(true)}
              className="py-3 px-8 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 rounded-xl font-medium transition-all shadow-lg shadow-amber-500/20"
            >
              Add Device
            </button>
          </div>
        ) : (
          <>
            {/* Dashboard Hero — Greeting + Inline Stats */}
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                {getGreeting()}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-pill">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-sm font-semibold text-white">{stats.devicesOn}</span>
                  <span className="text-xs text-zinc-500">active</span>
                </div>
                <span className="text-zinc-600">·</span>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-pill">
                  <Lightbulb className="w-3.5 h-3.5 text-yellow-300" />
                  <span className="text-sm font-semibold text-white">{stats.lightsCount}</span>
                  <span className="text-xs text-zinc-500">lights</span>
                </div>
                <span className="text-zinc-600">·</span>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-pill">
                  <Home className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-sm font-semibold text-white">{rooms.length}</span>
                  <span className="text-xs text-zinc-500">rooms</span>
                </div>
                {stats.shadesCount > 0 && (
                  <>
                    <span className="text-zinc-600">·</span>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-pill">
                      <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16M4 8h16M4 11h16M4 14h16M4 17h16" />
                      </svg>
                      <span className="text-sm font-semibold text-white">{stats.shadesCount}</span>
                      <span className="text-xs text-zinc-500">shades</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Room View */}
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
          </>
        )}

        {/* Error display */}
        {error && !serverError && (
          <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto p-4 glass-surface rounded-2xl text-red-400 shadow-lg" style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
