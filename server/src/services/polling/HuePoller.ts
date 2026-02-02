import type { Light } from '../../types/index.js';
import { DeviceTypePoller, type PollCallback } from './DeviceTypePoller.js';
import * as hueService from '../hue.js';

const HUE_POLL_INTERVAL = 2500; // 2.5 seconds - local bridge, no rate limits

/**
 * Polls Philips Hue lights every 2.5 seconds.
 * Uses the local bridge API with no rate limits.
 */
export class HuePoller extends DeviceTypePoller {
  constructor(onPoll: PollCallback) {
    super('hue', HUE_POLL_INTERVAL, onPoll);
  }

  async isConfigured(): Promise<boolean> {
    return await hueService.isConfigured();
  }

  async fetchDevices(): Promise<Light[]> {
    return await hueService.getLights();
  }
}
