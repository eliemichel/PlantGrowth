import { useMemo } from 'react'
import { useScene } from '../reducers/sceneReducer.tsx'
import { computeBiomassProduction } from '../reducers/biomassProduction.tsx'

export default function SceneInfo() {
  const scene = useScene();

  const branches = scene.branches;

  const phytomerCount = useMemo(
    () => branches.reduce((acc, branch) => acc + branch.points.length - 1, 0),
    [ branches ]
  );

  const leafCount = useMemo(
    () => branches.reduce((acc, branch) => acc + branch.leaves.length, 0),
    [ branches ]
  );

  const budCount = useMemo(
    () => branches.reduce((acc, branch) => acc + branch.buds.length, 0),
    [ branches ]
  );

  const biomassProduction = useMemo(
    () => computeBiomassProduction(scene, scene.plants[0]),
    [ scene ]
  );

  return (
    <>
      <h3>Scene Info</h3>
      <p>
        Phytomer Count: <strong>{phytomerCount}</strong> | Leaf Count: <strong>{leafCount}</strong> | Bud Count: <strong>{budCount}</strong>
      </p>
      <h3>Biomass Production (Plant #0)</h3>
      <p>
        Stems: <strong>{biomassProduction.stems}</strong> | Leaves: <strong>{biomassProduction.leaves}</strong>
      </p>
    </>
  );
}
