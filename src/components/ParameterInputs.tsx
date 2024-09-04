import { useId } from 'react'
import {
	IntegerParameter,
	FloatParameter,
	StringParameter,
	EnumParameter,
	Parameter,
} from '../models/ExpressionParameter.ts'

import './ParameterInputs.css'

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
		<div className="parameter-input float">
			<label htmlFor={id}>
				{label}:&nbsp;
				<div className="help">
					<span className="help-icon">?</span>
					<div className="help-message">
						<span className="id">{parameter.name}</span><br/>
						{parameter.description}
					</div>
				</div>
			</label>
			<div className="input-block">
				<input
					id={id}
					className="raw"
					type="number"
					min={minimum}
					max={maximum}
					step={step}
					value={value}
					onChange={e => setValue(parseFloat(e.target.value))}
				/>
				<div className="range-wrapper">
					<input
						type="range"
						min={minimum}
						max={maximum}
						step={step}
						value={value}
						onChange={e => setValue(parseFloat(e.target.value))}
					/>
				</div>
			</div>
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
		<div className="parameter-input float angle">
			<label htmlFor={id}>
				{label}:&nbsp;
				<div className="help">
					<span className="help-icon">?</span>
					<div className="help-message">
						<span className="id">{parameter.name}</span><br/>
						{parameter.description}
					</div>
				</div>
			</label>
			<div className="input-block">
				<input
					id={id}
					className="raw"
					type="number"
					min={180 / Math.PI * (minimum ?? 0)}
					max={180 / Math.PI * (maximum ?? Math.PI)}
					step={180 / Math.PI * step}
					value={180 / Math.PI * value}
					onChange={e => setValue(Math.PI / 180 * parseFloat(e.target.value))}
				/>°
				<div className="range-wrapper">
					<input
						type="range"
						min={180 / Math.PI * (minimum ?? 0)}
						max={180 / Math.PI * (maximum ?? Math.PI)}
						step={180 / Math.PI * step}
						value={180 / Math.PI * value}
						onChange={e => setValue(Math.PI / 180 * parseFloat(e.target.value))}
					/>
				</div>
			</div>
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

	const stepSpacing =
		maximum !== undefined && minimum !== undefined
		? 100/(maximum-minimum)
		: 12.5;

	return (
		<div className="parameter-input integer">
			<label htmlFor={id}>
				{label}:&nbsp;
				<div className="help">
					<span className="help-icon">?</span>
					<div className="help-message">
						<span className="id">{parameter.name}</span><br/>
						{parameter.description}
					</div>
				</div>
			</label>
			<div className="input-block">
				<input
					id={id}
					className="raw"
					type="number"
					min={minimum}
					max={maximum}
					step={1}
					value={value}
					onChange={e => setValue(parseInt(e.target.value))}
				/>
				<div className="range-wrapper">
					<input
						type="range"
						className={minimum !== undefined && maximum !== undefined ? "stepped" : ""}
						style={{"--step-spacing": `${stepSpacing}%`} as React.CSSProperties}
						min={minimum}
						max={maximum}
						step={1}
						value={value}
						onChange={e => setValue(parseInt(e.target.value))}
					/>
				</div>
			</div>
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
		<div className="parameter-input string">
			<label htmlFor={id}>
				{label}:&nbsp;
				<div className="help">
					<span className="help-icon">?</span>
					<div className="help-message">
						<span className="id">{parameter.name}</span><br/>
						{parameter.description}
					</div>
				</div>
			</label>
			<div className="input-block">
				<input
					id={id}
					type="text"
					value={value}
					onChange={e => setValue(e.target.value)}
				/>
			</div>
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
		<div className="parameter-input enum">
			<label htmlFor={id}>
				{label}:&nbsp;
				<div className="help">
					<span className="help-icon">?</span>
					<div className="help-message">
						<span className="id">{parameter.name}</span><br/>
						{parameter.description}
					</div>
				</div>
			</label>
			<div className="input-block">
				<select
					id={id}
					value={value}
					onChange={e => setValue(parseInt(e.target.value))}
				>
					{options.map(opt => (
						<option key={opt.value} value={opt.value}>{opt.label}</option>
					))}
				</select>
			</div>
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
