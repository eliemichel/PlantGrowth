import { useMemo } from 'react'
import { useStore } from '../store'

import {
  type Meristem,
} from '../models/SceneModel.ts'

import {
  getPhytomerPosition,
} from '../backend/growth.ts'

import './Inspector.css'

export default function Inspector() {
	const plants = useStore(state => state.scene.plants);
	const phytomers = useStore(state => state.scene.phytomers);

	const meristems: Meristem[] = useMemo(
		() => phytomers.items.filter(ph => ph.meristem !== null).map(ph => ph.meristem as Meristem),
		[ phytomers ]
	);

	return (
		<>
			<h3>Meristems</h3>
			<table className="spreadsheet">
				<thead>
					<tr>
						<th>id</th>
						<th>state</th>
						<th>data</th>
					</tr>
				</thead>
				<tbody>
					{meristems.map((ms, idx) => (
						<tr key={idx}>
							<td>#{idx}</td>
							<td>{ms.state.type}</td>
							<td>{JSON.stringify(ms.state.data)}</td>
						</tr>
					))}
				</tbody>
			</table>

			<h3>Phytomers</h3>
			<table className="spreadsheet">
				<thead>
					<tr>
						<th>id</th>
						<th>plant</th>
						<th>meristem?</th>
						<th>state</th>
						<th>data</th>
						<th>position</th>
						<th>leaves</th>
						<th>buds</th>
						<th>type</th>
						<th>thickness</th>
					</tr>
				</thead>
				<tbody>
					{phytomers.mapToArray((ph, idx) => {
						const position = getPhytomerPosition(ph);
						return (
							<tr key={idx}>
								<td>#{idx}</td>
								<td>{ph.plantRef.index}</td>
								<td>{ph.meristem !== null ? "true" : "false"}</td>
								<td>{ph.differentiation.type}</td>
								<td>{JSON.stringify(ph.differentiation.data)}</td>
								<td>{position[0]}, {position[1]}, {position[2]}</td>
								<td>{ph.leaves.length}</td>
								<td>{ph.buds.length}</td>
								<td>{ph.type}</td>
								<td>{ph.thickness}</td>
							</tr>
						)
					})}
				</tbody>
			</table>

			<h3>Plants</h3>
			<table className="spreadsheet">
				<thead>
					<tr>
						<th>id</th>
						<th>position</th>
						<th>shoot</th>
					</tr>
				</thead>
				<tbody>
					{plants.mapToArray((p, idx) => {
						const position = getPhytomerPosition(p);
						return (
							<tr key={idx}>
								<td>#{idx}</td>
								<td>{position[0]}, {position[1]}, {position[2]}</td>
								<td>{p.shoot.index}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</>
	)
}
