import { useState, useReducer } from 'react';

import SplitterLayout from './third_party/react-splitter-layout';
import './third_party/react-splitter-layout/stylesheets/index.css';

import Viewport from './Viewport.tsx'
import NodeGraph from './NodeGraph.tsx'

import { nodeGraphReducer, createInitialNodeGraph } from './reducers/nodeGraphReducer.tsx'
import { sceneReducer, createInitialScene } from './reducers/sceneReducer.tsx'

import './App.css'

function Parameters({
  sceneState,
  dispatchSceneAction
}) {
  const [ value, setValue ] = useState(10);
  return (
    <>
      <h3>Parameters</h3>
      <label htmlFor="instance-count">
        Instance Count:
        <input
          id="instance-count"
          type="number"
          min={1}
          max={100}
          value={sceneState.instanceCount}
          onChange={e => dispatchSceneAction({
            type: 'set-instance-count',
            instanceCount: e.target.value
          })}
        />
      </label>
    </>
  );
}

function App() {
  const [ graphState, dispatchGraphAction ] = useReducer(
    nodeGraphReducer,
    createInitialNodeGraph()
  );

  const [ sceneState, dispatchSceneAction ] = useReducer(
    sceneReducer,
    createInitialScene()
  );

  return (
    <SplitterLayout percentage={true}>
      <Viewport />
      <SplitterLayout vertical={true} percentage={true} secondaryInitialSize={75}>
        <Parameters sceneState={sceneState} dispatchSceneAction={dispatchSceneAction} />
        <NodeGraph graphState={graphState} dispatchGraphAction={dispatchGraphAction} />
      </SplitterLayout>
    </SplitterLayout>
  )
}

export default App
