import { MatcherState, ExpectationResult } from '@vitest/expect'
import { expect } from 'vitest'
import { Quaternion } from 'three'
import { Vector } from '../utils/vector.tsx'

/**
 * Custom matchers for vitest.
 * Make sure to declare types for these matchers in vitest.d.ts.
 * See https://vitest.dev/guide/extending-matchers
 */
export default {
	toBeCloseToQuaternion(this: MatcherState, actual: Quaternion, expected: Quaternion, precision: number): ExpectationResult {
		let pass = true;
		let message = "";

		const closeTo = (x: number, y: number, prec: number) => (
			expect.closeTo(y, prec).asymmetricMatch(x)
		);

		const actualArray = actual.toJSON();
		const expectedArray = expected.toJSON();
		for (let i = 0 ; i < 4 ; ++i) {
			if (!closeTo(actualArray[i], expectedArray[i], precision)) {
				pass = false;
				message = `element #${i} does not match`;
			}
		}

		return {
			// do not alter your "pass" based on isNot. Vitest does it for you
			pass,
			message: () => message,
			actual,
			expected,
		}
	},

	toBeCloseToVectorArray(this: MatcherState, actual: Vector[], expected: Vector[], precision: number): ExpectationResult {
		let pass = true;
		let message = "";

		const closeTo = (x: number, y: number, prec: number) => (
			expect.closeTo(y, prec).asymmetricMatch(x)
		);

		expect(actual.length).toBe(expected.length);
		for (let i = 0 ; i < actual.length ; ++i) {
			const actualP = actual[i];
			const expectedP = expected[i];
			expect(actualP.length).toBe(expectedP.length);
			for (let j = 0 ; j < actualP.length ; ++j) {
				if (!closeTo(actualP[j], expectedP[j], precision)) {
					pass = false;
					message = `component #${j} of element #${i} does not match`;
				}
			}
		}

		return {
			// do not alter your "pass" based on isNot. Vitest does it for you
			pass,
			message: () => message,
			actual,
			expected,
		}
	},
}
