import { expect, test, vi } from 'vitest'
import { type Kernel, compileKernel } from '../backend/typejit.ts'

// Test that requiring proper typing works
function runNumberKernel(kernel: (input: number) => number, input: number) {
	return kernel(input);
}
function runStringKernel(kernel: (input: string) => string, input: string) {
	return kernel(input);
}
function runStringNumberKernel(kernel: (inputA: string, inputB: number) => string, inputA: string, inputB: number) {
	return kernel(inputA, inputB);
}

test("Basic kernel usage", () => {
	const incrKernel: Kernel<number, [number]> = compileKernel<number, [number]>({
		args: [ "arg0" ],
		source: "return arg0 + 1;",
	});
	expect(incrKernel.fn(41)).toBe(42)
	expect(runNumberKernel(incrKernel.fn, 12)).toBe(13)

	const helloKernel = compileKernel<string, [string]>({
		args: [ "arg0" ],
		source: `return "hello " + arg0;`,
	});
	expect(helloKernel.fn("world")).toBe("hello world")
	expect(runStringKernel(helloKernel.fn, "from the moon")).toBe("hello from the moon")

	const repeatKernel = compileKernel<string, [string,number]>({
		args: [ "arg0", "arg1" ],
		source: `return arg0.repeat(arg1);`
	});
	expect(repeatKernel.fn("Xx", 4)).toBe("XxXxXxXx")
	expect(runStringNumberKernel(repeatKernel.fn, "_o_", 3)).toBe("_o__o__o_")
})

test("Use kernel closure (1/2)", () => {
	const foo = vi.fn();

	const kernel = compileKernel<undefined, []>({
		args: [],
		source: "foo();",
		closure: {
			foo,
		}
	});

	expect(kernel.fn()).toBe(undefined);
	expect(foo).toHaveBeenCalled();
})

test("Use kernel closure (2/2)", () => {
	const incr = (x: number) => x + 1;

	const kernel = compileKernel<number, [number]>({
		args: ["input"],
		source: "return transform(input);",
		closure: {
			transform: incr,
		}
	});

	expect(kernel.fn(41)).toBe(42);
})
