import type { Light } from '../../types/index.js';
import type { DeviceType } from './DeviceCache.js';

export type PollCallback = (type: DeviceType, devices: Light[]) => void;

/**
 * Abstract base class for device-type-specific pollers.
 * Each poller runs on its own interval and fetches devices from a specific integration.
 */
export abstract class DeviceTypePoller {
  protected intervalId: NodeJS.Timeout | null = null;
  protected isRunning = false;
  protected onPoll: PollCallback;
  protected intervalMs: number;
  protected deviceType: DeviceType;

  constructor(
    deviceType: DeviceType,
    intervalMs: number,
    onPoll: PollCallback
  ) {
    this.deviceType = deviceType;
    this.intervalMs = intervalMs;
    this.onPoll = onPoll;
  }

  /**
   * Start polling at the configured interval.
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log(`[${this.deviceType}Poller] Starting (interval: ${this.intervalMs}ms)`);

    // Do an initial poll immediately
    this.poll();

    // Then continue at the interval
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.intervalMs);
  }

  /**
   * Stop polling.
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log(`[${this.deviceType}Poller] Stopped`);
  }

  /**
   * Trigger an immediate poll (e.g., after a command is sent).
   * Resets the interval timer.
   */
  triggerImmediate(): void {
    if (!this.isRunning) return;

    // Stop and restart the interval to reset the timer
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Poll immediately
    this.poll();

    // Restart the interval
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.intervalMs);
  }

  /**
   * Check if the integration is configured/available.
   */
  abstract isConfigured(): Promise<boolean> | boolean;

  /**
   * Fetch devices from the integration.
   */
  abstract fetchDevices(): Promise<Light[]>;

  /**
   * Internal poll method that handles errors.
   */
  protected async poll(): Promise<void> {
    try {
      const configured = await this.isConfigured();
      if (!configured) {
        return;
      }

      const devices = await this.fetchDevices();
      this.onPoll(this.deviceType, devices);
    } catch (error) {
      console.error(`[${this.deviceType}Poller] Error polling:`, error);
    }
  }
}
