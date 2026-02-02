import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { LightWithRoomAndGroups } from '../../types/index.js';
import type { PollingManager } from '../polling/PollingManager.js';
import { randomUUID } from 'crypto';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
}

interface ServerMessage {
  type: 'connected' | 'devices:full' | 'devices:update' | 'pong' | 'error';
  clientId?: string;
  devices?: LightWithRoomAndGroups[];
  error?: string;
}

interface ClientMessage {
  type: 'ping';
}

/**
 * Manages WebSocket connections and broadcasts device updates to all clients.
 */
export class WebSocketBroadcaster {
  private wss: WebSocketServer;
  private clients = new Map<string, ClientConnection>();
  private pollingManager: PollingManager;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server, pollingManager: PollingManager, path = '/ws/devices') {
    this.pollingManager = pollingManager;

    // Create WebSocket server on specific path
    this.wss = new WebSocketServer({
      server,
      path,
    });

    // Set up connection handling
    this.wss.on('connection', this.handleConnection.bind(this));

    // Start heartbeat check
    this.startHeartbeat();

    // Register for device changes
    this.pollingManager.setOnDeviceChange(this.handleDeviceChange.bind(this));

    console.log(`[WebSocketBroadcaster] WebSocket server started on ${path}`);
  }

  /**
   * Handle new WebSocket connection.
   */
  private async handleConnection(ws: WebSocket): Promise<void> {
    const clientId = randomUUID();
    const client: ClientConnection = {
      id: clientId,
      ws,
      isAlive: true,
    };

    this.clients.set(clientId, client);
    this.pollingManager.clientConnected();

    console.log(`[WebSocketBroadcaster] Client connected: ${clientId} (total: ${this.clients.size})`);

    // Send connected message
    this.send(ws, { type: 'connected', clientId });

    // Send current device state
    const devices = await this.pollingManager.getAllDevices();
    this.send(ws, { type: 'devices:full', devices });

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;
        this.handleClientMessage(client, message);
      } catch {
        // Ignore invalid messages
      }
    });

    // Handle pong responses for heartbeat
    ws.on('pong', () => {
      client.isAlive = true;
    });

    // Handle disconnection
    ws.on('close', () => {
      this.clients.delete(clientId);
      this.pollingManager.clientDisconnected();
      console.log(`[WebSocketBroadcaster] Client disconnected: ${clientId} (total: ${this.clients.size})`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[WebSocketBroadcaster] Client error: ${clientId}`, error);
    });
  }

  /**
   * Handle message from client.
   */
  private handleClientMessage(client: ClientConnection, message: ClientMessage): void {
    switch (message.type) {
      case 'ping':
        this.send(client.ws, { type: 'pong' });
        break;
    }
  }

  /**
   * Handle device changes from polling manager.
   */
  private handleDeviceChange(changedDevices: LightWithRoomAndGroups[], allDevices: LightWithRoomAndGroups[]): void {
    // Broadcast update to all connected clients
    this.broadcast({ type: 'devices:update', devices: changedDevices });
  }

  /**
   * Broadcast a full device list to all clients.
   */
  async broadcastFullState(): Promise<void> {
    const devices = await this.pollingManager.getAllDevices();
    this.broadcast({ type: 'devices:full', devices });
  }

  /**
   * Send message to a specific client.
   */
  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients.
   */
  private broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  /**
   * Start heartbeat to detect dead connections.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients.entries()) {
        if (!client.isAlive) {
          // Connection is dead, terminate it
          console.log(`[WebSocketBroadcaster] Terminating dead connection: ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
          this.pollingManager.clientDisconnected();
          continue;
        }

        // Mark as not alive and send ping
        client.isAlive = false;
        client.ws.ping();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Close the WebSocket server.
   */
  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.clients.clear();

    this.wss.close();
    console.log('[WebSocketBroadcaster] WebSocket server closed');
  }
}
