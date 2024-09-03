import { useState, useMemo, useCallback } from 'react'
import { produce } from 'immer'
import { useAppStore } from '../stores/appStore.tsx'
import {
	type Parameter,
	createDefaultParameter,
} from '../models/ExpressionParameter.ts'
import ParameterEditor from './ParameterEditor.tsx'
import './GrowthModelAdvancedEditor.css'

export default function GrowthModelAdvancedEditor() {
	const [ selectedIdx, setSelectedIdx ] = useState(-1);
	const [ showParameters, setShowParameters ] = useState(true);
	const toggleShowParameters = useCallback(
		() => setShowParameters(!showParameters),
		[ showParameters, setShowParameters ]
	)
	const [ showMeristems, setShowMeristems ] = useState(true);
	const toggleShowMeristems = useCallback(
		() => setShowMeristems(!showMeristems),
		[ showMeristems, setShowMeristems ]
	)

	const allGrowthModels = useAppStore(store => store.scene.growthModels);
	const setGrowthModel = useAppStore(store => store.setGrowthModel);
	const modelCount = allGrowthModels.items.length;

	const growthModel = useMemo(() => {
		return (
			selectedIdx < 0 || selectedIdx >= modelCount
			? undefined
			: allGrowthModels.items[selectedIdx]
		)
	}, [ allGrowthModels, selectedIdx ])

	const selectionDropdown = useMemo(() => (
		<div className="model-selector">
			<select
				value={selectedIdx}
				onChange={e => setSelectedIdx(parseInt(e.target.value))}
			>
				<option value="-1">Models:</option>
				{Array.from({ length: modelCount }).map((_, idx) => (
					<option key={idx} value={idx}>Model #{idx}</option>
				))}
			</select>
		</div>
	), [ selectedIdx, setSelectedIdx, modelCount ]);

	const parameterList = useMemo(() => {
		if (growthModel === undefined) {
			return null;
		}

		const setParam = (paramIdx: number, newParam: Parameter) => {
			setGrowthModel(selectedIdx, produce(growthModel, model => {
				model.parameters[paramIdx] = newParam;
			}))
		};

		const addParam = () => {
			setGrowthModel(selectedIdx, produce(growthModel, model => {
				model.parameters.push(createDefaultParameter());
			}))
		};

		return (
			<ul className="editor-section">
				{growthModel.parameters.map((param, paramIdx) => (
					<li key={paramIdx}>
						<em>Param #{paramIdx}</em>
						<ParameterEditor
							parameter={param}
							setParameter={newParam => setParam(paramIdx, newParam)}
						/>
					</li>
				))}

				<li>
					<button onClick={addParam}>
						Add Custom Parameter
					</button>
				</li>
			</ul>
		)
	}, [ selectedIdx, growthModel, setGrowthModel ])

	const meristemList = useMemo(() => {
		if (growthModel === undefined) {
			return null;
		}

		return (
			<ul className="editor-section">
				<li>TODO</li>
			</ul>
		)
	}, [ growthModel ])

	const editor = useMemo(() => {
		if (growthModel === undefined) {
			return <p><em>Please select a model to edit above.</em></p>
		}

		return <>
			<h3>
				Custom Parameters
				<button onClick={toggleShowParameters}>
					{showParameters ? "Hide" : "Show"}
				</button>
			</h3>
			{showParameters ? parameterList : null}

			<h3>
				Meristem States
				<button onClick={toggleShowMeristems}>
					{showMeristems ? "Hide" : "Show"}
				</button>
			</h3>
			{showMeristems ? meristemList : null}
		</>
	}, [
		growthModel,
		parameterList,
		showParameters,
		toggleShowParameters,
		meristemList,
		showMeristems,
		toggleShowMeristems,
	])

	return (
		<div className="growth-model-advanced-editor">
			{selectionDropdown}
			{editor}
		</div>
	)
}
