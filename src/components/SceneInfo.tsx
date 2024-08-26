import { useMemo } from 'react'
import { useAppStore } from '../stores/appStore.tsx'
import { computeBiomassProduction } from '../backend/biomassProduction.tsx'

export default function SceneInfo() {
  const scene = useAppStore(store => store.scene);

  const branches = scene.branches;

  const phytomerCount = useMemo(
    () => branches.reduce((acc, branch) => acc + branch.phytomers.length - 1, 0),
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
    () => computeBiomassProduction(scene, scene.plants.items[0]), // TODO: compute for other plants as well
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
