import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': resolve(import.meta.dirname, '.') },
  },
  test: {
    environment: 'node',
    // `.tsx` as well, so a server component can be rendered and asserted on. `queue-songs-tab`
    // is the first: it proves the console draws the right buttons and, more importantly, that
    // no storage path reaches the markup.
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
})
