import { useState } from 'react'
import { useSceneDispatch } from '../reducers/sceneReducer.tsx'

export default function Actions() {
  const dispatch = useSceneDispatch();

  const [ stepCount, setStepCount ] = useState(10);

  return (
    <>
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
        <button onClick={() => dispatch({ type: 'set-initial-scene' })} >
          Set Initial Scene
        </button>

        <button onClick={() => dispatch({
          type: 'set-test-scene',
          index: 0,
        })} >
          Set Test Scene #0
        </button>
      </div>

      <div style={{marginTop: "1em"}}>
        <button onClick={() => dispatch({
          type: 'step-growth',
          stepCount,
        })} >
          Step Growth
        </button>
        <button onClick={() => dispatch({
          type: 'step-organogenesis',
          stepCount,
        })} >
          Step Organogenesis
        </button>
        <button onClick={() => dispatch({
          type: 'step-test',
          stepCount,
        })} >
          Step Test
        </button>
      </div>

      <div style={{marginTop: "1em"}}>
        <button onClick={() => dispatch({
          type: 'step-simulation',
          stepCount,
        })} >
          Step Legacy Simulation
        </button>
        <button onClick={() => {
          for (let i = 0 ; i < stepCount ; ++i) {
            dispatch({
              type: 'step-organogenesis',
              stepCount: 1,
            });
            dispatch({
              type: 'step-growth',
              stepCount: 1,
            });
          }
        }} >
          Step Organogenesis & Growth
        </button>
      </div>
    </>
  );
}
