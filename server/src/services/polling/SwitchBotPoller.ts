import type { Light } from '../../types/index.js';
import { DeviceTypePoller, type PollCallback } from './DeviceTypePoller.js';
import { RateLimiter } from './RateLimiter.js';
import * as switchbotService from '../switchbot.js';

const SWITCHBOT_POLL_INTERVAL = 120000; // 2 minutes - cloud API, 10k/day limit

/**
 * Polls SwitchBot devices every 30 seconds with rate limiting.
 * Uses the cloud API with a 10k/day limit (~2 req/min is safe).
 */
export class SwitchBotPoller extends DeviceTypePoller {
  private rateLimiter: RateLimiter;
  private lastDeviceCount = 5;

  constructor(onPoll: PollCallback) {
    super('switchbot', SWITCHBOT_POLL_INTERVAL, onPoll);
    this.rateLimiter = new RateLimiter(10000, 0.8);
  }

  isConfigured(): boolean {
    return switchbotService.isConfigured();
  }

  async fetchDevices(): Promise<Light[]> {
    // Check rate limit before making request
    if (!this.rateLimiter.canMakeRequest()) {
      console.warn('[SwitchBotPoller] Rate limit reached, skipping poll');
      return [];
    }

    // getAllDeviceStates makes 1 call for device list + 1 per supported device.
    // Estimate based on last known device count (default 5 for first poll).
    const estimatedCalls = 1 + this.lastDeviceCount;
    for (let i = 0; i < estimatedCalls; i++) {
      this.rateLimiter.recordRequest();
    }

    const devices = await switchbotService.getAllDeviceStates();
    this.lastDeviceCount = devices.length;
    return devices;
  }

  /**
   * Get rate limiter statistics.
   */
  getRateLimitStats() {
    return this.rateLimiter.getStats();
  }
}
