import { useState, useEffect, useCallback } from 'react';
import type { Light, DeviceState, ApiStatus } from '../types/devices';
import * as api from '../services/api';

/**
 * Hook to track if the browser tab is visible/active.
 * Returns false when user switches to another tab or minimizes the window.
 */
function useTabVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

export function useDevices(pausePolling = false) {
  const [devices, setDevices] = useState<Light[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isTabVisible = useTabVisibility();

  const fetchDevices = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getAllDevices();
      setDevices(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Separate effect for polling that respects pausePolling and tab visibility
  useEffect(() => {
    // Don't poll if explicitly paused or if tab is not visible
    if (pausePolling || !isTabVisible) {
      return;
    }
    
    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      fetchDevices();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchDevices, pausePolling, isTabVisible]);

  const updateDevice = useCallback(async (id: string, state: Partial<DeviceState>) => {
    try {
      // Optimistic update
      setDevices((prev) =>
        prev.map((device) =>
          device.id === id
            ? { ...device, state: { ...device.state, ...state } }
            : device
        )
      );
      
      await api.updateDevice(id, state);
    } catch (err) {
      setError((err as Error).message);
      // Revert on error
      fetchDevices();
    }
  }, [fetchDevices]);

  const toggleDevice = useCallback(async (id: string) => {
    const device = devices.find((d) => d.id === id);
    if (device) {
      await updateDevice(id, { on: !device.state.on });
    }
  }, [devices, updateDevice]);

  const setBrightness = useCallback(async (id: string, brightness: number) => {
    await updateDevice(id, { brightness, on: brightness > 0 });
  }, [updateDevice]);

  const setColor = useCallback(async (id: string, hue: number, saturation: number) => {
    const device = devices.find((d) => d.id === id);
    if (device) {
      await updateDevice(id, {
        color: {
          hue,
          saturation,
          brightness: device.state.brightness,
        },
      });
    }
  }, [devices, updateDevice]);

  const setDeviceHidden = useCallback(async (id: string, hidden: boolean) => {
    try {
      // Optimistic update
      setDevices((prev) =>
        prev.map((device) =>
          device.id === id ? { ...device, hidden } : device
        )
      );
      
      await api.setDeviceVisibility(id, hidden);
    } catch (err) {
      setError((err as Error).message);
      // Revert on error
      fetchDevices();
    }
  }, [fetchDevices]);

  return {
    devices,
    loading,
    error,
    refresh: fetchDevices,
    updateDevice,
    toggleDevice,
    setBrightness,
    setColor,
    setDeviceHidden,
  };
}

export function useStatus() {
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getStatus();
      setStatus(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, error, refresh: fetchStatus };
}

export function useNanoleafEffects(deviceId: string | null) {
  const [effects, setEffects] = useState<string[]>([]);
  const [currentEffect, setCurrentEffect] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEffects = useCallback(async () => {
    if (!deviceId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await api.getNanoleafEffects(deviceId);
      setEffects(data.effects);
      setCurrentEffect(data.currentEffect);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchEffects();
  }, [fetchEffects]);

  const selectEffect = useCallback(async (effect: string) => {
    if (!deviceId) return;
    
    try {
      setCurrentEffect(effect);
      await api.setNanoleafEffect(deviceId, effect);
    } catch (err) {
      setError((err as Error).message);
      fetchEffects();
    }
  }, [deviceId, fetchEffects]);

  return { effects, currentEffect, loading, error, selectEffect, refresh: fetchEffects };
}
