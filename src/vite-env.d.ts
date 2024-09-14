/// <reference types="vite/client" />

declare module "*.glsl" {
	const source: string;
	export = source;
}
