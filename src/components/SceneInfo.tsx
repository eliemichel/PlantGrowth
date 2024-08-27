import { useMemo } from 'react'
import { useAppStore } from '../stores/appStore.tsx'
import { computeBiomassProduction } from '../backend/biomassProduction.tsx'

export default function SceneInfo() {
  const scene = useAppStore(store => store.scene);

  const phytomers = scene.phytomers;

  const leafCount = useMemo(
    () => phytomers.items.reduce((acc, ph) => acc + ph.leaves.length, 0),
    [ phytomers ]
  );

  const budCount = useMemo(
    () => phytomers.items.reduce((acc, ph) => acc + ph.buds.length, 0),
    [ phytomers ]
  );

  const biomassProduction = useMemo(
    () => computeBiomassProduction(scene, scene.plants.items[0]), // TODO: compute for other plants as well
    [ scene ]
  );

  return (
    <>
      <h3>Scene Info</h3>
      <p>
        Phytomer Count: <strong>{phytomers.items.length}</strong> | Leaf Count: <strong>{leafCount}</strong> | Bud Count: <strong>{budCount}</strong>
      </p>
      <h3>Biomass Production (Plant #0)</h3>
      <p>
        Stems: <strong>{biomassProduction.stems}</strong> | Leaves: <strong>{biomassProduction.leaves}</strong>
      </p>
    </>
  );
}
