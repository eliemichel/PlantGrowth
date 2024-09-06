import { useCallback } from 'react'
import { useStore } from '../store'
import { createGrowthModelPreset } from '../models/GrowthModel.ts'

import GrowthModelEditor from './GrowthModelEditor.tsx'
import EnvironmentEditor from './EnvironmentEditor.tsx'

export default function Parameters() {
  const growthModels = useStore(store => store.scene.growthModels);
  const environment = useStore(store => store.scene.environment);
  const setEnvironment = useStore(store => store.setEnvironment);
  const setGrowthModel = useStore(store => store.setGrowthModel);

  const applyPreset = useCallback((modelIndex: number, presetIndex: number) => {
    setGrowthModel(modelIndex, createGrowthModelPreset(presetIndex));
  }, [ setGrowthModel ])

  return (
    <>
      <div>
        <h3>Growth Models</h3>

        {growthModels.items.map((model, idx) => (

          <div key={idx}>
            <h4>
              Model #{idx}
              &nbsp;
              <select onChange={e => applyPreset(idx, parseInt(e.target.value))} value="">
                <option value="">Preset</option>
                <option value="0">#0 (Tradescantia)</option>
                <option value="1">#1 (Herbaceae)</option>
              </select>
            </h4>

            <GrowthModelEditor
              model={model}
              modelPath={`/model/${idx}`}
              setModel={newModel => setGrowthModel(idx, newModel)}
            />
          </div>

        ))}
      </div>

      <div>
        <h3>Environment</h3>
        <EnvironmentEditor
          model={environment}
          setModel={setEnvironment}
        />
      </div>
    </>
  );
}
