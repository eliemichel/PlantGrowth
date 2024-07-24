/**
 * Represents the external conditions in which a plant grows.
 */
export type Environment = {
  // In degree celcius (°C)
  temperature: number,
}

export function createDefaultEnvironment(): Environment {
  return {
    temperature: 20.0,
  }
}
