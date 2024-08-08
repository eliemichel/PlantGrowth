import { useScene } from '../reducers/sceneReducer.tsx'
import './Inspector.css'

export default function Inspector() {
	const scene = useScene();
	const branches = scene.branches;

	return (
		<>
			<h3>
			Branches
			</h3>
			<table className="spreadsheet">
				<thead>
					<tr>
						<th>id</th>
						<th>points</th>
						<th>leaves</th>
						<th>buds</th>
					</tr>
				</thead>
				<tbody>
					{branches.map((b, idx) => (
						<tr key={idx}>
							<td>#{idx}</td>
							<td>{b.points.length}</td>
							<td>{b.leaves.length}</td>
							<td>{b.buds.length}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	)
}
