export default function groupBy<T,U>(items: T[], getter: (element: T) => U): IterableIterator<[U, T[]]> {
	const bins = new Map<U, T[]>();
	for (const element of items) {
		const value = getter(element);
		const b = bins.get(value);
		if (b === undefined) {
			bins.set(value, [ element ]);
		} else {
			b.push(element);
		}
	}
	return bins.entries()
}
