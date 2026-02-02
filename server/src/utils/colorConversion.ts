import type { NormalizedColor } from '../types/index.js';

// Convert Hue API color values to normalized format
export function hueToNormalized(hue: number, sat: number, bri: number): NormalizedColor {
  return {
    hue: Math.round((hue / 65535) * 360),
    saturation: Math.round((sat / 254) * 100),
    brightness: Math.round((bri / 254) * 100),
  };
}

// Convert normalized color to Hue API format
export function normalizedToHue(color: NormalizedColor): { hue: number; sat: number; bri: number } {
  return {
    hue: Math.round((color.hue / 360) * 65535),
    sat: Math.round((color.saturation / 100) * 254),
    bri: Math.round((color.brightness / 100) * 254),
  };
}

// Convert Nanoleaf API color values to normalized format
export function nanoleafToNormalized(hue: number, sat: number, brightness: number): NormalizedColor {
  // Nanoleaf uses 0-360 for hue, 0-100 for sat/brightness - same as normalized
  return {
    hue,
    saturation: sat,
    brightness,
  };
}

// Convert normalized color to Nanoleaf API format
export function normalizedToNanoleaf(color: NormalizedColor): { hue: number; sat: number; brightness: number } {
  return {
    hue: color.hue,
    sat: color.saturation,
    brightness: color.brightness,
  };
}

// Convert color temperature from Kelvin to Hue mirek
export function kelvinToMirek(kelvin: number): number {
  return Math.round(1000000 / kelvin);
}

// Convert color temperature from Hue mirek to Kelvin
export function mirekToKelvin(mirek: number): number {
  return Math.round(1000000 / mirek);
}
