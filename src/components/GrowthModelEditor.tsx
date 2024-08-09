import { GrowthModel, validateDevelopment, validateBranchingArrangment } from '../models/SimulationModel.tsx'
import { NumberInput, EnumInput } from './inputs.tsx'
import './GrowthModelEditor.css'

type GrowthModelEditorProps = {
	model: GrowthModel,
	setModel: (model: GrowthModel) => void,
}

export default function GrowthModelEditor({
	model,
	setModel
}: GrowthModelEditorProps) {
	return (
		<div className="growth-model-editor">
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

			<NumberInput
				label="Growth Speed"
				value={model.growthSpeed}
				min={0.0}
				max={1.0}
				step={0.01}
				setValue={v => setModel({ ...model, growthSpeed: v })}
			/>

			<NumberInput
				label="Growth Direction Randomness"
				value={model.growthDirectionRandomness}
				min={0.0}
				max={2.0}
				step={0.01}
				setValue={v => setModel({ ...model, growthDirectionRandomness: v })}
			/>

			<NumberInput
				label="Growth Sun Attraction"
				value={model.growthSunAttraction}
				min={0.0}
				max={1.0}
				step={0.01}
				setValue={v => setModel({ ...model, growthSunAttraction: v })}
			/>

			<EnumInput
				label="Growth Development"
				value={model.development}
				options={[ "monopodial", "sympodial" ]}
				setValue={v => setModel({ ...model, development: validateDevelopment(v) })}
			/>

			<EnumInput
				label="Branching Arrangment"
				value={model.branchingArrangment}
				options={[ "epitonic", "amphitonic", "hypotonic" ]}
				setValue={v => setModel({ ...model, branchingArrangment: validateBranchingArrangment(v) })}
			/>

			<NumberInput
				label="Minimum Branch Count"
				value={model.minBranchCount}
				min={0}
				max={5}
				setValue={v => setModel({ ...model, minBranchCount: Math.min(v, model.maxBranchCount) })}
			/>

			<NumberInput
				label="Maxiumum Branch Count"
				value={model.maxBranchCount}
				min={0}
				max={5}
				setValue={v => setModel({ ...model, maxBranchCount: Math.max(v, model.minBranchCount) })}
			/>

			<NumberInput
				label="Minimum Branch Divergence"
				value={180 / Math.PI * model.minDivergence}
				min={0}
				max={180}
				setValue={v => setModel({ ...model, minDivergence: Math.min(Math.PI / 180 * v, model.maxDivergence) })}
			/>

			<NumberInput
				label="Maxiumum Branch Divergence"
				value={180 / Math.PI * model.maxDivergence}
				min={0}
				max={180}
				setValue={v => setModel({ ...model, maxDivergence: Math.max(Math.PI / 180 * v, model.minDivergence) })}
			/>

			<NumberInput
				label="Bud Delay"
				value={model.budDelay}
				min={0}
				max={20}
				setValue={v => setModel({ ...model, budDelay: v })}
			/>

			<NumberInput
				label="Merismatic Growth Length"
				value={model.merismaticGrowthLength}
				min={0.0}
				max={1.0}
				step={0.01}
				setValue={v => setModel({ ...model, merismaticGrowthLength: v })}
			/>

			<NumberInput
				label="Continuous Growth Rate"
				value={model.continuousGrowthRate}
				min={0.0}
				max={1.0}
				step={0.01}
				setValue={v => setModel({ ...model, continuousGrowthRate: v })}
			/>

			<NumberInput
				label="Leaf Growth Rate"
				value={model.leafGrowthRate}
				min={0.0}
				max={1.0}
				step={0.01}
				setValue={v => setModel({ ...model, leafGrowthRate: v })}
			/>
		</div>
	)
}
