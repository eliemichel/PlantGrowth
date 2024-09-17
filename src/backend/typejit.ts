/**
 * This is a set of utility functions for creating functions on the fly (using
 * eval()) while still ensuring some static typechecking.
 */

/**
 * A kernel is a mostly a JavaScript function 'fn', but it comes decorated with
 * its source code to help with debugging purpose.
 * TODO: 'source' is actually not used because we can debug with fn.toString(),
 * should we replace this whole type with just the type of fn then?
 */
export type Kernel<Return,Args extends unknown[]> = {
	fn: (...args: Args) => Return,
	source: string,
}

export type CompileKernelArgs<ClosureTypes> = {
	// Name of the arguments, as used in the source
	args: string[],

	// Source code of the kernel (in plain JavaScript, no TypeScript)
	source: string,

	// Symbols passed to the kernel's context, so that they can be invoked.
	// /!\ Keys are assumed to be valid identifiers
	closure?: { [key: string]: ClosureTypes },
}

/**
 * /!\ Typechecking cannot ensure that the number of arguments matches the
 * number of types.
 */
export function compileKernel<Return,Args extends unknown[],ClosureTypes = unknown>({
	args,
	source,
	closure,
}: CompileKernelArgs<ClosureTypes>): Kernel<Return,Args> {
	if (closure !== undefined) {
		const closureArgNames: string[] = [];
		const closureArgValues: ClosureTypes[] = [];
		for (const [ name, value ] of Object.entries(closure)) {
			closureArgNames.push(name);
			closureArgValues.push(value);
		}
		const closureFn = new Function(...closureArgNames, `"use strict";return (${args.join(', ')}) => {${source}}`);
		return {
			fn: closureFn(...closureArgValues) as (...args: Args) => Return,
			source,
		};
	} else {
		const raw = new Function(...args, `"use strict";${source}`);
		return {
			fn: raw as (...args: Args) => Return,
			source,
		};
	}
}
