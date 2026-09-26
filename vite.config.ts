import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8787', timeout: 50_000, proxyTimeout: 50_000 } },
  },
  test: {
    setupFiles: ['./src/test/setup.ts'],
    include: ['{src,server,shared}/**/*.test.{ts,tsx}'],
    exclude: ['**/*.tz.test.{ts,tsx}', 'node_modules/**'],
  },
});
