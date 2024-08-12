import { useMemo } from 'react'
import { useScene } from '../reducers/sceneReducer.tsx'
import { Vector } from '../utils/vector.tsx'
import './Inspector.css'
import { getAllPhytomerPositions } from '../reducers/growth.tsx'

export default function Inspector() {
	const scene = useScene();
	const branches = scene.branches;

	const allPoints = useMemo(() => {
		const allPoints: { branchIdx: number, position: Vector }[] = [];
		branches.map((b, branchIdx) => {
			for (const position of getAllPhytomerPositions(b)) {
				allPoints.push({ branchIdx, position });
			}
		});
		return allPoints;
	}, [ branches ]);

	return (
		<>
			<h3>Branches</h3>
			<table className="spreadsheet">
				<thead>
					<tr>
						<th>id</th>
						<th>phytomers</th>
						<th>leaves</th>
						<th>buds</th>
					</tr>
				</thead>
				<tbody>
					{branches.map((b, idx) => (
						<tr key={idx}>
							<td>#{idx}</td>
							<td>{b.phytomers.length}</td>
							<td>{b.leaves.length}</td>
							<td>{b.buds.length}</td>
						</tr>
					))}
				</tbody>
			</table>

			<h3>Phytomers</h3>
			<table className="spreadsheet">
				<thead>
					<tr>
						<th>id</th>
						<th>branch</th>
						<th>position</th>
					</tr>
				</thead>
				<tbody>
					{allPoints.map((pt, idx) => (
						<tr key={idx}>
							<td>#{idx}</td>
							<td>#{pt.branchIdx}</td>
							<td>{pt.position[0]}, {pt.position[1]}, {pt.position[2]}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	)
}
