/** Get visual openness for display purposes */
export function getVisualOpenness(position: number, isBlindTilt = false): number {
  if (isBlindTilt) {
    // Blind Tilt: -100 = closed up, 0 = open, +100 = closed down
    return Math.max(0, 100 - Math.abs(position));
  }
  // Regular shades: 0 = closed, 100 = fully open
  return position;
}
