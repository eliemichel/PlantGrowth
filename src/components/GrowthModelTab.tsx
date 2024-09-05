import GrowthModelSelector from './GrowthModelSelector.tsx'
import GrowthModelAdvancedEditor from './GrowthModelAdvancedEditor.tsx'

/**
 * A wrapper to provide state to the GrowthModelAdvancedEditor component.
 */
export default function GrowthModelTab() {
	return (
		<GrowthModelSelector fallback="Please select a model to edit above.">
			<GrowthModelAdvancedEditor />
		</GrowthModelSelector>
	)
}
