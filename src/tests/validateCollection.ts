import { expect } from 'vitest'

import {
	type Collection,
	isValidRef,
} from '../utils/Collection.ts'

/**
 * Check that the collection object is consistent, i.e. that all references are
 * either invalid or have a sound index and that they all reference the
 * associated collection.
 */
export function validateCollection<T>(collection: Collection<T>) {
	const { items, references } = collection;
	for (const ref of references) {
		expect(ref.collection).toBe(collection); // foreign reference
		if (isValidRef(ref)) {
			expect(ref.index >= 0 && ref.index < items.length).toBe(true); // out of range
		}
	}
}
