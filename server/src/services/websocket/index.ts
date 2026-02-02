import type { Server } from 'http';
import type { PollingManager } from '../polling/PollingManager.js';
import { WebSocketBroadcaster } from './WebSocketBroadcaster.js';

export { WebSocketBroadcaster };

/**
 * Set up WebSocket support for device state broadcasting.
 */
export function setupWebSocket(
  server: Server,
  pollingManager: PollingManager
): WebSocketBroadcaster {
  return new WebSocketBroadcaster(server, pollingManager);
}
