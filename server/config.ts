export type CaseSourceMode = 'fixture' | 'slots';

export interface AppConfig {
  caseSource: CaseSourceMode;
  port: number;
  production: boolean;
}

/**
 * CASE_SOURCE defaults to `slots` (the real AI Employees). Fixture mode is a
 * local-review tool only and refuses to start in a production build.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === 'production';
  const raw = env.CASE_SOURCE ?? 'slots';
  if (raw !== 'fixture' && raw !== 'slots') {
    throw new Error(`CASE_SOURCE must be "fixture" or "slots" (got "${raw}")`);
  }
  if (raw === 'fixture' && production) {
    throw new Error('CASE_SOURCE=fixture is not allowed when NODE_ENV=production');
  }
  return { caseSource: raw, port: Number(env.PORT ?? 8787), production };
}
