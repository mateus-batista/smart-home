import type { TiltPosition } from '../types/devices';

export const TILT_LABELS: Record<TiltPosition, string> = {
  'closed-up': 'Closed Up',
  'half-open': 'Half Open',
  'open': 'Open',
  'half-closed': 'Half Closed',
  'closed-down': 'Closed Down',
};

export const TILT_VISUAL_OPENNESS: Record<TiltPosition, number> = {
  'closed-up': 0,
  'half-open': 50,
  'open': 100,
  'half-closed': 50,
  'closed-down': 0,
};

export const TILT_POSITION_ORDER: TiltPosition[] = [
  'closed-up', 'half-open', 'open', 'half-closed', 'closed-down',
];
