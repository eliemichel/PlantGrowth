//import { defineConfig } from 'vite'
import type { PluginOption } from 'vite'
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react'
import string, { type RollupPluginStringOptions } from '@ian-sun/rollup-plugin-string';

type RollupPluginString = (options: RollupPluginStringOptions) => PluginOption;
// @ts-expect-error For some reason typescript does not correctly get the import of 'string'
const stringFixed: RollupPluginString = string;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    stringFixed({ include: "**.glsl" }),
  ],

  test: {
    setupFiles: "src/tests/setup.ts",

    coverage: {
      provider: 'v8', // or 'istanbul'
      include: [
        "src/models/*.ts",
        "src/models/*.tsx",
        "src/backend/*.ts",
        "src/backend/*.tsx",
      ],
    },
  },
})
