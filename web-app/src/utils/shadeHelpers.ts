/** Get visual openness for display purposes */
export function getVisualOpenness(position: number): number {
  // For both Blind Tilt and regular shades: position directly maps to openness
  // 0 = closed, 100 = fully open
  return position;
}
