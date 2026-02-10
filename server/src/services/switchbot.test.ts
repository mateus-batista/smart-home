/**
 * Tests for SwitchBot service
 */

import { describe, it, expect } from 'vitest';
import {
  parseTiltStatus,
  TILT_COMMANDS,
  getShadeCommand,
  rgbToHsl,
  hslToRgb,
  SHADE_TYPES,
  LIGHT_TYPES,
} from './switchbot.js';

describe('SwitchBot Service', () => {
  describe('Device Type Constants', () => {
    it('should include Blind Tilt in SHADE_TYPES', () => {
      expect(SHADE_TYPES).toContain('Blind Tilt');
    });

    it('should include Curtain types in SHADE_TYPES', () => {
      expect(SHADE_TYPES).toContain('Curtain');
      expect(SHADE_TYPES).toContain('Curtain3');
    });

    it('should include Roller Shade in SHADE_TYPES', () => {
      expect(SHADE_TYPES).toContain('Roller Shade');
    });

    it('should include Color Bulb in LIGHT_TYPES', () => {
      expect(LIGHT_TYPES).toContain('Color Bulb');
    });
  });

  describe('parseTiltStatus', () => {
    it('should parse known API-reported positions', () => {
      expect(parseTiltStatus('down', 0)).toBe('closed-down');
      expect(parseTiltStatus('down', 16)).toBe('half-closed');
      expect(parseTiltStatus('down', 50)).toBe('open');
      expect(parseTiltStatus('up', 75)).toBe('half-open');
      expect(parseTiltStatus('up', 100)).toBe('closed-up');
    });

    it('should snap nearby values to the closest position', () => {
      // Down direction
      expect(parseTiltStatus('down', 5)).toBe('closed-down');
      expect(parseTiltStatus('down', 10)).toBe('half-closed');
      expect(parseTiltStatus('down', 30)).toBe('half-closed');
      expect(parseTiltStatus('down', 40)).toBe('open');
      // Up direction
      expect(parseTiltStatus('up', 80)).toBe('half-open');
      expect(parseTiltStatus('up', 95)).toBe('closed-up');
    });
  });

  describe('TILT_COMMANDS', () => {
    it('should have commands for all 5 positions', () => {
      expect(TILT_COMMANDS['closed-up']).toBe('up;0');
      expect(TILT_COMMANDS['half-open']).toBe('up;50');
      expect(TILT_COMMANDS['open']).toBe('down;100');
      expect(TILT_COMMANDS['half-closed']).toBe('down;33');
      expect(TILT_COMMANDS['closed-down']).toBe('down;0');
    });
  });

  describe('getShadeCommand', () => {
    describe('Blind Tilt', () => {
      it('should send correct command for each tilt position', () => {
        expect(getShadeCommand('Blind Tilt', { tiltPosition: 'open' })).toEqual({
          command: 'setPosition',
          parameter: 'down;100',
        });
        expect(getShadeCommand('Blind Tilt', { tiltPosition: 'closed-down' })).toEqual({
          command: 'setPosition',
          parameter: 'down;0',
        });
        expect(getShadeCommand('Blind Tilt', { tiltPosition: 'closed-up' })).toEqual({
          command: 'setPosition',
          parameter: 'up;0',
        });
        expect(getShadeCommand('Blind Tilt', { tiltPosition: 'half-open' })).toEqual({
          command: 'setPosition',
          parameter: 'up;50',
        });
        expect(getShadeCommand('Blind Tilt', { tiltPosition: 'half-closed' })).toEqual({
          command: 'setPosition',
          parameter: 'down;33',
        });
      });

      it('should send open for on=true', () => {
        expect(getShadeCommand('Blind Tilt', { on: true })).toEqual({
          command: 'setPosition',
          parameter: 'down;100',
        });
      });

      it('should send closed-down for on=false', () => {
        expect(getShadeCommand('Blind Tilt', { on: false })).toEqual({
          command: 'setPosition',
          parameter: 'down;0',
        });
      });

      it('should return null for empty state', () => {
        expect(getShadeCommand('Blind Tilt', {})).toBeNull();
      });
    });

    describe('Curtain', () => {
      it('should return turnOn for on=true', () => {
        const result = getShadeCommand('Curtain', { on: true });
        expect(result).toEqual({
          command: 'turnOn',
          parameter: 'default',
        });
      });

      it('should return turnOff for on=false', () => {
        const result = getShadeCommand('Curtain', { on: false });
        expect(result).toEqual({
          command: 'turnOff',
          parameter: 'default',
        });
      });

      it('should return setPosition with position format for brightness', () => {
        const result = getShadeCommand('Curtain', { brightness: 75 });
        expect(result).toEqual({
          command: 'setPosition',
          parameter: '0,ff,75',
        });
      });
    });

    describe('Curtain3', () => {
      it('should return turnOn for on=true', () => {
        const result = getShadeCommand('Curtain3', { on: true });
        expect(result).toEqual({
          command: 'turnOn',
          parameter: 'default',
        });
      });

      it('should return turnOff for on=false', () => {
        const result = getShadeCommand('Curtain3', { on: false });
        expect(result).toEqual({
          command: 'turnOff',
          parameter: 'default',
        });
      });
    });

    describe('Roller Shade', () => {
      it('should return fullyOpen for on=true', () => {
        const result = getShadeCommand('Roller Shade', { on: true });
        expect(result).toEqual({
          command: 'fullyOpen',
          parameter: 'default',
        });
      });

      it('should return closeDown for on=false', () => {
        const result = getShadeCommand('Roller Shade', { on: false });
        expect(result).toEqual({
          command: 'closeDown',
          parameter: 'default',
        });
      });

      it('should return setPosition with position format for brightness', () => {
        const result = getShadeCommand('Roller Shade', { brightness: 50 });
        expect(result).toEqual({
          command: 'setPosition',
          parameter: '0,ff,50',
        });
      });
    });
  });

  describe('Color Conversion', () => {
    describe('rgbToHsl', () => {
      it('should convert pure red correctly', () => {
        const result = rgbToHsl(255, 0, 0);
        expect(result.hue).toBe(0);
        expect(result.saturation).toBe(100);
        expect(result.brightness).toBe(50);
      });

      it('should convert pure green correctly', () => {
        const result = rgbToHsl(0, 255, 0);
        expect(result.hue).toBe(120);
        expect(result.saturation).toBe(100);
        expect(result.brightness).toBe(50);
      });

      it('should convert pure blue correctly', () => {
        const result = rgbToHsl(0, 0, 255);
        expect(result.hue).toBe(240);
        expect(result.saturation).toBe(100);
        expect(result.brightness).toBe(50);
      });

      it('should convert white correctly', () => {
        const result = rgbToHsl(255, 255, 255);
        expect(result.hue).toBe(0);
        expect(result.saturation).toBe(0);
        expect(result.brightness).toBe(100);
      });

      it('should convert black correctly', () => {
        const result = rgbToHsl(0, 0, 0);
        expect(result.hue).toBe(0);
        expect(result.saturation).toBe(0);
        expect(result.brightness).toBe(0);
      });

      it('should convert gray correctly', () => {
        const result = rgbToHsl(128, 128, 128);
        expect(result.hue).toBe(0);
        expect(result.saturation).toBe(0);
        expect(result.brightness).toBe(50);
      });
    });

    describe('hslToRgb', () => {
      it('should convert pure red correctly', () => {
        const result = hslToRgb(0, 100, 50);
        expect(result.r).toBe(255);
        expect(result.g).toBe(0);
        expect(result.b).toBe(0);
      });

      it('should convert pure green correctly', () => {
        const result = hslToRgb(120, 100, 50);
        expect(result.r).toBe(0);
        expect(result.g).toBe(255);
        expect(result.b).toBe(0);
      });

      it('should convert pure blue correctly', () => {
        const result = hslToRgb(240, 100, 50);
        expect(result.r).toBe(0);
        expect(result.g).toBe(0);
        expect(result.b).toBe(255);
      });

      it('should convert white correctly', () => {
        const result = hslToRgb(0, 0, 100);
        expect(result.r).toBe(255);
        expect(result.g).toBe(255);
        expect(result.b).toBe(255);
      });

      it('should convert black correctly', () => {
        const result = hslToRgb(0, 0, 0);
        expect(result.r).toBe(0);
        expect(result.g).toBe(0);
        expect(result.b).toBe(0);
      });
    });

    describe('round-trip conversion', () => {
      it('should convert RGB -> HSL -> RGB without significant loss', () => {
        const original = { r: 100, g: 150, b: 200 };
        const hsl = rgbToHsl(original.r, original.g, original.b);
        const converted = hslToRgb(hsl.hue, hsl.saturation, hsl.brightness);

        // Allow small rounding differences
        expect(Math.abs(converted.r - original.r)).toBeLessThanOrEqual(2);
        expect(Math.abs(converted.g - original.g)).toBeLessThanOrEqual(2);
        expect(Math.abs(converted.b - original.b)).toBeLessThanOrEqual(2);
      });
    });
  });
});
