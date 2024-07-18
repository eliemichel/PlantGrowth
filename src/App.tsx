import { useState, useReducer } from 'react';

import SplitterLayout from './third_party/react-splitter-layout';
import './third_party/react-splitter-layout/stylesheets/index.css';

import Viewport from './Viewport.tsx'
import NodeGraph from './NodeGraph.tsx'

import { nodeGraphReducer, createInitialGraphState } from './reducers/nodeGraphReducer.tsx'

import './App.css'

function App() {
  const [ graphState, dispatchGraphAction ] = useReducer(
    nodeGraphReducer,
    createInitialGraphState()
  );

  return (
    <SplitterLayout>
      <Viewport />
      <NodeGraph graphState={graphState} dispatchGraphAction={dispatchGraphAction} />
    </SplitterLayout>
  )
}

export default App
