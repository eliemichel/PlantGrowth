import { useCallback } from 'react'
import { produce } from 'immer'
import { useAppStore } from '../stores/appStore.tsx'
import {
	type GrowthModel,
	type ScheduleStep,
	LeafType,
} from '../models/GrowthModel.tsx'
import { EnumInput, ExpressionInput, ColorInput } from './inputs.tsx'
import { parseExpressionPath } from '../models/Path.tsx'
import behaviors from '../backend/behaviors.tsx'
import { mapResult } from '../utils/error.tsx'
import { getEnumKeys, validateEnumValue } from '../utils/typescript.tsx'
import './GrowthModelEditor.css'
import {
	ParameterInput,
} from './ParameterInputs.tsx'

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

	const setNumberParameterValue = useCallback((paramIdx: number, value: number) => {
		setModel(produce(model, draft => { draft.parameters[paramIdx].value = value }))
	}, [ model ])

	const setStringParameterValue = useCallback((paramIdx: number, value: string) => {
		setModel(produce(model, draft => { draft.parameters[paramIdx].value = value }))
	}, [ model ])

	return (
		<div className="growth-model-editor">
			{model.parameters.length > 0 ? <>
				<h4>Custom Parameters</h4>
				<div className="parameter-list">
					{model.parameters.map((param, paramIdx) => (
						<ParameterInput
							key={paramIdx}
							parameter={param}
							setNumberParameterValue={value => setNumberParameterValue(paramIdx, value)}
							setStringParameterValue={value => setStringParameterValue(paramIdx, value)}
						/>
					))}
				</div>
			</> : null}

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
					label="Continuous Growth Rate"
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
					label="Leaf Growth Rate"
					exprPath={exprPath}
					expr={model.leafGrowthRate}
					min={0.0}
					max={1.0}
					step={0.01}
					setExpr={v => setExpression(exprPath, v)}
				/>
			), error => <p>Could not parse path: {error}</p>)}

			<EnumInput
				label="Leaf Type"
				value={LeafType[model.leafType]}
				options={getEnumKeys(LeafType)}
				setValue={v => setModel({ ...model, leafType: validateEnumValue(v, LeafType) })}
			/>

			<ColorInput
				label="Leaf Color"
				value={model.leafColor}
				min={0.0}
				max={1.0}
				step={0.01}
				setValue={v => setModel({ ...model, leafColor: v })}
			/>

			<ColorInput
				label="Stem Color"
				value={model.stemColor}
				min={0.0}
				max={1.0}
				step={0.01}
				setValue={v => setModel({ ...model, stemColor: v })}
			/>
		</div>
	)
}
