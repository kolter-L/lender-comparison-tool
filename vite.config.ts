import react from '@vitejs/plugin-react'
// vitest/config re-exports Vite's defineConfig with the `test` block typed.
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // e2e/ holds Playwright specs. They share the *.spec.ts naming but need a browser and a
    // served app, so Vitest must not pick them up.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
