import { useAppStore } from '../stores/appStore.tsx'
import MeristemTransducerEditor from './MeristemTransducerEditor.tsx'
import GrowthModelSelector from './GrowthModelSelector.tsx'

/**
 * A wrapper to provide state to the MeristemTransducerEditor component.
 */
export default function TransducerTab() {
	//const scene = useAppStore(state => state.scene);

	return (
		<GrowthModelSelector fallback="Please select a model to edit above.">
			<p>Transducer Tab2</p>
			<MeristemTransducerEditor />
		</GrowthModelSelector>
	)
}
