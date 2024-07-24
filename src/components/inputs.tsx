import { useId } from 'react'

type NumberInputProps = {
	label: string,
	value: number,
	setValue: (value: number) => void,
	min?: number,
	max?: number,
	step?: number,
}

export function NumberInput({
	label,
	value,
	setValue,
	min = 1,
	max = 100,
	step = 1,
}: NumberInputProps) {
	const id = useId();

	return (
		<div>
			<label htmlFor={id}>
				{label}:&nbsp;
				<input
					id={id}
					type="number"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={e => setValue(parseFloat(e.target.value))}
				/>
			</label>
		</div>
	)
}

type EnumInputProps = {
	label: string,
	value: string,
	setValue: (value: string) => void,
	options: string[],
}

export function EnumInput({
	label,
	value,
	setValue,
	options,
}: EnumInputProps) {
	const id = useId();

	return (
		<div>
			<label htmlFor={id}>
				{label}:&nbsp;
				<select
					id={id}
					value={value}
					onChange={e => setValue(e.target.value)}
				>
					{options.map(opt => (
						<option key={opt} value={opt}>{opt}</option>
					))}
				</select>
			</label>
		</div>
	)
}
