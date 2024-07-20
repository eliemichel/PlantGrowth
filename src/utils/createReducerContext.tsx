import { useReducer, useContext, createContext } from 'react';

/**
 * Automate the pattern presented here: https://react.dev/learn/managing-state#scaling-up-with-reducer-and-context
 */
export function createReducerContext(reducer, initialState) {
  const FooContext = createContext(null);
  const useFoo = () => useContext(FooContext);

  const FooDispatchContext = createContext(null);
  const useFooDispatch = () => useContext(FooDispatchContext);

  function FooProvider({ children }) {
    const [ state, dispatch ] = useReducer(
      reducer,
      initialState
    );

    return (
      <FooContext.Provider value={state}>
        <FooDispatchContext.Provider value={dispatch}>
          {children}
        </FooDispatchContext.Provider>
      </FooContext.Provider>
    );
  }

  return [
    useFoo,
    useFooDispatch,
    FooProvider,
  ];
}
