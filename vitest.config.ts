import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov']
    },
  },
})