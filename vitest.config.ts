import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'netlify/functions/__tests__/**/*.test.ts'],
    environmentMatchGlobs: [['netlify/functions/__tests__/**/*.test.ts', 'node']],
    typecheck: {
      tsconfig: './tsconfig.json'
    }
  }
});
