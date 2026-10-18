import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      UPLOAD_DIR: '.cache/test-uploads',
      AI_TRIAGE_ENABLED: 'true',
      AI_TIMEOUT_MS: '1000',
      DUPLICATE_SIMILARITY: '0.88',
      DUPLICATE_RADIUS_M: '50',
    },
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
