
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

/**
 * A standard pseudo-random number generator
 */
export function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

/**
 * Generate a random string of 'length' base64url characters using Math.random
 */
export function randomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const charactersLength = characters.length;
  let result = '';
  for (let i = 0 ; i < length ; ++i) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

