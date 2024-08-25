import {
	LogLevel,
	useAppStore,
} from '../stores/appStore.tsx'

import './Log.css'

export default function Log() {
	const logEntries = useAppStore(store => store.logEntries)

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
