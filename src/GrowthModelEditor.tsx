import { useId } from 'react'
import { GrowthModel } from './models/SimulationModel.tsx'
import './GrowthModelEditor.css'

type NumberInputProps = {
	label: string,
	value: number,
	setValue: (value: number) => void,
	min?: number,
	max?: number,
	step?: number,
}

function NumberInput({
	label,
	value,
	setValue,
	min = 1,
	max = 100,
	step = 1,
}: NumberInputProps) {
	const id = useId();

	return (
		<div>
			<label htmlFor={id}>
				{label}:&nbsp;
				<input
					id={id}
					type="number"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={e => setValue(parseFloat(e.target.value))}
				/>
			</label>
		</div>
	)
}

type GrowthModelEditorProps = {
	model: GrowthModel,
	setModel: (model: GrowthModel) => void,
}

export default function GrowthModelEditor({
	model,
	setModel
}: GrowthModelEditorProps) {
	return (
		<div class="growth-model-editor">
			<NumberInput
				label="Max Internode Length"
				value={model.maxInternodeLength}
				min={0.01}
				max={1.00}
				step={0.01}
				setValue={v => setModel({ ...model, maxInternodeLength: v })}
			/>

			<NumberInput
				label="Max Nodes per Axis"
				value={model.maxNodesPerAxis}
				min={1}
				max={20}
				setValue={v => setModel({ ...model, maxNodesPerAxis: v })}
			/>
		</div>
	)
}
