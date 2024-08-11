import { useId } from 'react'
import Viewport from './Viewport.tsx'
import { getEnumKeys } from '../utils/typescript.tsx'
import { ViewportState, LineColor } from '../models/ViewportState.tsx'

import "./ViewportWithControls.css"

const lineColorKeys = getEnumKeys(LineColor);

function lineColorFromString(keyStr: string): LineColor {
	for (const key of lineColorKeys) {
		if (keyStr == key) return LineColor[key];
	}
	console.warn(`Unable to convert value '${keyStr}' to a LineColor.`);
	return LineColor.Uniform;
}

type ViewportWithControlsProps = {
	viewportState: ViewportState,
	setViewportState: (newState: ViewportState) => void,
}

/**
 * Wraps the Viewport component with view setting knobs.
 */
export default function ViewportWithControls({
	viewportState,
	setViewportState
}: ViewportWithControlsProps) {
	const id = useId();
	const toggleId = useId();

	const {
		showLeaves,
		showBuds,
		showBranches,
		showNodes,
		lineColor,
	} = viewportState;

	const setLineColor = (lineColor: LineColor) => setViewportState({ ...viewportState, lineColor });

	return (
		<div className='vertical-stack'>
		  <div style={{backgroundColor: '#181818', padding: '0.3em 0'}}>

			<label htmlFor={id}>
				Line color:&nbsp;
				<select id={id} value={LineColor[lineColor]} onChange={ev => setLineColor(lineColorFromString(ev.target.value))}>
					{lineColorKeys.map(key => (
						<option key={key} value={key}>{key}</option>
					))}
				</select>
			</label>

			<div className="dropdown">
				<input type="checkbox" id={toggleId} className="toggle-checkbox" />
				<label htmlFor={toggleId} className="dropdown-label">
					Display
				</label>
				<label htmlFor={toggleId} className="dropdown-fullscreen-label"></label>
				<div className="content">
					<ul>
						<li><label>
							<input
								type="checkbox"
								checked={showLeaves}
								onChange={e => setViewportState({ ...viewportState, showLeaves: e.target.checked })}
							/> Leaves
						</label></li>
						<li><label>
							<input
								type="checkbox"
								checked={showBuds}
								onChange={e => setViewportState({ ...viewportState, showBuds: e.target.checked })}
							/> Buds
						</label></li>
						<li><label>
							<input
								type="checkbox"
								checked={showBranches}
								onChange={e => setViewportState({ ...viewportState, showBranches: e.target.checked })}
							/> Branches
						</label></li>
						<li><label>
							<input
								type="checkbox"
								checked={showNodes}
								onChange={e => setViewportState({ ...viewportState, showNodes: e.target.checked })}
							/> Nodes
						</label></li>
					</ul>
				</div>
			</div>

		  </div>
		  <Viewport lineColor={lineColor} viewportState={viewportState} />
		</div>
	)
}
