//import { defineConfig } from 'vite'
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  test: {
    setupFiles: "src/tests/setup.tsx",

    coverage: {
      provider: 'v8', // or 'istanbul'
      include: [
        "src/models/DSL.tsx",
        "src/models/Path.tsx",
      ],
    },
  },
})
