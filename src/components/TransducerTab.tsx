import { useMemo } from 'react'
import { useStore } from '../store'
import MeristemTransducerEditor from './MeristemTransducerEditor.tsx'
import GrowthModelSelector from './GrowthModelSelector.tsx'

/**
 * A wrapper to provide state to the MeristemTransducerEditor component.
 */
export default function TransducerTab() {

	const test = useStore(store => store.test)

	const testBtn = useMemo(() => (
		<button onClick={test}>Test</button>
	), [ test ])

	return (
		<GrowthModelSelector fallback="Please select a model to edit above." buttons={testBtn}>
			<MeristemTransducerEditor />
		</GrowthModelSelector>
	)
}
