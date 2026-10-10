import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Relative base so the build works from any static host or sub-path.
  base: './',
  test: {
    include: ['src/**/*.test.ts'],
  },
})
