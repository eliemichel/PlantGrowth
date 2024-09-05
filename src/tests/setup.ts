/**
 * This setup file is called before each test
 */

import { beforeEach, afterEach } from 'vitest'

import { mulberry32, randomString } from '../utils/random.ts'

///////////////////////////////////////////////////
// Mock random
const originalRandom = Math.random;

export function resetMockRandom() {
	Math.random = mulberry32((1337 ^ 0xDEADBEEF)>>>0)
}

beforeEach(() => {
	resetMockRandom();
})

afterEach(() => {
	Math.random = originalRandom
})

///////////////////////////////////////////////////
// Polyfill for node < 19
import { webcrypto } from 'node:crypto'
globalThis.crypto ??= {
	...webcrypto as Crypto,
	randomUUID: () => `${randomString(8)}-${randomString(4)}-${randomString(4)}-${randomString(4)}-${randomString(12)}`
}
