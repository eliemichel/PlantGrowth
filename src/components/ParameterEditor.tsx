import {
	type Parameter,
	allParameterTypes,
	allParameterSubTypes,
} from '../models/ExpressionParameter.ts'

import { EnumInput } from './inputs.tsx'

type ParameterEditorProps = {
	parameter: Parameter,
	setParameter: (newParam: Parameter) => void,
}

export default function ParameterEditor(props: ParameterEditorProps) {
	const param = props.parameter;
	const setParam = props.setParameter;

	return <>
		<label>Name: <input
			type="text"
			value={param.name}
			onChange={e => setParam({ ...param, name: e.target.value })}
		/></label>
		<label>Label: <input
			type="text"
			value={param.label}
			onChange={e => setParam({ ...param, label: e.target.value })}
		/></label>
		<label>Description: <input
			type="text"
			value={param.description}
			onChange={e => setParam({ ...param, description: e.target.value })}
		/></label>
		<label><input
			type="checkbox"
			checked={param.hidden ?? false}
			onChange={e => setParam({ ...param, hidden: e.target.checked })}
		/> Hidden</label>
		<EnumInput
			label="Type"
			value={param.type}
			setValue={() => {}}
			options={allParameterTypes}
		/>
		{param.type === "float" ? (
			<>Subtype: <select
				value={param.subtype ?? "none"}
				onChange={e => setParam({ ...param, subtype: e.target.value } as Parameter)}
			>
				<option value="none">none</option>
				{allParameterSubTypes[param.type].map(subtype => (
					<option key={subtype} value={subtype}>{subtype}</option>
				))}
			</select></>
		) : null}
	</>
}
