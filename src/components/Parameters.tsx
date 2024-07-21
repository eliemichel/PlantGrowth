import { useState } from 'react'
import { useScene, useSceneDispatch } from '../reducers/sceneReducer.tsx'
import GrowthModelEditor from './GrowthModelEditor.tsx'
import SceneInfo from './SceneInfo.tsx'

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
        <button onClick={() => dispatch({
          type: 'test-branch',
        })} >
          Test Branch
        </button>
      </div>

      <SceneInfo />

      <div>
        <h3>Growth Models</h3>

        {scene.growthModels.map((model, idx) => (
          <div key={idx}>
            <h4>Model #{idx}</h4>
            <GrowthModelEditor
              model={model}
              setModel={newModel => dispatch({
                type: 'set-growth-model',
                index: idx,
                model: newModel,
              })}
            />
          </div>
        ))}
      </div>
    </>
  );
}
