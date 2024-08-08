import { useMemo } from 'react'
import { useScene } from '../reducers/sceneReducer.tsx'

export default function Inspector() {
	const scene = useScene();
	const branches = scene.branches;

	const phytomerCount = useMemo(
		() => branches.reduce((acc, branch) => acc + branch.points.length - 1, 0),
		[ branches ]
	);

	return (
		<>
			<p>
				Phytomer Count: <strong>{phytomerCount}</strong>
			</p>
		</>
	)
}
