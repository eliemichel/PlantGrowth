import { useState } from 'react'
import { useScene, useSceneDispatch } from './reducers/sceneReducer.tsx'

export default function Parameters() {
  const scene = useScene();
  const dispatch = useSceneDispatch();

  const [ stepCount, setStepCount ] = useState(10);

  return (
    <>
      <h3>Parameters</h3>

      <div>
        <label htmlFor="instance-count">
          Instance Count: 
          <input
            id="instance-count"
            type="number"
            min={1}
            max={100}
            value={scene.instanceCount}
            onChange={e => dispatch({
              type: 'set-instance-count',
              instanceCount: e.target.value
            })}
          />
        </label>
      </div>

      <div>
        <label htmlFor="step-count">
          Step Count: 
          <input
            id="step-count"
            type="number"
            min={1}
            max={100}
            value={stepCount}
            onChange={e => setStepCount(e.target.value)}
          />
        </label>
      </div>

      <div>
        <button onClick={e => dispatch({
          type: 'step-simulation',
          stepCount,
        })} >
          Step Simulation
        </button>
      </div>

      <div>
        <button onClick={e => dispatch({
          type: 'test-leaf',
        })} >
          Test Leaf
        </button>
      </div>
    </>
  );
}
