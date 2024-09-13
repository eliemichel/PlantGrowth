import 'vitest'
import { Quaternion } from 'three'
import { Vector } from './utils/vector.ts'

interface CustomMatchers<R = Quaternion> {
  toBeCloseToQuaternion: (expected: Quaternion, precision: number) => R
}

interface CustomMatchers<R = Vector[]> {
  toBeCloseToVectorArray: (expected: Vector[], precision: number) => R
}

interface CustomMatchers<R = number[]> {
  toBeCloseToArray: (expected: number[], precision: number) => R
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
