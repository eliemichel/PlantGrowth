import { useId, useState } from 'react'
import Viewport, { LineColor } from './Viewport.tsx'
import { getEnumKeys } from '../utils/typescript.tsx'

const lineColorKeys = getEnumKeys(LineColor);

function lineColorFromString(keyStr: string): LineColor {
	for (const key of lineColorKeys) {
		if (keyStr == key) return LineColor[key];
	}
	console.warn(`Unable to convert value '${keyStr}' to a LineColor.`);
	return LineColor.Uniform;
}

/**
 * Wraps the Viewport component with view setting knobs.
 */
export default function ViewportWithControls() {
	const id = useId();

	const [ lineColor, setLineColor ] = useState(LineColor.Active);

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
		  </div>
		  <Viewport lineColor={lineColor} />
		</div>
	)
}
