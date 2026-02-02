import { useState, useEffect, useCallback, useRef } from 'react';
import type { Light, DeviceState } from '../types/devices';
import * as api from '../services/api';

interface WebSocketMessage {
  type: 'connected' | 'devices:full' | 'devices:update' | 'pong' | 'error';
  clientId?: string;
  devices?: Light[];
  error?: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Hook to track if the browser tab is visible/active.
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

/**
 * Hook that receives device updates via WebSocket with HTTP polling fallback.
 * The backend does all the heavy polling; this hook just receives updates.
 */
export function useDevicesWebSocket(pausePolling = false) {
  const [devices, setDevices] = useState<Light[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const isTabVisible = useTabVisibility();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Fetch devices via HTTP (fallback)
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

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (pausePolling || !isTabVisible) return;

    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/devices`;

    console.log('[useDevicesWebSocket] Connecting to', wsUrl);
    setConnectionStatus('connecting');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[useDevicesWebSocket] Connected');
      setConnectionStatus('connected');
      setError(null);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'connected':
            console.log('[useDevicesWebSocket] Received client ID:', message.clientId);
            break;

          case 'devices:full':
            // Full device list received
            if (message.devices) {
              setDevices(message.devices);
              setLoading(false);
            }
            break;

          case 'devices:update':
            // Partial update - merge changed devices
            if (message.devices) {
              setDevices(prev => {
                const updated = [...prev];
                for (const updatedDevice of message.devices!) {
                  const index = updated.findIndex(d => d.id === updatedDevice.id);
                  if (index >= 0) {
                    updated[index] = updatedDevice;
                  } else {
                    updated.push(updatedDevice);
                  }
                }
                return updated;
              });
            }
            break;

          case 'error':
            console.error('[useDevicesWebSocket] Server error:', message.error);
            setError(message.error || 'Unknown server error');
            break;
        }
      } catch {
        console.error('[useDevicesWebSocket] Failed to parse message');
      }
    };

    ws.onerror = (event) => {
      console.error('[useDevicesWebSocket] WebSocket error:', event);
      setConnectionStatus('error');
    };

    ws.onclose = (event) => {
      console.log('[useDevicesWebSocket] Disconnected:', event.code, event.reason);
      setConnectionStatus('disconnected');
      wsRef.current = null;

      // Attempt reconnection if not intentionally closed
      if (!pausePolling && isTabVisible && event.code !== 1000) {
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`[useDevicesWebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          console.log('[useDevicesWebSocket] Max reconnect attempts reached, falling back to polling');
          setError('WebSocket connection lost. Using polling fallback.');
        }
      }
    };
  }, [pausePolling, isTabVisible]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    // Initial fetch to have data while WebSocket connects
    fetchDevices();
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect, fetchDevices]);

  // Reconnect when tab becomes visible, disconnect when hidden
  useEffect(() => {
    if (isTabVisible && !pausePolling) {
      connect();
    } else {
      disconnect();
    }
  }, [isTabVisible, pausePolling, connect, disconnect]);

  // Fallback polling if WebSocket fails
  useEffect(() => {
    // Only poll if WebSocket is not connected and we've exceeded max reconnect attempts
    if (connectionStatus !== 'connected' && reconnectAttempts.current >= maxReconnectAttempts) {
      if (pausePolling || !isTabVisible) return;

      const interval = setInterval(fetchDevices, 10000);
      return () => clearInterval(interval);
    }
  }, [connectionStatus, fetchDevices, pausePolling, isTabVisible]);

  // Update device (via HTTP, with optimistic update)
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
      // Server will trigger a WebSocket update after the command
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
    connectionStatus,
    refresh: fetchDevices,
    updateDevice,
    toggleDevice,
    setBrightness,
    setColor,
    setDeviceHidden,
  };
}
