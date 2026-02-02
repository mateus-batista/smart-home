import type { Light } from '../../types/index.js';
import { DeviceTypePoller, type PollCallback } from './DeviceTypePoller.js';
import * as nanoleafService from '../nanoleaf.js';

const NANOLEAF_POLL_INTERVAL = 4000; // 4 seconds - local API, no rate limits

/**
 * Polls Nanoleaf devices every 4 seconds.
 * Uses the local API with no rate limits.
 */
export class NanoleafPoller extends DeviceTypePoller {
  constructor(onPoll: PollCallback) {
    super('nanoleaf', NANOLEAF_POLL_INTERVAL, onPoll);
  }

  async isConfigured(): Promise<boolean> {
    const devices = await nanoleafService.getDevices();
    return devices.length > 0;
  }

  async fetchDevices(): Promise<Light[]> {
    return await nanoleafService.getAllDeviceStates();
  }
}
