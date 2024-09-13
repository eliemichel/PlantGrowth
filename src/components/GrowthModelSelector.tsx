import { ReactNode, createContext, useContext, useMemo } from 'react'
import { useStore } from '../store'
import { type GrowthModel } from '../models/GrowthModel.ts'

import './GrowthModelSelector.css'


// Provide the selected growth model and its index, only if one is selected
const GrowthModelContext = createContext<[GrowthModel,number]>(null!);
export const useGrowthModel = () => useContext(GrowthModelContext);

type GrowthModelSelectorProps = {
	children: ReactNode,
	buttons?: ReactNode,
	fallback?: string,
}

export default function GrowthModelSelector(props: GrowthModelSelectorProps) {
	const {
		children,
		buttons,
		fallback,
	} = props;

	const allGrowthModels = useStore(store => store.scene.growthModels);
	const activeGrowthModelIndex = useStore(store => store.selection.activeGrowthModelIndex);
	const selectedIdx = activeGrowthModelIndex === null ? -1 : activeGrowthModelIndex;
	const setSelectedIdx = useStore(store => store.setActiveGrowthModel);
	const modelCount = allGrowthModels.items.length;

	const growthModel = useMemo(() => {
		return (
			selectedIdx < 0 || selectedIdx >= modelCount
			? undefined
			: allGrowthModels.items[selectedIdx]
		)
	}, [ allGrowthModels, selectedIdx, modelCount ])

	const selectionDropdown = useMemo(() => (
		<>
			Model: <select
				value={selectedIdx}
				onChange={e => setSelectedIdx(parseInt(e.target.value))}
			>
				<option value="-1">Select a path...</option>
				{Array.from({ length: modelCount }).map((_, idx) => (
					<option key={idx} value={idx}>/model/{idx}</option>
				))}
			</select>
		</>
	), [ selectedIdx, setSelectedIdx, modelCount ]);

	const maybeChildren = useMemo(() => (
		growthModel !== undefined
		? (
			<GrowthModelContext.Provider value={[growthModel, selectedIdx]}>
				{children}
			</GrowthModelContext.Provider>
		)
		: fallback !== undefined
		? <p>{fallback}</p>
		: null
	), [ growthModel, children, fallback, selectedIdx ]);

	return (
		<div className="growth-model-selector">
			<header>
				{selectionDropdown}
				{buttons}
			</header>
			<main>
				{maybeChildren}
			</main>
		</div>
	)
}
