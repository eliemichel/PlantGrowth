/**
 * Generic type wrapper to handle errors in a purely functional way rather than
 * using exceptions.
 * QUESTION: Should we just use the built-in Promise instead, although we do
 * not need the asynchronicity but only the possibility to resolve or reject?
 */
export type ResultOrError<Result,Error> =
	| { result: Result, error: undefined }
	| { result: undefined, error: Error }

/**
 * Utility to build a valid ResultOrError
 */
export function Ok<Result>(result: Result) {
	return { result, error: undefined };
}

/**
 * Utility to build an invalid ResultOrError
 */
export function Err<Error>(error: Error) {
	return { result: undefined, error };
}

/**
 * Use this when you know for sure that the ResultOrError contains a result.
 */
export function assertOk<Result,Error>(maybeResult: ResultOrError<Result,Error>): Result {
	console.assert(maybeResult.result !== undefined);
	return maybeResult.result as Result;
}

/**
 * Use this when you know for sure that the ResultOrError contains an error.
 */
export function assertErr<Result,Error>(maybeResult: ResultOrError<Result,Error>): Error {
	console.assert(maybeResult.error !== undefined);
	return maybeResult.error as Error;
}

/**
 * Use this as a type guard to test if the value is indeed a result.
 */
export function isOk<Result,Error>(maybeResult: ResultOrError<Result,Error>): maybeResult is { result: Result, error: undefined } {
	return maybeResult.result !== undefined;
}

/**
 * Use this as a type guard to test if the value is an error.
 */
export function isErr<Result,Error>(maybeResult: ResultOrError<Result,Error>): maybeResult is { result: undefined, error: Error } {
	return maybeResult.error !== undefined;
}

/**
 * Transform an array of ResultOrError into a single ResultOrError that
 * contains an array of results. If there is an error, this returns the first
 * error from the array.
 */
export function allResults<Result,Error>(maybeResults: ResultOrError<Result,Error>[]): ResultOrError<Result[],Error> {
	return maybeResults.reduce(
		(acc: ResultOrError<Result[],Error>, x: ResultOrError<Result,Error>) => {
			if (acc.result === undefined) {
				return Err(assertErr(acc))
			} else if (x.result === undefined) {
				return Err(assertErr(x))
			} else {
				return Ok([...acc.result, x.result])
			}
		},
		Ok([])
	);
}
