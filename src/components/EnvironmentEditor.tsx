import { Environment } from '../models/EnvironmentModel.ts'
import { NumberInput } from './inputs.tsx'
import './EnvironmentEditor.css'

type EnvironmentEditorProps = {
	model: Environment,
	setModel: (model: Environment) => void,
}

export default function EnvironmentEditor({
	model,
	setModel
}: EnvironmentEditorProps) {
	return (
		<div className="environment-editor">
			<NumberInput
				label="Temperature (°C)"
				value={model.temperature}
				min={-100}
				max={100}
				step={1}
				setValue={v => setModel({ ...model, temperature: v })}
			/>
		</div>
	)
}
