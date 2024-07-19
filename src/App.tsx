import { useState, useReducer, useContext, createContext } from 'react';

import SplitterLayout from './third_party/react-splitter-layout';
import './third_party/react-splitter-layout/stylesheets/index.css';

import Viewport from './Viewport.tsx'
import NodeGraph from './NodeGraph.tsx'
import Parameters from './Parameters.tsx'

import { NodeGraphProvider } from './reducers/nodeGraphReducer.tsx'
import { SceneProvider } from './reducers/sceneReducer.tsx'

import './App.css'

function App() {
  return (
    <SceneProvider>
      <NodeGraphProvider>
        <SplitterLayout percentage={true}>
          <Viewport />
          <SplitterLayout vertical={true} percentage={true} secondaryInitialSize={75}>
            <Parameters />
            <NodeGraph />
          </SplitterLayout>
        </SplitterLayout>
      </NodeGraphProvider>
    </SceneProvider>
  )
}

export default App
