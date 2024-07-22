
export type Vector = [number, number, number]

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
