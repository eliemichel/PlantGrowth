import { useMemo, useRef } from 'react'

/**
 * A hook that will always return the value it was provided the very first time
 * it was invoked.
 */
export default function useFreezer<T>(value: T) {
  const ref = useRef(value);
  return useMemo(
    () => ref.current,
    [ ref ]
  )
}
