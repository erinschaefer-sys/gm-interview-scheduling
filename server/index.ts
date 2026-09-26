import { readFile } from 'node:fs/promises';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp, REQUEST_TIMEOUT_MS } from './app';
import { loadConfig } from './config';
import { getEmuClient } from './platform/emu-client';
import { createFixtureSource } from './sources/fixture';
import { createSlotsSource } from './sources/slots';

const config = loadConfig();
const source = config.caseSource === 'fixture'
  ? createFixtureSource()
  : createSlotsSource(getEmuClient(), REQUEST_TIMEOUT_MS);

const app = createApp({ source });

if (config.production) {
  // Serves the built SPA; /schedule and any other client route get index.html.
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', async (c) => c.html(await readFile('./dist/index.html', 'utf8')));
}

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.info(`API listening on http://localhost:${info.port} (CASE_SOURCE=${config.caseSource})`);
  if (config.caseSource === 'fixture') console.warn('⚠ Fixture mode: serving seeded demo cases. Restart to reset submitted state.');
});
server.setTimeout?.(REQUEST_TIMEOUT_MS + 5_000);
