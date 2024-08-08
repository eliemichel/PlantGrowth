import { useScene, useSceneDispatch } from '../reducers/sceneReducer.tsx'
import GrowthModelEditor from './GrowthModelEditor.tsx'
import EnvironmentEditor from './EnvironmentEditor.tsx'

export default function Parameters() {
  const scene = useScene();
  const dispatch = useSceneDispatch();

  return (
    <>
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

      <div>
        <h3>Environment</h3>
        <EnvironmentEditor
          model={scene.environment}
          setModel={newEnvironment => dispatch({
            type: 'set-environment',
            environment: newEnvironment,
          })}
        />
      </div>
    </>
  );
}
