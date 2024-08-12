import 'vitest'
import { Quaternion } from 'three'
import { Vector } from './utils/vector.tsx'

interface CustomMatchers<R = unknown> {
  toBeCloseToQuaternion: (expected: Quaternion, precision: number) => R
  toBeCloseToVectorArray: (expected: Vector[], precision: number) => R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
