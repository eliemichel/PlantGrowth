import { expect, test } from 'vitest'
import {
	Collection,
	releaseRef,
} from '../utils/Collection.tsx'

type Item = {
	foo: number,
	bar: string,
}

test('New collection has no item nor references', () => {

	const collec = new Collection<Item>();

	expect(collec.items.length).toBe(0);
	expect(collec.references.size).toBe(0);
})

test('Reference to an unexisting item is invalid', () => {
	const collec = new Collection<Item>();

	const ref1 = collec.createRef(0);
	expect(ref1.index).toBe(-1);

	collec.append({ foo: 42, bar: "lorem ipsum" })

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
})

test('Releasing references drops them', () => {
	const collec = new Collection<Item>();
	collec.append({ foo: 42, bar: "lorem ipsum" })

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
})

test('Removing element offset references', () => {
	const collec = new Collection<Item>();
	collec.append({ foo: 0, bar: "alpha" })
	collec.append({ foo: 1, bar: "beta" })
	collec.append({ foo: 2, bar: "gamma" })
	collec.append({ foo: 3, bar: "delta" })
	collec.append({ foo: 4, bar: "epsilon" })

	const refs = Array.from({ length: 5 }).map((_, idx) => collec.createRef(idx));
	
	// Refs are valid
	for (const r of refs) {
		expect(r.index).not.toBe(-1);
	}
	expect(collec.references.size).toBe(5);

	// Remove an element
	collec.removeAt(2);

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
})

test('Inserting element offset references', () => {
	const collec = new Collection<Item>();
	collec.append({ foo: 0, bar: "alpha" })
	collec.append({ foo: 1, bar: "beta" })
	collec.append({ foo: 2, bar: "gamma" })
	collec.append({ foo: 3, bar: "delta" })
	collec.append({ foo: 4, bar: "epsilon" })

	const refs = Array.from({ length: 5 }).map((_, idx) => collec.createRef(idx));
	
	// Refs are valid
	for (const r of refs) {
		expect(r.index).not.toBe(-1);
	}
	expect(collec.references.size).toBe(5);

	// Insert an element
	collec.insertBefore(2, { foo: 1.5, bar: "hey" });

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
})
