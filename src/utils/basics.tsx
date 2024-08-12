
export function concatAll<A>(arrays: A[][]): A[] {
	const e: A[] = [];
	return e.concat(...arrays);
}

export function makeArray<T>(length: number, factory: (idx: number) => T): T[] {
	return Array.from({ length }).map((_, idx) => factory(idx))
}
