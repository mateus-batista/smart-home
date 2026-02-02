import type { Light, LightWithRoomAndGroups } from '../../types/index.js';

export type DeviceType = 'hue' | 'nanoleaf' | 'switchbot';

// Enriched device type used in cache (may have room/group info)
export type EnrichedLight = Light & Partial<Pick<LightWithRoomAndGroups, 'roomId' | 'roomName' | 'hidden' | 'groups'>>;

export interface CacheEntry {
  device: EnrichedLight;
  lastUpdated: Date;
}

/**
 * Stores device state and detects changes via JSON comparison.
 * Used by pollers to determine which devices have changed state.
 */
export class DeviceCache {
  private cache = new Map<string, CacheEntry>();

  /**
   * Update devices in the cache and return only the ones that changed.
   */
  updateDevices(devices: EnrichedLight[]): EnrichedLight[] {
    const changedDevices: EnrichedLight[] = [];

    for (const device of devices) {
      const existing = this.cache.get(device.id);
      const hasChanged = !existing || this.hasDeviceChanged(existing.device, device);

      if (hasChanged) {
        changedDevices.push(device);
      }

      this.cache.set(device.id, {
        device,
        lastUpdated: new Date(),
      });
    }

    return changedDevices;
  }

  /**
   * Get all cached devices.
   */
  getAllDevices(): EnrichedLight[] {
    return Array.from(this.cache.values()).map(entry => entry.device);
  }

  /**
   * Get devices by type.
   */
  getDevicesByType(type: DeviceType): EnrichedLight[] {
    return this.getAllDevices().filter(device => device.type === type);
  }

  /**
   * Get a single device by ID.
   */
  getDevice(id: string): EnrichedLight | undefined {
    return this.cache.get(id)?.device;
  }

  /**
   * Remove devices by type (used when a service becomes unavailable).
   */
  removeDevicesByType(type: DeviceType): void {
    for (const [id, entry] of this.cache.entries()) {
      if (entry.device.type === type) {
        this.cache.delete(id);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Check if two devices have different states.
   * Compares the relevant state properties.
   */
  private hasDeviceChanged(oldDevice: EnrichedLight, newDevice: EnrichedLight): boolean {
    // Compare basic properties
    if (oldDevice.name !== newDevice.name) return true;
    if (oldDevice.reachable !== newDevice.reachable) return true;

    // Compare state
    const oldState = oldDevice.state;
    const newState = newDevice.state;

    if (oldState.on !== newState.on) return true;
    if (oldState.brightness !== newState.brightness) return true;
    if (oldState.colorMode !== newState.colorMode) return true;
    if (oldState.colorTemp !== newState.colorTemp) return true;

    // Compare color if present
    if (oldState.color || newState.color) {
      if (!oldState.color || !newState.color) return true;
      if (oldState.color.hue !== newState.color.hue) return true;
      if (oldState.color.saturation !== newState.color.saturation) return true;
      if (oldState.color.brightness !== newState.color.brightness) return true;
    }

    // Compare room/group info
    if (oldDevice.roomId !== newDevice.roomId) return true;
    if (oldDevice.roomName !== newDevice.roomName) return true;
    if (oldDevice.hidden !== newDevice.hidden) return true;

    return false;
  }
}
