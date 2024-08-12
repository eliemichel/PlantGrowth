import { ReactNode, useId } from 'react'
import './Dropdown.css'

type DropdownItemProps = {
	children: ReactNode,
}

export function DropdownItem({
	children,
}: DropdownItemProps) {
	return <li>{children}</li>
}

type DropdownProps = {
	label: string,
	children: ReactNode,
}

export default function Dropdown({
	label,
	children,
}: DropdownProps) {
	const toggleId = useId();

	return (
		<div className="dropdown">
			<input type="checkbox" id={toggleId} className="toggle-checkbox" />
			<label htmlFor={toggleId} className="dropdown-label">
				{label}
			</label>
			<label htmlFor={toggleId} className="dropdown-fullscreen-label"></label>
			<div className="content">
				<ul>
					{children}
				</ul>
			</div>
		</div>
	)
}
