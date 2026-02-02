import type { Light, LightWithRoomAndGroups } from '../../types/index.js';
import { DeviceCache, type DeviceType, type EnrichedLight } from './DeviceCache.js';
import { HuePoller } from './HuePoller.js';
import { NanoleafPoller } from './NanoleafPoller.js';
import { SwitchBotPoller } from './SwitchBotPoller.js';
import { syncDevices, getDevicesFromDb } from '../deviceSync.js';

export type DeviceChangeCallback = (changedDevices: LightWithRoomAndGroups[], allDevices: LightWithRoomAndGroups[]) => void;

/**
 * Orchestrates device polling across all integrations.
 * Manages client connections to pause/resume polling.
 */
export class PollingManager {
  private cache: DeviceCache;
  private huePoller: HuePoller;
  private nanoleafPoller: NanoleafPoller;
  private switchBotPoller: SwitchBotPoller;
  private clientCount = 0;
  private onDeviceChange: DeviceChangeCallback | null = null;

  constructor() {
    this.cache = new DeviceCache();

    // Create pollers with callback to handle device updates
    const handlePoll = this.handleDeviceUpdate.bind(this);
    this.huePoller = new HuePoller(handlePoll);
    this.nanoleafPoller = new NanoleafPoller(handlePoll);
    this.switchBotPoller = new SwitchBotPoller(handlePoll);
  }

  /**
   * Set the callback for device changes.
   */
  setOnDeviceChange(callback: DeviceChangeCallback): void {
    this.onDeviceChange = callback;
  }

  /**
   * Called when a client connects.
   * Starts polling if this is the first client.
   */
  clientConnected(): void {
    this.clientCount++;
    console.log(`[PollingManager] Client connected (total: ${this.clientCount})`);

    if (this.clientCount === 1) {
      this.startPolling();
    }
  }

  /**
   * Called when a client disconnects.
   * Stops polling if no clients remain.
   */
  clientDisconnected(): void {
    this.clientCount = Math.max(0, this.clientCount - 1);
    console.log(`[PollingManager] Client disconnected (total: ${this.clientCount})`);

    if (this.clientCount === 0) {
      this.stopPolling();
    }
  }

  /**
   * Get the current client count.
   */
  getClientCount(): number {
    return this.clientCount;
  }

  /**
   * Get all cached devices (enriched with DB data).
   */
  async getAllDevices(): Promise<LightWithRoomAndGroups[]> {
    return await this.enrichDevices(this.cache.getAllDevices());
  }

  /**
   * Trigger immediate refresh for a specific device type.
   * Called after a command is sent to ensure quick state update.
   */
  triggerImmediateRefresh(deviceId: string): void {
    if (deviceId.startsWith('hue-')) {
      this.huePoller.triggerImmediate();
    } else if (deviceId.startsWith('switchbot-')) {
      this.switchBotPoller.triggerImmediate();
    } else {
      // Nanoleaf IDs are UUIDs
      this.nanoleafPoller.triggerImmediate();
    }
  }

  /**
   * Get rate limit stats for SwitchBot.
   */
  getSwitchBotRateLimitStats() {
    return this.switchBotPoller.getRateLimitStats();
  }

  /**
   * Start all pollers.
   */
  private startPolling(): void {
    console.log('[PollingManager] Starting polling');
    this.huePoller.start();
    this.nanoleafPoller.start();
    this.switchBotPoller.start();
  }

  /**
   * Stop all pollers.
   */
  private stopPolling(): void {
    console.log('[PollingManager] Stopping polling (no clients)');
    this.huePoller.stop();
    this.nanoleafPoller.stop();
    this.switchBotPoller.stop();
  }

  /**
   * Handle device updates from a poller.
   */
  private async handleDeviceUpdate(type: DeviceType, devices: Light[]): Promise<void> {
    // Update cache and get changed devices
    const changedDevices = this.cache.updateDevices(devices);

    // Sync to database (in background, don't await)
    if (devices.length > 0) {
      syncDevices(devices).catch(err => {
        console.error('[PollingManager] Error syncing to database:', err);
      });
    }

    // Notify callback if there are changes
    if (changedDevices.length > 0 && this.onDeviceChange) {
      const allDevices = await this.enrichDevices(this.cache.getAllDevices());
      const enrichedChanges = await this.enrichDevices(changedDevices);
      this.onDeviceChange(enrichedChanges, allDevices);
    }
  }

  /**
   * Enrich devices with room/group info from the database.
   */
  private async enrichDevices(devices: EnrichedLight[]): Promise<LightWithRoomAndGroups[]> {
    if (devices.length === 0) return [];

    try {
      const dbDevices = await getDevicesFromDb();
      const dbDeviceMap = new Map(dbDevices.map(d => [d.externalId, d]));

      return devices.map(device => {
        const dbDevice = dbDeviceMap.get(device.id);
        return {
          ...device,
          roomId: dbDevice?.roomId ?? null,
          roomName: dbDevice?.room?.name ?? null,
          hidden: dbDevice?.hidden ?? false,
          groups: dbDevice?.groups?.map(g => ({
            id: g.group.id,
            name: g.group.name,
          })) ?? [],
        };
      });
    } catch (error) {
      console.error('[PollingManager] Error enriching devices:', error);
      return devices.map(d => ({
        ...d,
        roomId: null,
        roomName: null,
        hidden: false,
        groups: [] as { id: string; name: string }[],
      }));
    }
  }
}
