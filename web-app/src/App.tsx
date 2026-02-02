import { useState, useEffect, useMemo, useRef } from 'react';
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
      console.log('[App] handleDeviceUpdate called with:', state);
      await updateDevice(selectedDevice.id, state);
      // Update local selected device state
      setSelectedDevice((prev) => {
        const newState = prev ? { ...prev, state: { ...prev.state, ...state } } : null;
        console.log('[App] Updated selectedDevice state:', newState?.state);
        return newState;
      });
    }
  };

  const handleShadeUpdate = async (state: Partial<Light['state']>) => {
    if (selectedShade) {
      console.log('[App] handleShadeUpdate called with:', state);
      await updateDevice(selectedShade.id, state);
      // Update local selected shade state
      setSelectedShade((prev) => {
        const newState = prev ? { ...prev, state: { ...prev.state, ...state } } : null;
        console.log('[App] Updated selectedShade state:', newState?.state);
        return newState;
      });
    }
  };

  // Server connection error view
  if (serverError) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🔌</div>
          <h1 className="text-2xl font-bold mb-4">Server Not Connected</h1>
          <p className="text-zinc-400 mb-6">
            Make sure the Smart Home server is running on port 3001.
          </p>
          <div className="p-4 bg-zinc-800 rounded-xl mb-6 text-left">
            <p className="text-sm font-mono text-zinc-300">
              cd server<br />
              npm run dev
            </p>
          </div>
          <button
            onClick={() => {
              refresh();
              refreshStatus();
            }}
            className="py-3 px-6 bg-green-500 hover:bg-green-600 rounded-xl font-medium transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
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
          onClose={() => {
            setSelectedDevice(null);
            // Refresh to get the latest device state after closing
            setTimeout(refresh, 500);
          }}
          onToggleHidden={(hidden) => setDeviceHidden(selectedDevice.id, hidden)}
        />
      )}

      {/* Shade Control Modal */}
      {selectedShade && (
        <ShadeControl
          device={selectedShade}
          onUpdate={handleShadeUpdate}
          onClose={() => {
            setSelectedShade(null);
            // Refresh to get the latest device state after closing
            setTimeout(refresh, 500);
          }}
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
          onClose={() => {
            setShowGroupManager(false);
            setEditingGroupId(null);
            refreshGroups();
            refresh();
          }}
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
          onClose={() => {
            setShowRoomManager(false);
            setEditingRoomId(null);
            refreshRooms();
            refresh();
          }}
        />
      )}

      {/* Device Room Assignment Modal */}
      {deviceToAssignRoom && (
        <DeviceRoomAssigner
          device={deviceToAssignRoom}
          rooms={rooms}
          onAssign={async (roomId) => {
            await assignDeviceToRoom(roomId, deviceToAssignRoom.id);
            refresh();
          }}
          onRemove={async (roomId) => {
            await removeDeviceFromRoom(roomId, deviceToAssignRoom.id);
            refresh();
          }}
          onClose={() => setDeviceToAssignRoom(null)}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Smart Home</h1>
            <p className="text-sm text-zinc-400">
              {visibleDevices.length} device{visibleDevices.length !== 1 ? 's' : ''}
              {hiddenCount > 0 && !showHidden && (
                <span className="text-zinc-500"> • {hiddenCount} hidden</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <VoiceButton onAction={() => refresh()} />
            
            {/* Hamburger Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                title="Menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 py-2 bg-zinc-800 rounded-xl shadow-xl border border-zinc-700 z-20 min-w-[200px]">
                  {/* View mode options */}
                  <div className="px-3 py-2 border-b border-zinc-700">
                    <p className="text-xs text-zinc-500 mb-2">View</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setViewMode('rooms');
                          setShowMenu(false);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          viewMode === 'rooms'
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Rooms
                      </button>
                      <button
                        onClick={() => {
                          setViewMode('devices');
                          setShowMenu(false);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          viewMode === 'devices'
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        List
                      </button>
                    </div>
                  </div>

                  {/* Hidden devices toggle */}
                  {hiddenCount > 0 && (
                    <button
                      onClick={() => {
                        setShowHidden(!showHidden);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-700 transition-colors flex items-center gap-3"
                    >
                      {showHidden ? (
                        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                      <span className={showHidden ? 'text-amber-400' : 'text-zinc-300'}>
                        {showHidden ? 'Hide hidden devices' : `Show ${hiddenCount} hidden`}
                      </span>
                    </button>
                  )}

                  {/* Manage groups */}
                  <button
                    onClick={() => {
                      setShowGroupManager(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    Manage Groups
                  </button>

                  {/* Manage rooms */}
                  <button
                    onClick={() => {
                      setShowRoomManager(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                    Manage Rooms
                  </button>

                  {/* Add device */}
                  <button
                    onClick={() => {
                      setShowSetup(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Device
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading && devices.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent" />
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">💡</div>
            <h2 className="text-xl font-semibold mb-2">No Devices Found</h2>
            <p className="text-zinc-400 mb-6">
              Add your first smart device to get started.
            </p>
            <button
              onClick={() => setShowSetup(true)}
              className="py-3 px-6 bg-green-500 hover:bg-green-600 rounded-xl font-medium transition-colors"
            >
              Add Device
            </button>
          </div>
        ) : viewMode === 'rooms' ? (
          /* Room-based view */
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
            onEditGroup={(groupId) => {
              setEditingGroupId(groupId);
              setShowGroupManager(true);
            }}
            onDeleteGroup={deleteGroup}
            onSetGroupState={setGroupState}
            onCreateRoom={createRoom}
            onDeleteRoom={deleteRoom}
            onRefresh={refresh}
          />
        ) : (
          /* Flat device list view */
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
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-zinc-400">Groups</h2>
                  <button
                    onClick={() => setShowGroupManager(true)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Manage all
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredGroups.map((group) => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      devices={devices}
                      onToggle={async (on) => {
                        await setGroupState(group.id, { on });
                        // Refresh devices to update UI immediately
                        setTimeout(refresh, 300);
                      }}
                      onBrightnessChange={async (brightness) => {
                        await setGroupState(group.id, { brightness });
                        // Refresh devices to update UI immediately
                        setTimeout(refresh, 300);
                      }}
                      onDelete={() => deleteGroup(group.id)}
                      onEdit={() => {
                        setEditingGroupId(group.id);
                        setShowGroupManager(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Shades section */}
            {filteredShades.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-medium text-zinc-400 mb-3">
                  Shades & Blinds ({filteredShades.length})
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
              <h2 className="text-sm font-medium text-zinc-400 mb-3">
                Lights {filteredLights.length !== devices.filter(d => !isShadeDevice(d)).length && `(${filteredLights.length})`}
              </h2>
              {filteredLights.length === 0 && filteredShades.length === 0 ? (
                <div className="text-center py-10 text-zinc-500">
                  <p>No devices in this room</p>
                </div>
              ) : filteredLights.length === 0 ? (
                <div className="text-center py-10 text-zinc-500">
                  <p>No lights in this room</p>
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

        {/* Error display */}
        {error && !serverError && (
          <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
