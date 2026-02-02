import { readFileSync, existsSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { prisma } from '../services/database.js';
import type { DeviceConfig } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = join(__dirname, '../config/devices.json');
const MIGRATED_PATH = join(__dirname, '../config/devices.json.migrated');

export async function migrateConfig(): Promise<void> {
  // Check if database already has config
  const existingHueConfig = await prisma.hueBridgeConfig.findUnique({
    where: { id: 'singleton' },
  });
  const existingNanoleafCount = await prisma.nanoleafConfig.count();

  if (existingHueConfig || existingNanoleafCount > 0) {
    console.log('[Migration] Database already has config, skipping migration');
    return;
  }

  // Check if devices.json exists
  if (!existsSync(CONFIG_PATH)) {
    console.log('[Migration] No devices.json found, skipping migration');
    return;
  }

  console.log('[Migration] Starting config migration from JSON to database...');

  try {
    const data = readFileSync(CONFIG_PATH, 'utf-8');
    const config: DeviceConfig = JSON.parse(data);

    // Migrate Hue config
    if (config.hue && (config.hue.bridgeIp || config.hue.username)) {
      await prisma.hueBridgeConfig.create({
        data: {
          id: 'singleton',
          bridgeIp: config.hue.bridgeIp,
          username: config.hue.username,
        },
      });
      console.log('[Migration] Hue config migrated successfully');
    }

    // Migrate Nanoleaf devices
    if (config.nanoleaf && config.nanoleaf.length > 0) {
      for (const device of config.nanoleaf) {
        await prisma.nanoleafConfig.create({
          data: {
            id: device.id,
            name: device.name,
            ip: device.ip,
            authToken: device.authToken,
          },
        });
      }
      console.log(`[Migration] ${config.nanoleaf.length} Nanoleaf device(s) migrated successfully`);
    }

    // Rename the old config file
    renameSync(CONFIG_PATH, MIGRATED_PATH);
    console.log('[Migration] devices.json renamed to devices.json.migrated');

    console.log('[Migration] Config migration completed successfully');
  } catch (error) {
    console.error('[Migration] Error during migration:', error);
    throw error;
  }
}
