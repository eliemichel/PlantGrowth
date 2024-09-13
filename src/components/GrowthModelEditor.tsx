import { useCallback } from 'react'
import { produce } from 'immer'

import { mapResult } from '../utils/error.ts'
import { getEnumKeys, validateEnumValue } from '../utils/typescript.ts'
import { useStore } from '../store'
import { parseExpressionPath } from '../models/Path.ts'
import behaviors from '../backend/behaviors.ts'

import {
	type GrowthModel,
	type ScheduleStep,
	LeafType,
} from '../models/GrowthModel.ts'

import {
	EnumInput,
	ExpressionInput,
	ColorInput,
} from './inputs.tsx'

import {
	ParameterInput,
} from './ParameterInputs.tsx'

import './GrowthModelEditor.css'

// TODO: Have setModel take a model => newModel function as argument, so that
// callbacks do not depend on model (they are thus not rebuilt at each update
// of the model).
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
	const setExpression = useStore(state => state.setExpression);

	const setScheduleStep = useCallback((stepIndex: number, newStep: ScheduleStep) => {
		setModel(produce(model, draft => { draft.schedule[stepIndex] = newStep }))
	}, [ model, setModel ])

	const removeScheduleStep = useCallback((stepIndex: number) => {
		setModel(produce(model, draft => { draft.schedule = draft.schedule.filter((_, idx) => idx !== stepIndex) }))
	}, [ model, setModel ])

	const addScheduleStep = useCallback(() => setModel({
		...model,
		schedule: [ ...model.schedule, { behavior: Object.keys(behaviors)[0], repeat: 1, enabled: true, id: crypto.randomUUID() } ]
	}), [ model, setModel ])

	const setNumberParameterValue = useCallback((paramIdx: number, value: number) => {
		setModel(produce(model, draft => { draft.parameters[paramIdx].value = value }))
	}, [ model, setModel ])

	const setStringParameterValue = useCallback((paramIdx: number, value: string) => {
		setModel(produce(model, draft => { draft.parameters[paramIdx].value = value }))
	}, [ model, setModel ])

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
				label="Shoot Color"
				value={model.stemColors.shoot}
				min={0.0}
				max={1.0}
				step={0.01}
				setValue={v => setModel({ ...model, stemColors: { ...model.stemColors, shoot: v }})}
			/>

			<ColorInput
				label="Bark Color"
				value={model.stemColors.bark}
				min={0.0}
				max={1.0}
				step={0.01}
				setValue={v => setModel({ ...model, stemColors: { ...model.stemColors, bark: v }})}
			/>

			<ColorInput
				label="Root Color"
				value={model.stemColors.root}
				min={0.0}
				max={1.0}
				step={0.01}
				setValue={v => setModel({ ...model, stemColors: { ...model.stemColors, root: v }})}
			/>
		</div>
	)
}
