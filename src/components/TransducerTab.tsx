import MeristemTransducerEditor from './MeristemTransducerEditor.tsx'
import GrowthModelSelector from './GrowthModelSelector.tsx'

/**
 * A wrapper to provide state to the MeristemTransducerEditor component.
 */
export default function TransducerTab() {
	return (
		<GrowthModelSelector fallback="Please select a model to edit above.">
			<MeristemTransducerEditor />
		</GrowthModelSelector>
	)
}
