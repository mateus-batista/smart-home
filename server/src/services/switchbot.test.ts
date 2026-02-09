/**
 * Tests for SwitchBot service
 */

import { describe, it, expect } from 'vitest';
import {
  getBlindTiltPosition,
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

  describe('getBlindTiltPosition', () => {
    it('should map preset brightness values to fixed commands', () => {
      expect(getBlindTiltPosition({ brightness: -100 })).toEqual({ direction: 'up', position: 0 });
      expect(getBlindTiltPosition({ brightness: -50 })).toEqual({ direction: 'up', position: 50 });
      expect(getBlindTiltPosition({ brightness: 0 })).toEqual({ direction: 'down', position: 100 });
      expect(getBlindTiltPosition({ brightness: 50 })).toEqual({ direction: 'down', position: 33 });
      expect(getBlindTiltPosition({ brightness: 100 })).toEqual({ direction: 'down', position: 0 });
    });

    it('should snap non-preset values to nearest preset', () => {
      expect(getBlindTiltPosition({ brightness: 80 })).toEqual({ direction: 'down', position: 0 });
      expect(getBlindTiltPosition({ brightness: 20 })).toEqual({ direction: 'down', position: 100 });
      expect(getBlindTiltPosition({ brightness: -75 })).toEqual({ direction: 'up', position: 0 });
    });

    it('should return open when on=true', () => {
      expect(getBlindTiltPosition({ on: true })).toEqual({ direction: 'down', position: 100 });
    });

    it('should return closed down when on=false', () => {
      expect(getBlindTiltPosition({ on: false })).toEqual({ direction: 'down', position: 0 });
    });

    it('should return null for empty state', () => {
      expect(getBlindTiltPosition({})).toBeNull();
    });
  });

  describe('getShadeCommand', () => {
    describe('Blind Tilt', () => {
      it('should send down;100 for open', () => {
        expect(getShadeCommand('Blind Tilt', { on: true })).toEqual({
          command: 'setPosition',
          parameter: 'down;100',
        });
      });

      it('should send down;0 for closed down', () => {
        expect(getShadeCommand('Blind Tilt', { on: false })).toEqual({
          command: 'setPosition',
          parameter: 'down;0',
        });
      });

      it('should send down;100 for open', () => {
        expect(getShadeCommand('Blind Tilt', { brightness: 0 })).toEqual({
          command: 'setPosition',
          parameter: 'down;100',
        });
      });

      it('should send up;0 for fully closed up', () => {
        expect(getShadeCommand('Blind Tilt', { brightness: -100 })).toEqual({
          command: 'setPosition',
          parameter: 'up;0',
        });
      });

      it('should send up;50 for half open up', () => {
        expect(getShadeCommand('Blind Tilt', { brightness: -50 })).toEqual({
          command: 'setPosition',
          parameter: 'up;50',
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
