import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Run with TZ=America/Los_Angeles (see `npm run test:tz`): proves times render
// in the case timezone regardless of the machine's zone. Also re-runs the
// shared formatting tests under Pacific.
export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.tz.test.{ts,tsx}', 'shared/**/*.test.ts'],
  },
});
