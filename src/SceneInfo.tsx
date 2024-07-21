import { useMemo } from 'react'
import { useScene } from './reducers/sceneReducer.tsx'

export default function SceneInfo() {
  const scene = useScene();

  const branches = useScene().branches;

  const phytomerCount = useMemo(
    () => branches.reduce((acc, branch) => acc + branch.points.length, 0),
    [ branches ]
  );

  const leafCount = useMemo(
    () => branches.reduce((acc, branch) => acc + branch.leaves.length, 0),
    [ branches ]
  );

  return (
    <>
      <h3>Scene Info</h3>
      <p>
        Phytomer Count: <strong>{phytomerCount}</strong> | Leaf Count: <strong>{leafCount}</strong>
      </p>
    </>
  );
}
