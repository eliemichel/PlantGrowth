/**
 * Utility function related to naive vector type (3-tuple of floats)
 * as opposed to vector3.tsx which provides utilities for Three's
 * Vector3 type.
 */

export type Vector = [number, number, number]

export function add(a: Vector, b: Vector): Vector {
  return [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
  ]
}

export function subtract(a: Vector, b: Vector): Vector {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
  ]
}

export function dot(a: Vector, b: Vector): number {
  return (
    a[0] * b[0] +
    a[1] * b[1] +
    a[2] * b[2]
  )
}

export function distance(a: Vector, b: Vector): number {
  const d = subtract(a, b);
  return Math.sqrt(dot(d, d));
}

export function addInPlace(a: Vector, b: Vector) {
  a[0] += b[0];
  a[1] += b[1];
  a[2] += b[2];
}

export function copyVector(dst: Vector, src: Vector) {
  dst[0] = src[0];
  dst[1] = src[1];
  dst[2] = src[2];
}
