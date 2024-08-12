import { useId } from 'react'
import Viewport from './Viewport.tsx'
import { getEnumKeys } from '../utils/typescript.tsx'
import { ViewportState, LineColor, FrameMode } from '../models/ViewportState.tsx'
import Dropdown, { DropdownItem } from './Dropdown.tsx'

import { KeysOfType } from '../utils/typescript.tsx'

import "./ViewportWithControls.css"

const lineColorKeys = getEnumKeys(LineColor);

function lineColorFromString(keyStr: string): LineColor {
	for (const key of lineColorKeys) {
		if (keyStr == key) return LineColor[key];
	}
	console.warn(`Unable to convert value '${keyStr}' to a LineColor.`);
	return LineColor.Uniform;
}

const frameModeKeys = getEnumKeys(FrameMode);

function frameModeFromString(keyStr: string): FrameMode {
	for (const key of frameModeKeys) {
		if (keyStr == key) return FrameMode[key];
	}
	console.warn(`Unable to convert value '${keyStr}' to a FrameMode.`);
	return FrameMode.World;
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
	const lineColorId = useId();
	const frameModeId = useId();

	const { frameMode, lineColor } = viewportState;
	const setLineColor = (lineColor: LineColor) => setViewportState({ ...viewportState, lineColor });
	const setFrameMode = (frameMode: FrameMode) => setViewportState({ ...viewportState, frameMode });

	const displayEntries: { key: KeysOfType<ViewportState,boolean>, label: string }[] = [
		{ key: "showLeaves", label: "Leaves" },
		{ key: "showBuds", label: "Buds" },
		{ key: "showBranches", label: "Branches" },
		{ key: "showNodes", label: "Nodes" },
		{ key: "showMeristems", label: "Meristems" },
		{ key: "showFrames", label: "Frames" },
	]

	return (
		<div className='vertical-stack'>
		  <div style={{backgroundColor: '#181818', padding: '0.3em 0'}}>

			<label htmlFor={lineColorId}>
				Line color:&nbsp;
				<select id={lineColorId} value={LineColor[lineColor]} onChange={ev => setLineColor(lineColorFromString(ev.target.value))}>
					{lineColorKeys.map(key => (
						<option key={key} value={key}>{key}</option>
					))}
				</select>
			</label>

			<label htmlFor={frameModeId}>
				Frame mode:&nbsp;
				<select id={frameModeId} value={FrameMode[frameMode]} onChange={ev => setFrameMode(frameModeFromString(ev.target.value))}>
					{frameModeKeys.map(key => (
						<option key={key} value={key}>{key}</option>
					))}
				</select>
			</label>

			<Dropdown label="Display">
				{displayEntries.map(entry => (
					<DropdownItem key={entry.key}>
						<label>
							<input
								type="checkbox"
								checked={viewportState[entry.key]}
								onChange={e => setViewportState({ ...viewportState, [entry.key]: e.target.checked })}
							/> {entry.label}
						</label>
					</DropdownItem>
				))}
			</Dropdown>

		  </div>
		  <Viewport viewportState={viewportState} />
		</div>
	)
}
