import { useState, useMemo, useCallback } from 'react'
import { produce } from 'immer'
import { useAppStore } from '../stores/appStore.tsx'
import {
	type Parameter,
	createDefaultParameter,
} from '../models/ExpressionParameter.ts'
import {
	type MeristemStateType,
	type MeristemStateDataFieldType,
	createDefaultMeristemStateType,
	createDefaultMeristemStateDataFieldType,
} from '../models/GrowthModel.tsx'
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

		const removeParam = (paramIdx: number) => {
			setGrowthModel(selectedIdx, produce(growthModel, model => {
				model.parameters = model.parameters.filter((_, idx) => idx !== paramIdx);
			}))
		};

		return (
			<ul className="editor-section">
				{growthModel.parameters.map((param, paramIdx) => (
					<li key={paramIdx}>
						<em>Param #{paramIdx}</em>
						<button onClick={() => removeParam(paramIdx)} className="btn-compact">
							Remove
						</button>
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

		const setStateType = (typeIdx: number, newStateType: MeristemStateType) => {
			setGrowthModel(selectedIdx, produce(growthModel, model => {
				model.meristemStateTypes[typeIdx] = newStateType;
			}))
		};

		const addStateType = () => {
			setGrowthModel(selectedIdx, produce(growthModel, model => {
				model.meristemStateTypes.push(createDefaultMeristemStateType());
			}))
		};

		const removeStateType = (typeIdx: number) => {
			setGrowthModel(selectedIdx, produce(growthModel, model => {
				model.meristemStateTypes = model.meristemStateTypes.filter((_, idx) => idx !== typeIdx);
			}))
		};

		const setDataField = (typeIdx: number, fieldIdx: number, newDataField: MeristemStateDataFieldType) => {
			setGrowthModel(selectedIdx, produce(growthModel, model => {
				model.meristemStateTypes[typeIdx].dataFields[fieldIdx] = newDataField;
			}))
		};

		const addDataField = (typeIdx: number) => {
			setGrowthModel(selectedIdx, produce(growthModel, model => {
				model.meristemStateTypes[typeIdx].dataFields.push(createDefaultMeristemStateDataFieldType());
			}))
		};

		const removeDataField = (typeIdx: number, fieldIdx: number) => {
			setGrowthModel(selectedIdx, produce(growthModel, model => {
				const type = model.meristemStateTypes[typeIdx];
				type.dataFields = type.dataFields.filter((_, idx) => idx !== fieldIdx);
			}))
		};

		return (
			<ul className="editor-section">
				{growthModel.meristemStateTypes.map((type, typeIdx) => (
					<li key={typeIdx}>
						Name: <input
							type="text"
							value={type.name}
							onChange={e => setStateType(typeIdx, { ...type, name: e.target.value })}
						/>
						<button onClick={() => removeStateType(typeIdx)} className="btn-compact">
							Remove
						</button>
						<br/>
						Data Fields:
						<ul>
							{type.dataFields.map((entry, entryIdx) => (
								<li key={entryIdx}>
									Name: <input
										type="text"
										value={entry.name}
										onChange={e => setDataField(typeIdx, entryIdx, { ...entry, name: e.target.value })}
									/>
									Type: <select
										value={entry.type}
										onChange={e => setDataField(typeIdx, entryIdx, { ...entry, type: e.target.value as ("boolean" | "number") })}
									>
										<option value="number">number</option>
										<option value="boolean">boolean</option>
									</select>
									<button onClick={() => removeDataField(typeIdx, entryIdx)} className="btn-compact">
										Remove
									</button>
								</li>
							))}

							<li>
								<button onClick={() => addDataField(typeIdx)}>
									Add Data Field
								</button>
							</li>
						</ul>
					</li>
				))}

				<li>
					<button onClick={addStateType}>
						Add Meristem State Type
					</button>
				</li>
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
				<button onClick={toggleShowParameters} className="btn-compact">
					{showParameters ? "Hide" : "Show"}
				</button>
			</h3>
			{showParameters ? parameterList : null}

			<h3>
				Meristem States
				<button onClick={toggleShowMeristems} className="btn-compact">
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
