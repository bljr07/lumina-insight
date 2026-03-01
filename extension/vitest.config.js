import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use jsdom for content script tests that need DOM
    environment: 'jsdom',

    // Global setup file for Chrome API mocks
    setupFiles: ['./test/setup.js'],

    // Include test files
    include: [
      'test/unit/**/*.test.js',
      'test/integration/**/*.test.js',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/**/index.js'], // Exclude thin wrappers
      thresholds: {
        'src/shared': { lines: 100 },
        'src/content': { lines: 90 },
        'src/background': { lines: 90 },
        'src/offscreen': { lines: 80 },
      },
    },

    // Faster test isolation
    pool: 'forks',
  },

  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@content': path.resolve(__dirname, 'src/content'),
      '@background': path.resolve(__dirname, 'src/background'),
      '@offscreen': path.resolve(__dirname, 'src/offscreen'),
      '@popup': path.resolve(__dirname, 'src/popup'),
    },
  },
});
