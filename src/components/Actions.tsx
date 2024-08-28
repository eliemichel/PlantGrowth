import { useState } from 'react'
import { useAppStore } from '../stores/appStore.tsx'
import {
  createInitialScene,
  createTestScene,
} from '../models/SceneModel.tsx'
import behaviors from '../backend/behaviors.tsx'

export default function Actions() {
  const applyBehavior = useAppStore(store => store.applyBehavior)
  const applyGrowthSchedule = useAppStore(store => store.applyGrowthSchedule)
  const setScene = useAppStore(store => store.setScene)
  const setTestScene = (index: number) => setScene(createTestScene(index))
  const setInitialScene = () => setScene(createInitialScene())

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
          Set Scene #0
        </button>

        <button onClick={() => setTestScene(1)} >
          Set Scene #1
        </button>

        <button onClick={() => setTestScene(2)} >
          Set Scene #2
        </button>

        <button onClick={() => setTestScene(3)} >
          Set Scene #3
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
        <button onClick={() => applyGrowthSchedule(stepCount)} >
          Step
        </button>
      </div>
    </>
  );
}
