/*
 * Generic type wrappers to angle errors in a purely functional way rather than
 * using exceptions.
 */

export type ResultOrError<Result,Error> =
	| { result: Result, error: undefined }
	| { result: undefined, error: Error }

export function Ok<Result>(result: Result) {
	return { result, error: undefined };
}

export function Err<Error>(error: Error) {
	return { result: undefined, error };
}

export function allResults<Result,Error>(maybeResults: ResultOrError<Result,Error>[]): ResultOrError<Result[],Error> {
	return maybeResults.reduce(
		(acc: ResultOrError<Result[],Error>, x: ResultOrError<Result,Error>) => {
			if (acc.result === undefined) {
				return Err(acc.error as Error)
			} else if (x.result === undefined) {
				return Err(x.error as Error)
			} else {
				return Ok([...acc.result, x.result])
			}
		},
		Ok([])
	);
}
