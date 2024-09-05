//import { defineConfig } from 'vite'
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

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
