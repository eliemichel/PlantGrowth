import { useReducer, useContext, createContext, ReactNode, Dispatch } from 'react';

type FooProps = {
  children: ReactNode
}

/**
 * Automate the pattern presented here: https://react.dev/learn/managing-state#scaling-up-with-reducer-and-context
 */
export function createReducerContext<State,Action>(
  reducer: (state: State, action: Action) => State,
  initialState: State
): [
  () => State,
  () => Dispatch<Action>,
  ({ children }: FooProps) => React.JSX.Element,
] {
  const FooContext = createContext(initialState);
  const useFoo = () => useContext(FooContext);

  const FooDispatchContext = createContext<Dispatch<Action>>(() => {});
  const useFooDispatch = () => useContext(FooDispatchContext);

  function FooProvider({ children }: FooProps) {
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
