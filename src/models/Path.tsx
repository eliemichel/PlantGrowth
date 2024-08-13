import { ResultOrError, Ok, Err } from '../utils/error.tsx'

/**
 * Paths are used to uniquely identify expressions within a SimulationModel.
 */
export type ExpressionPath = {
	domain: "model",
	index: number,
	field: string, // must be the name of a valid Expression-typed field in model/etc.
}

// An alias to make the semantic of strings clearer when they are used as path
export type FormattedPath = string;

/**
 * Represent as string
 */
export function formatExpressionPath(path: ExpressionPath): string {
	return `${path.domain}/${path.index}/${path.field}`;
}

type ParseError = string;

/**
 * Build from string
 */
export function parseExpressionPath(strPath: string): ResultOrError<ExpressionPath,ParseError> {
	if (!strPath.startsWith("/")) {
		return Err("Only absolute paths are supported");
	}

	const tokens = strPath.substring(1).split("/");
	if (tokens.length != 3) {
		return Err("A path must be consistuted of 3 elements separated by forward slashes (/)");
	}

	const domain = tokens[0];
	if (domain != "model") {
		return Err(`Invalid path domain: '${domain}' (possible values are: 'model')`);
	}

	let index = 0;
	try {
		index = parseInt(tokens[1])
	} catch {
		return Err(`Could not parse '${tokens[1]}' as integer`);
	}

	return Ok({
		domain,
		index,
		field: tokens[2],
	})
}
