import { useState } from 'react'
import { useScene, useSceneDispatch } from './reducers/sceneReducer.tsx'
import GrowthModelEditor from './GrowthModelEditor.tsx'

export default function Parameters() {
  const scene = useScene();
  const dispatch = useSceneDispatch();

  const [ stepCount, setStepCount ] = useState(10);

  return (
    <>
      <h3>Parameters</h3>

      <div style={{marginTop: "1em"}}>
        <label htmlFor="step-count">
          Step Count:&nbsp;
          <input
            id="step-count"
            type="number"
            min={1}
            max={100}
            value={stepCount}
            onChange={e => setStepCount(parseInt(e.target.value))}
          />
        </label>
      </div>

      <div style={{marginTop: "1em"}}>
        <button onClick={() => dispatch({
          type: 'step-simulation',
          stepCount,
        })} >
          Step Simulation
        </button>
      </div>

      <div style={{marginTop: "1em"}}>
        <button onClick={() => dispatch({
          type: 'test-leaf',
        })} >
          Test Leaf
        </button>
      </div>

      <div style={{marginTop: "1em"}}>
        <button onClick={() => dispatch({
          type: 'test-branch',
        })} >
          Test Branch
        </button>
      </div>

      <div>
        <h3>Growth Models</h3>

        <h4>Model #0</h4>
        <GrowthModelEditor
          model={scene.growthModels[0]}
          setModel={growthModel => dispatch({
            type: 'set-growth-model',
            index: 0,
            model: growthModel,
          })}
        />

        <h4>Model #1</h4>
        <GrowthModelEditor
          model={scene.growthModels[1]}
          setModel={growthModel => dispatch({
            type: 'set-growth-model',
            index: 1,
            model: growthModel,
          })}
        />
      </div>
    </>
  );
}
