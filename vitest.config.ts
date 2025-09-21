import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'scripts', 'public'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      exclude: ['node_modules', 'dist', 'scripts', 'public', '*.config.{ts,js}'],
      reporter: ['text', 'lcov']
    },
  },
})