import { produce } from 'immer'
import { useAppStore } from '../stores/appStore.tsx'
import {
	validateDevelopment,
	validateBranchingArrangment,
	type GrowthModel,
	type ScheduleStep,
} from '../models/GrowthModel.tsx'
import { NumberInput, EnumInput, ExpressionInput } from './inputs.tsx'
import { parseExpressionPath } from '../models/Path.tsx'
import behaviors from '../backend/behaviors.tsx'
import { mapResult } from '../utils/error.tsx'
import './GrowthModelEditor.css'

type GrowthModelEditorProps = {
	model: GrowthModel,
	modelPath: string, // unique identifier of the model being edited
	setModel: (model: GrowthModel) => void,
}

export default function GrowthModelEditor({
	model,
	modelPath,
	setModel
}: GrowthModelEditorProps) {
	const setExpression = useAppStore(state => state.setExpression);
	const setScheduleStep = (stepIndex: number, newStep: ScheduleStep) => {
		setModel(produce(model, draft => { draft.schedule[stepIndex] = newStep }))
	};
	const removeScheduleStep = (stepIndex: number) => {
		setModel(produce(model, draft => { draft.schedule = draft.schedule.filter((_, idx) => idx !== stepIndex) }))
	};
	const addScheduleStep = () => setModel({
		...model,
		schedule: [ ...model.schedule, { behavior: Object.keys(behaviors)[0], repeat: 1, enabled: true, id: crypto.randomUUID() } ]
	})

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

			<hr/>

			<h4>Schedule</h4>
			<ul className="schedule">
				{model.schedule.map((step, idx) => (
					<li key={step.id}>
						<input
							type="checkbox"
							checked={step.enabled}
							onChange={e => setScheduleStep(idx, { ...step, enabled: e.target.checked })}
						/>
						<select
							value={step.behavior}
							onChange={e => setScheduleStep(idx, { ...step, behavior: e.target.value })}
						>
							{Object.entries(behaviors).map(([key, b]) => (
								<option key={key} value={key}>{b.name}</option>
							))}
						</select> |
						repeat:{' '}
						<input
							type="number"
							value={step.repeat}
							onChange={e => setScheduleStep(idx, { ...step, repeat: parseInt(e.target.value) })}
						/>
						<button onClick={() => removeScheduleStep(idx)}>x</button>
					</li>
				))}
				<li>
					<button onClick={addScheduleStep}>
						Add Step
					</button>
				</li>
			</ul>

			<hr/>

			<div>
				Meristem State Transition: TODO
			</div>

			{mapResult(parseExpressionPath(modelPath + "/merismaticGrowthLength"), exprPath => (
				<ExpressionInput
					label="Merismatic Growth Length"
					exprPath={exprPath}
					expr={model.merismaticGrowthLength}
					min={0.0}
					max={1.0}
					step={0.01}
					setExpr={v => setExpression(exprPath, v)}
				/>
			), error => <p>Could not parse path: {error}</p>)}

			{mapResult(parseExpressionPath(modelPath + "/continuousGrowthRate"), exprPath => (
				<ExpressionInput
					label="Continuous Growth Length"
					exprPath={exprPath}
					expr={model.continuousGrowthRate}
					min={0.0}
					max={1.0}
					step={0.01}
					setExpr={v => setExpression(exprPath, v)}
				/>
			), error => <p>Could not parse path: {error}</p>)}

			{mapResult(parseExpressionPath(modelPath + "/leafGrowthRate"), exprPath => (
				<ExpressionInput
					label="Leaf Growth Length"
					exprPath={exprPath}
					expr={model.leafGrowthRate}
					min={0.0}
					max={1.0}
					step={0.01}
					setExpr={v => setExpression(exprPath, v)}
				/>
			), error => <p>Could not parse path: {error}</p>)}
		</div>
	)
}
