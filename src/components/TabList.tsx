import { ReactNode, ReactElement, useId, useState } from 'react'
import './TabList.css'

type TabItemProps = {
	label: string,
	children: ReactNode,
}

export function TabItem({
	label,
	children
}: TabItemProps) {
	console.warn(`A TabItem component should only be used within a TabList but TabItem with label '${label}' was used outside of a TabList. Content: ${children}`);
	return null;
}

type TabListProps = {
	children: ReactElement<TabItemProps>[],
	initialTab?: number, // initial tab index, 0-based
}

/**
 * Tab container inspired by https://blog.logrocket.com/how-to-build-tab-component-react/
 */
export function TabList({
	children,
	initialTab
}: TabListProps) {
	const [ currentTab, setCurrentTab ] = useState(initialTab ?? 0);

	// An array of { tab, panel } ids
	const allIds = Array.from(children).map(() => ({
		tab: "tab-id" + useId(),
		panel: "panel-id" + useId(),
	}));

	return (
		<div className="tabs vertical-stack">
			<nav className="tab-nav">
				<ul className="tab-list" role="tablist" aria-orientation="horizontal">
					{children.map((item, idx) => (
						<li key={idx}>
							<button
								role="tab"
								id={allIds[idx].tab}
								aria-controls={allIds[idx].panel}
								aria-selected={idx == currentTab}
								className="tab-btn"
								onClick={() => setCurrentTab(idx)}
							>
								{item.props.label}
							</button>
						</li>
					))}
				</ul>
			</nav>
			{children.map((item, idx) => idx == currentTab ? (
				<div key={idx} role="tabpanel" id={allIds[idx].panel} aria-labelledby="tab-1" className="tab-panel">
					{item.props.children}
				</div>
			) : null)}
		</div>
	)
}
