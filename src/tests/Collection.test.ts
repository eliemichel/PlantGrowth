import { expect, test } from 'vitest'
import {
	Collection,
	releaseRef,
	isValidRef,
	deref,
} from '../utils/Collection.ts'

import { validateCollection } from './validateCollection.ts'

type Item = {
	foo: number,
	bar: string,
}

test('New collection has no item nor references', () => {

	const collec = new Collection<Item>();

validateCollection(collec);
	expect(collec.items.length).toBe(0);
	expect(collec.references.size).toBe(0);
})

test('Reference to an unexisting item is invalid', () => {
	const collec = new Collection<Item>();

	const ref1 = collec.createRef(0);
	expect(ref1.index).toBe(-1);

	collec.append({ foo: 42, bar: "lorem ipsum" });
	validateCollection(collec);

	// This is now valid
	const ref2 = collec.createRef(0);
	expect(ref2.index).toBe(0);

	// Out of range (upper) is invalid
	const ref3 = collec.createRef(1);
	expect(ref3.index).toBe(-1);

	// Out of range (lower) is invalid
	const ref4 = collec.createRef(-4);
	expect(ref4.index).toBe(-1);

	// Non-integer is invalid
	const ref5 = collec.createRef(0.5);
	expect(ref5.index).toBe(-1);

	validateCollection(collec);
})

test('Releasing references drops them', () => {
	const collec = new Collection<Item>();
	collec.append({ foo: 42, bar: "lorem ipsum" });
	validateCollection(collec);

	const ref = collec.createRef(0);
	// Ref is valid
	expect(ref.index).not.toBe(-1);

	// There is one pending reference
	expect(collec.references.size).toBe(1);

	// Invalid references do not need to be released
	const invalidRef = collec.createRef(999);
	expect(invalidRef.index).toBe(-1);
	expect(collec.references.size).toBe(1);

	releaseRef(ref);

	// Ref is now invalid
	expect(ref.index).toBe(-1);

	// Releasing an invalid index is ok
	releaseRef(ref);

	// Reference is no longer pending
	expect(collec.references.size).toBe(0);
	validateCollection(collec);
})

test('Dereferencing utils work', () => {
	const collec = new Collection<Item>();
	collec.append({ foo: 0, bar: "alpha" })
	collec.append({ foo: 1, bar: "beta" })
	collec.append({ foo: 2, bar: "gamma" })
	collec.append({ foo: 3, bar: "delta" })
	collec.append({ foo: 4, bar: "epsilon" })
	validateCollection(collec);

	const refs = Array.from({ length: 5 }).map((_, idx) => collec.createRef(idx));
	expect(collec.references.size).toBe(5);

	// Test invalid ref
	const invalid = collec.createInvalidRef();
	expect(collec.references.size).toBe(5); // invalid references are not added to the pool -> TODO: maybe they should, for Merge
	expect(isValidRef(invalid)).toBe(false);
	expect(deref(invalid)).toBe(undefined);
	
	// Refs are valid
	refs.forEach((r, idx) => {
		expect(r.index).toBe(idx);
		expect(r.collection).toBe(collec);
		expect(deref(r)).toBe(collec.items[idx]);
	});

	// Release
	for (const r of refs) {
		releaseRef(r);
		expect(r.index).toBe(-1);
	}

	// Reference is no longer pending
	expect(collec.references.size).toBe(0);
	validateCollection(collec);
})

test('Removing element offset references', () => {
	const collec = new Collection<Item>();
	collec.append({ foo: 0, bar: "alpha" })
	collec.append({ foo: 1, bar: "beta" })
	collec.append({ foo: 2, bar: "gamma" })
	collec.append({ foo: 3, bar: "delta" })
	collec.append({ foo: 4, bar: "epsilon" })
	validateCollection(collec);

	const refs = Array.from({ length: 5 }).map((_, idx) => collec.createRef(idx));
	
	// Refs are valid
	for (const r of refs) {
		expect(r.index).not.toBe(-1);
	}
	expect(collec.references.size).toBe(5);

	// Remove an element
	collec.removeAt(2);
	validateCollection(collec);

	// Reference pointing at the removed element is now invalid
	expect(refs[2].index).toBe(-1);
	// And it is no longer in the list of references
	expect(collec.references.size).toBe(4);

	// Previous references are unchanged
	expect(refs[0].index).toBe(0);
	expect(refs[1].index).toBe(1);

	// Next references are decremented
	expect(refs[3].index).toBe(2);
	expect(refs[4].index).toBe(3);

	// Release
	for (const r of refs) {
		releaseRef(r);
		expect(r.index).toBe(-1);
	}

	// Reference is no longer pending
	expect(collec.references.size).toBe(0);
	validateCollection(collec);
})

test('Inserting element offset references', () => {
	const collec = new Collection<Item>();
	collec.append({ foo: 0, bar: "alpha" })
	collec.append({ foo: 1, bar: "beta" })
	collec.append({ foo: 2, bar: "gamma" })
	collec.append({ foo: 3, bar: "delta" })
	collec.append({ foo: 4, bar: "epsilon" })
	validateCollection(collec);

	const refs = Array.from({ length: 5 }).map((_, idx) => collec.createRef(idx));
	
	// Refs are valid
	for (const r of refs) {
		expect(r.index).not.toBe(-1);
	}
	expect(collec.references.size).toBe(5);

	// Insert an element
	collec.insertBefore(2, { foo: 1.5, bar: "hey" });
	validateCollection(collec);

	// Previous references are unchanged
	expect(refs[0].index).toBe(0);
	expect(refs[1].index).toBe(1);

	// Next references are incremented
	expect(refs[2].index).toBe(3);
	expect(refs[3].index).toBe(4);
	expect(refs[4].index).toBe(5);

	// Release
	for (const r of refs) {
		releaseRef(r);
		expect(r.index).toBe(-1);
	}

	// Reference is no longer pending
	expect(collec.references.size).toBe(0);
	validateCollection(collec);
})

test('Merging collections updates references', () => {
	const collecA = new Collection<Item>();
	collecA.append({ foo: 0, bar: "a" })
	collecA.append({ foo: 1, bar: "a" })
	collecA.append({ foo: 2, bar: "a" })
	collecA.append({ foo: 3, bar: "a" })
	collecA.append({ foo: 4, bar: "a" })
	validateCollection(collecA);

	const collecB = new Collection<Item>();
	collecB.append({ foo: 0, bar: "b" })
	collecB.append({ foo: 1, bar: "b" })
	collecB.append({ foo: 2, bar: "b" })
	collecB.append({ foo: 3, bar: "b" })
	validateCollection(collecB);

	const refsA = Array.from({ length: 5 }).map((_, idx) => collecA.createRef(idx));

	const refsB = Array.from({ length: 4 }).map((_, idx) => collecB.createRef(idx));
	
	// Refs are valid
	for (const r of refsA) {
		expect(r.index).not.toBe(-1);
		expect(r.collection).toBe(collecA);
	}
	expect(collecA.references.size).toBe(5);
	for (const r of refsB) {
		expect(r.index).not.toBe(-1);
		expect(r.collection).toBe(collecB);
	}
	expect(collecB.references.size).toBe(4);

	// Merge collections
	collecA.merge(collecB);
	validateCollection(collecA);
	validateCollection(collecB);

	// The merged collection is cleared
	expect(collecB.items.length).toBe(0)
	expect(collecB.references.size).toBe(0)

	// References to A are unchanged
	refsA.forEach((r, idx) => {
		expect(r.index).toBe(idx);
		expect(r.collection).toBe(collecA);
	});

	// References to B have been updated
	refsB.forEach((r, idx) => {
		expect(r.index).toBe(idx + 5);
		expect(r.collection).toBe(collecA);
	});

	// Release
	for (const r of refsA) {
		releaseRef(r);
		expect(r.index).toBe(-1);
	}
	for (const r of refsB) {
		releaseRef(r);
		expect(r.index).toBe(-1);
	}

	// Reference is no longer pending
	expect(collecA.references.size).toBe(0);
	expect(collecB.references.size).toBe(0);
	validateCollection(collecA);
	validateCollection(collecB);
})

test('Transforming collection works', () => {
	const collec = new Collection<Item>();
	collec.append({ foo: 0, bar: "alpha" })
	collec.append({ foo: 1, bar: "beta" })
	collec.append({ foo: 2, bar: "gamma" })
	collec.append({ foo: 3, bar: "delta" })
	collec.append({ foo: 4, bar: "epsilon" })
	validateCollection(collec);

	const refs = Array.from({ length: 5 }).map((_, idx) => collec.createRef(idx));
	expect(collec.references.size).toBe(5);

	const transformed = collec.transform(item => ({ ...item, foo: item.foo + 42 }))

	expect(collec.items.length).toBe(0)
	expect(collec.references.size).toBe(0)
	expect(transformed.items.length).toBe(5)
	expect(transformed.references.size).toBe(5)

	// Refs are valid
	refs.forEach((r, idx) => {
		expect(isValidRef(r)).toBe(true);
		expect(r.collection).toBe(transformed);
		expect(deref(r)?.foo).toBe(idx + 42);
	});

	// Release
	for (const r of refs) {
		releaseRef(r);
		expect(r.index).toBe(-1);
	}

	// Reference is no longer pending
	expect(transformed.references.size).toBe(0);
	validateCollection(transformed);
})
