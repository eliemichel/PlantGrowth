import { useId } from 'react'
import { type Expression, makeConst } from '../models/DSL.ts'
import { type ExpressionPath } from '../models/Path.ts'
import { useAppStore } from '../stores/appStore.ts'
import { type Vector } from '../utils/vector.ts'

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

type ColorInputProps = {
	label: string,
	value: Vector,
	setValue: (value: Vector) => void,
	min?: number,
	max?: number,
	step?: number,
}

export function ColorInput({
	label,
	value,
	setValue,
	min = 1,
	max = 100,
	step = 1,
}: ColorInputProps) {
	const id = useId();

	return (
		<div>
			{label}:&nbsp;
			<label htmlFor={id}>
				r:&nbsp;
				<input
					id={id}
					type="number"
					min={min}
					max={max}
					step={step}
					value={value[0]}
					onChange={e => setValue([ parseFloat(e.target.value), value[1], value[2] ])}
				/>
			</label>
			<label htmlFor={id}>
				g:&nbsp;
				<input
					id={id}
					type="number"
					min={min}
					max={max}
					step={step}
					value={value[1]}
					onChange={e => setValue([ value[0], parseFloat(e.target.value), value[2] ])}
				/>
			</label>
			<label htmlFor={id}>
				b:&nbsp;
				<input
					id={id}
					type="number"
					min={min}
					max={max}
					step={step}
					value={value[2]}
					onChange={e => setValue([ value[0], value[1], parseFloat(e.target.value) ])}
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
	exprPath: ExpressionPath,
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
	exprPath,
	expr,
	setExpr,
	min = 1,
	max = 100,
	step = 1,
}: ExpressionInputProps) {
	const inputId = useId();
	const linkId = useId();
	const setActiveExpression = useAppStore(store => store.setActiveExpression);

	return (
		<div>
			<label htmlFor={expr.type === "constant" ? inputId : linkId}>
				{label}:&nbsp;
			</label>
			<input
				id={linkId}
				type="button"
				value="edit fx"
				onClick={() => setActiveExpression(exprPath, label)}
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
						onChange={e => setExpr({ ...expr, value: parseFloat(e.target.value) })}
					/>
				)
				: (
					<input
						id={inputId}
						type="button"
						value="set constant"
						onClick={() => setExpr(makeConst((min + max) / 2))}
					/>
				)
			}
		</div>
	)
}
