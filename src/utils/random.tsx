
/**
 * Sample an integer number between a and b, bounds included.
 */
export function randomInt(min: number, max: number): number {
  if (max < min) {
    throw Error(`Minimum (${min}) must not be higher than maximum (${max})`);
  }
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Sample a float number between a (inclusive) and b (exclusive).
 */
export function randomFloat(min: number, max: number): number {
  if (max < min) {
    throw Error(`Minimum (${min}) must not be higher than maximum (${max})`);
  }
  return min + Math.random() * (max - min);
}
