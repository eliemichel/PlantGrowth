/**
 * Utility function related to Three's Vector3 type as opposed to vector.tsx
 * which provides utilities for naive vector type (3-tuple of floats).
 * NB: This is more a set of utils for Three in general (there are also Matrix4-related utils)
 */

import { Vector3, Matrix4, Quaternion } from 'three'
import { Vector } from './vector.ts'

export function toVector(pt: Vector3): Vector {
  return [ pt.x, pt.y, pt.z ];
}

/**
 * This modifies a in place. The length of a remains unchanged, and its
 * direction is interpolated, with it being the original direction of a if
 * factor is 0 and the direction of b if factor is 1.
 * NB: b is assumed to be a unit vector.
 */
export function applyLerpDirection(a: Vector3, b: Vector3, factor: number) {
  // TODO: Memoize
  const q = new Quaternion();
  q.identity();
  const identity = new Quaternion();
  const ua = new Vector3();

  ua.copy(a);
  ua.normalize();

  q.setFromUnitVectors(ua, b);
  q.slerp(identity, 1.0 - factor);
  a.applyQuaternion(q);
}

export function formatMatrix4(m: Matrix4) {
  const e = m.elements;
  return (
    "[" + e[0] + ", " + e[4] + ", " + e[8] + ", " + e[12] + ",\n" +
    " " + e[1] + ", " + e[5] + ", " + e[9] + ", " + e[13] + ",\n" +
    " " + e[2] + ", " + e[6] + ", " + e[10] + ", " + e[14] + ",\n" +
    " " + e[3] + ", " + e[7] + ", " + e[11] + ", " + e[15] + "]"
  )
}
