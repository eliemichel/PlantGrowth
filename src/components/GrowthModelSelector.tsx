import { ReactNode, createContext, useContext, useState, useMemo } from 'react'
import { useAppStore } from '../stores/appStore.tsx'
import { type GrowthModel } from '../models/GrowthModel.tsx'

import './GrowthModelSelector.css'


// Provide the selected growth model and its index, only if one is selected
const GrowthModelContext = createContext<[GrowthModel,number]>(null!);
export const useGrowthModel = () => useContext(GrowthModelContext);

type GrowthModelSelectorProps = {
	children: ReactNode,
	fallback?: string,
}

export default function GrowthModelSelector(props: GrowthModelSelectorProps) {
	const {
		children,
		fallback,
	} = props;

	// TODO: Replace with a slice of the global store
	const [ selectedIdx, setSelectedIdx ] = useState(-1);

	const allGrowthModels = useAppStore(store => store.scene.growthModels);
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
	), [ growthModel, children ]);

	return <>
		{selectionDropdown}
		{maybeChildren}
	</>
}
