import { useState } from 'react'
import { useAppStore } from '../stores/appStore.tsx'
import behaviors from '../reducers/behaviors.tsx'

export default function Actions() {
  const applyBehavior = useAppStore(store => store.applyBehavior)
  const setTestScene = useAppStore(store => store.setTestScene)
  const setInitialScene = useAppStore(store => store.setInitialScene)

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
        <button onClick={() => setInitialScene()} >
          Set Initial Scene
        </button>

        <button onClick={() => setTestScene(0)} >
          Set Test Scene #0
        </button>
      </div>

      <div style={{marginTop: "1em"}}>
        <button onClick={() => applyBehavior(behaviors.growth, stepCount)} >
          Step Growth
        </button>
        <button onClick={() => applyBehavior(behaviors.organogenesis, stepCount)} >
          Step Organogenesis
        </button>
        <button onClick={() => applyBehavior(behaviors.gravity, stepCount)} >
          Step Gravity
        </button>
      </div>

      <div style={{marginTop: "1em"}}>
        <button onClick={() => applyBehavior(behaviors.legacy, stepCount)} >
          Step Legacy Simulation
        </button>
        <button onClick={() => {
          for (let i = 0 ; i < stepCount ; ++i) {
            applyBehavior(behaviors.organogenesis, 1);
            applyBehavior(behaviors.growth, 1);
          }
        }} >
          Step Organogenesis & Growth
        </button>
      </div>
    </>
  );
}
