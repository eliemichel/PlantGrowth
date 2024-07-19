import { useState, useReducer, useContext, createContext } from 'react';

import SplitterLayout from './third_party/react-splitter-layout';
import './third_party/react-splitter-layout/stylesheets/index.css';

import Viewport from './Viewport.tsx'
import NodeGraph from './NodeGraph.tsx'
import Parameters from './Parameters.tsx'

import { NodeGraphProvider } from './reducers/nodeGraphReducer.tsx'
import { SceneProvider } from './reducers/sceneReducer.tsx'

import './App.css'

/**
 * A global state provider that regroups all state providers
 */
function StateProvider({ children }) {
  return (
    <SceneProvider>
      <NodeGraphProvider>
        { children }
      </NodeGraphProvider>
    </SceneProvider>
  );
}

export default function App() {
  console.log("Rebuild app");
  return (
    <StateProvider>
      <SplitterLayout percentage={true}>
        <Viewport />
        <SplitterLayout vertical={true} percentage={true} secondaryInitialSize={75}>
          <Parameters />
          <NodeGraph />
        </SplitterLayout>
      </SplitterLayout>
    </StateProvider>
  )
}
