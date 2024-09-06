import {
	LogLevel,
} from '../models/LogModel.ts'

import { useStore } from '../store'

import './Log.css'

export default function Log() {
	const logEntries = useStore(store => store.logEntries)

	return (
		<div className="log">
			{logEntries.map((entry, idx) => (
				<p key={idx} className={LogLevel[entry.level].toLowerCase()}>
					<span className="log-time">{entry.time.toLocaleTimeString()}</span> [{LogLevel[entry.level].toUpperCase()}] {entry.message}
				</p>
			))}
		</div>
	)	
}
