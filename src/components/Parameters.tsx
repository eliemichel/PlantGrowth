import { useAppStore } from '../stores/appStore.tsx'
import GrowthModelEditor from './GrowthModelEditor.tsx'
import EnvironmentEditor from './EnvironmentEditor.tsx'

export default function Parameters() {
  const growthModels = useAppStore(store => store.scene.growthModels);
  const environment = useAppStore(store => store.scene.environment);
  const setEnvironment = useAppStore(store => store.setEnvironment);
  const setGrowthModel = useAppStore(store => store.setGrowthModel);

  return (
    <>
      <div>
        <h3>Growth Models</h3>

        {growthModels.map((model, idx) => (
          <div key={idx}>
            <h4>Model #{idx}</h4>
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
