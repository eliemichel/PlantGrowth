import { expect, test } from 'vitest'
import { assertOk } from '../utils/error.tsx'
import {
	parseExpressionPath,
} from '../models/Path.tsx'

test('Can parse simple expression path', () => {
	const domain = "model";
	const index = 42;
	const field = "xyz";

	const maybePath = parseExpressionPath(`/${domain}/${index}/${field}`);

	expect(maybePath.error).toBe(undefined);
	const path = assertOk(maybePath);

	expect(path.domain).toStrictEqual(domain);
	expect(path.index).toBe(index);
	expect(path.field).toBe(field);
})

test('Invalid domain is rejected', () => {
	const domain = "some invalid model";
	const index = 42;
	const field = "xyz";

	const maybePath = parseExpressionPath(`/${domain}/${index}/${field}`);

	expect(maybePath.result).toBe(undefined);
})

test('Path with more than 3 tokens is invalid', () => {
	const maybePath = parseExpressionPath(`/model/123/foo/bar`);

	expect(maybePath.result).toBe(undefined);
})

test('Path with less than 3 tokens is invalid', () => {
	const maybePath = parseExpressionPath(`/model/123`);

	expect(maybePath.result).toBe(undefined);
})

test('Path must start with a slash', () => {
	const maybePath = parseExpressionPath(`model/123/foo/bar`);

	expect(maybePath.result).toBe(undefined);
})

test('Path index must be an integer', () => {
	const maybePath = parseExpressionPath(`/model/bla/foo`);
	expect(maybePath.result).toBe(undefined);

	const maybePath2 = parseExpressionPath(`/model/23.5/foo`);
	expect(maybePath2.result).toBe(undefined);

	const maybePath3 = parseExpressionPath(`/model/23/foo`);
	expect(maybePath3.error).toBe(undefined);
})
