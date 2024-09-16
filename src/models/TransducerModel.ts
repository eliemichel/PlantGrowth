
/**
 * A transducer is a finite state machine that can emit symbols (called
 * "actions" in our case because they corresponds to growth actions that a part
 * of plant is taking) when following a transition from one state to another.
 * 
 * NB: This is meant to replace what is currently in GrowthModel, hence the
 * apparent duplication here and in the tests validation functions.
 */
export type Transducer = {
	// Definition of the states that the transducer can handle
	states: StateDefinition[],

	// Definition of the actions that the transducer may emit
	actions: ActionDefinition[],

	// We define one transition (a.k.a. "arrow") per type of state
	arrows: { [key: StateType]: TransducerArrow }
}

/**
 * The state is made of a discrete component 'type' that drives the overall
 * logic that handles the state, and an optional set of continuous parameters
 * that serve as payload to refine the behavior.
 */
export type State = {
	type: StateType,
	data: { [key: string]: boolean | number },
}

export type StateType = string;

/**
 * This defines a space of allowed values for State
 */
export type StateDefinition = {
	name: StateType,
	dataFields: StateDataFieldDefinition[],
}

export type StateDataFieldDefinition = {
  name: string,
  type: "boolean" | "number",
}

/**
 * A core component of transducer logic
 */
export type TransducerArrow = {
	targetState: State,
	actions: Action[],
}

export type Action = {
	type: ActionType,
}

export type ActionType = string;

export type ActionDefinition = {
	name: ActionType,
}

export function createInitialTransducer(): Transducer {
	return {
		states: [],
		actions: [],
		arrows: {},
	}
}
