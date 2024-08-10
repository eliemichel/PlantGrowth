import { useId } from 'react'
import { Expression, makeConst } from '../models/DSL.tsx'
import { useNodeGraphDispatch } from '../reducers/nodeGraphReducer.tsx'

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

type ExpressionInputProps = {
	label: string,
	expr: Expression,
	setExpr: (value: Expression) => void,
	min?: number,
	max?: number,
	step?: number,
}

/**
 * If the expression is a simple constant, edit it. Otherwise, link to the node graph.
 */
export function ExpressionInput({
	label,
	expr,
	setExpr,
	min = 1,
	max = 100,
	step = 1,
}: ExpressionInputProps) {
	const inputId = useId();
	const linkId = useId();
	const nodeGraphDispatch = useNodeGraphDispatch();

	return (
		<div>
			<label htmlFor={expr.type === "constant" ? inputId : linkId}>
				{label}:&nbsp;
			</label>
			<input
				id={linkId}
				type="button"
				value="edit fx"
				onClick={_ => nodeGraphDispatch({ type: 'load-expression', expr })}
			/>
			{expr.type === "constant"
				? (
					<input
						id={inputId}
						type="number"
						min={min}
						max={max}
						step={step}
						value={expr.value}
						onChange={e => setExpr(makeConst(parseFloat(e.target.value)))}
					/>
				)
				: (
					<input
						id={inputId}
						type="button"
						value="set constant"
						onClick={_ => setExpr(makeConst((min + max) / 2))}
					/>
				)
			}
		</div>
	)
}
