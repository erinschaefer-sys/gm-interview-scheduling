#!/usr/bin/env node
// Local guard, standing in for the Ema template's `guard` check. Fails when:
//  1. app code references an outside host (published pods have no outbound network)
//  2. components use raw hex colors or palette classes (design-system rule)
//  3. fixture mode is enabled in production config
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const failures = [];
const fail = (file, line, msg) => failures.push(`${relative(root, file)}${line ? `:${line}` : ''}  ${msg}`);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const code = ['src', 'server', 'shared']
  .flatMap((d) => walk(join(root, d)))
  .filter((f) => /\.(ts|tsx|js|jsx|css|html)$/.test(f) && !/\.test\.tsx?$/.test(f));
code.push(join(root, 'index.html'));

const URL_ALLOW = [/^https?:\/\/localhost\b/, /^https?:\/\/127\.0\.0\.1\b/, /^http:\/\/www\.w3\.org\//];
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const PALETTE = /\b(?:bg|text|border|ring|outline|fill|stroke|from|to|via|divide|placeholder|accent|caret|decoration|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?\b/;

for (const file of code) {
  const rel = relative(root, file);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, i) => {
    const n = i + 1;
    for (const m of text.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
      if (!URL_ALLOW.some((re) => re.test(m[0]))) fail(file, n, `outside URL "${m[0]}" (no outbound network in published pods; vendor assets, call AIEs via EmuClient)`);
    }
    if (rel.startsWith('src/') && rel !== 'src/styles/tokens.css') {
      if (HEX.test(text) && !/^\s*\/\//.test(text)) fail(file, n, 'raw hex color; use a design-system token');
      const p = PALETTE.exec(text);
      if (p) fail(file, n, `palette class "${p[0]}"; use a design-system token`);
    }
  });
}

// Fixture mode must never be on in production config.
for (const f of ['.env.production', '.env.production.local', 'catalog.yaml', 'docs/catalog-intent.yaml']) {
  const p = join(root, f);
  if (existsSync(p) && /CASE_SOURCE\s*[:=]\s*["']?fixture/i.test(readFileSync(p, 'utf8'))) {
    fail(p, 0, 'CASE_SOURCE=fixture in production config');
  }
}
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (/CASE_SOURCE=fixture/.test(pkg.scripts?.start ?? '') || /CASE_SOURCE=fixture/.test(pkg.scripts?.build ?? '')) {
  fail(join(root, 'package.json'), 0, 'fixture mode enabled in start/build script');
}

if (failures.length) {
  console.error(`guard: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`guard: ok (${code.length} files checked)`);
