import { useId } from 'react'
import {
	IntegerParameter,
	FloatParameter,
	StringParameter,
	EnumParameter,
	Parameter,
} from '../models/ExpressionParameter.ts'

type FloatParameterInputProps = {
	parameter: FloatParameter,
	setValue: (value: number) => void,
}

export function FloatParameterInput(props: FloatParameterInputProps) {
	const { setValue, parameter } = props;
	const { label, value, minimum, maximum } = parameter;
	const id = useId();

	const step =
		minimum !== undefined && maximum !== undefined
		? (minimum + maximum) * 0.01
		: 0.1

	return (
		<div>
			<label htmlFor={id}>
				{label}:&nbsp;
				<input
					id={id}
					type="number"
					min={minimum}
					max={maximum}
					step={step}
					value={value}
					onChange={e => setValue(parseFloat(e.target.value))}
				/>
			</label>
		</div>
	)
}

export function FloatAngleParameterInput(props: FloatParameterInputProps) {
	const { setValue, parameter } = props;
	const { label, value, minimum, maximum } = parameter;
	const id = useId();

	const step =
		minimum !== undefined && maximum !== undefined
		? (minimum + maximum) * 0.01
		: 0.1

	return (
		<div>
			<label htmlFor={id}>
				{label}:&nbsp;
				<input
					id={id}
					type="number"
					min={minimum}
					max={maximum}
					step={step}
					value={180 / Math.PI * value}
					onChange={e => setValue(Math.PI / 180 * parseFloat(e.target.value))}
				/>°
			</label>
		</div>
	)
}

type IntegerParameterInputProps = {
	parameter: IntegerParameter,
	setValue: (value: number) => void,
}

export function IntegerParameterInput(props: IntegerParameterInputProps) {
	const { setValue, parameter } = props;
	const { label, value, minimum, maximum } = parameter;
	const id = useId();

	return (
		<div>
			<label htmlFor={id}>
				{label}:&nbsp;
				<input
					id={id}
					type="number"
					min={minimum}
					max={maximum}
					step={1}
					value={value}
					onChange={e => setValue(parseInt(e.target.value))}
				/>
			</label>
		</div>
	)
}

type StringParameterInputProps = {
	parameter: StringParameter,
	setValue: (value: string) => void,
}

export function StringParameterInput(props: StringParameterInputProps) {
	const { setValue, parameter } = props;
	const { label, value } = parameter;
	const id = useId();

	return (
		<div>
			<label htmlFor={id}>
				{label}:&nbsp;
				<input
					id={id}
					type="text"
					value={value}
					onChange={e => setValue(e.target.value)}
				/>
			</label>
		</div>
	)
}

type EnumParameterInputProps = {
	parameter: EnumParameter,
	setValue: (value: number) => void,
}

export function EnumParameterInput(props: EnumParameterInputProps) {
	const { setValue, parameter } = props;
	const { label, value, options } = parameter;
	const id = useId();

	return (
		<div>
			<label htmlFor={id}>
				{label}:&nbsp;
				<select
					id={id}
					value={value}
					onChange={e => setValue(parseInt(e.target.value))}
				>
					{options.map(opt => (
						<option key={opt.value} value={opt.value}>{opt.label}</option>
					))}
				</select>
			</label>
		</div>
	)
}

type ParameterInputProps = {
	parameter: Parameter,
	setNumberParameterValue: (value: number) => void,
	setStringParameterValue: (value: string) => void,
}

export function ParameterInput(props: ParameterInputProps) {
	const {
		parameter,
		setNumberParameterValue,
		setStringParameterValue,
	} = props;

	if (parameter.hidden === true) return null;

	switch (parameter.type) {
	case "float":
		switch (parameter.subtype) {
		case "angle":
			return <FloatAngleParameterInput parameter={parameter} setValue={value => setNumberParameterValue(value)} />
		default:
			return <FloatParameterInput parameter={parameter} setValue={value => setNumberParameterValue(value)} />
		}
	case "integer":
		return <IntegerParameterInput parameter={parameter} setValue={value => setNumberParameterValue(value)} />
	case "string":
		return <StringParameterInput parameter={parameter} setValue={value => setStringParameterValue(value)} />
	case "enum":
		return <EnumParameterInput parameter={parameter} setValue={value => setNumberParameterValue(value)} />
	}
}
