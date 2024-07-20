import { useEffect, useRef, useMemo } from 'react'

// from https://stackoverflow.com/questions/59467758/passing-array-to-useeffect-dependency-list

type MaybeCleanUpFn = void | (() => void);
type EqualityFn = (a: DependencyList, b: DependencyList) => boolean;

/**
 * Returns true if array elements are identical (using ===), even if the arrays
 * themselves are different.
 */
export function arrayContentEqual(a1: any[], a2: any[]) {
  if (a1.length !== a2.length) return false;
  for (let i = 0; i < a1.length; i++) {
    if (a1[i] !== a2[i]) {
      return false;
    }
  }
  return true;
}

/**
 * A hook that uses a custom equality test for its dependency list
 */
export function useCustomEffect(
	cb: () => MaybeCleanUpFn,
	deps: DependencyList,
	equal?: EqualityFn
) {
	const ref = useRef<DependencyList>(deps);

	if (!equal || !equal(deps, ref.current)) {
		ref.current = deps;
	}

	useEffect(cb, [ref.current]);
}

/**
 * A hook that takes a callback which returns an array and returns a copy of
 * this array that gets updated only if one of the array elements changes.
 */
export function useArrayMemo(
	cb: () => List<A>,
	dependencies: DependencyList,
) {
	const array = useMemo(cb, dependencies);

	// Trigger updates only when a change occurs within the array (using a ref
	// to keep track of the previous array).
	const ref = useRef<List<A>>([]);
	if (!arrayContentEqual(array, ref.current)) {
		ref.current = array;
	}

	return ref.current;
}
