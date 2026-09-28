#!/usr/bin/env node
/**
 * Canonical D1 migration runner for crew-db.
 *
 * Flow:
 *   1. `wrangler d1 migrations apply` — applies 0001–0005 via Wrangler bookkeeping
 *   2. Ensure conversation columns (pinned/archived/kind/project_id) via PRAGMA —
 *      SQLite cannot `ADD COLUMN IF NOT EXISTS`, so these live outside migration SQL
 *      to stay idempotent on fresh and already-upgraded databases.
 *
 * Usage:
 *   node scripts/d1-migrate.mjs local
 *   node scripts/d1-migrate.mjs remote
 *
 * Does NOT deploy the Worker. Remote apply only mutates D1 schema/bookkeeping.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = (process.argv[2] || 'local').toLowerCase();
if (target !== 'local' && target !== 'remote') {
  console.error('Usage: node scripts/d1-migrate.mjs <local|remote>');
  process.exit(1);
}

const locationFlag = target === 'remote' ? '--remote' : '--local';

const CONVERSATION_COLUMNS = [
  { name: 'pinned', sql: 'ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0' },
  { name: 'archived', sql: 'ALTER TABLE conversations ADD COLUMN archived INTEGER NOT NULL DEFAULT 0' },
  { name: 'kind', sql: "ALTER TABLE conversations ADD COLUMN kind TEXT NOT NULL DEFAULT 'chat'" },
  { name: 'project_id', sql: 'ALTER TABLE conversations ADD COLUMN project_id TEXT' },
];

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  // Local: set CI so Wrangler skips confirm prompts. Remote: preserve real env so
  // OAuth/credentials work; operators can set CI=1 in pipelines themselves.
  const env = { ...process.env, ...opts.env };
  if (target === 'local' && env.CI === undefined) {
    env.CI = '1';
  }
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
    env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${cmd} exited ${result.status}`);
  }
  return result;
}

function wrangler(args) {
  return run('npx', ['wrangler', ...args]);
}

function executeSql(sql) {
  return wrangler([
    'd1',
    'execute',
    'crew-db',
    locationFlag,
    '--command',
    sql,
    '--json',
  ]);
}

function parseJsonStdout(stdout) {
  const text = (stdout || '').trim();
  if (!text) return null;
  // Prefer the first JSON array/object — wrangler may print banners before JSON.
  const arrStart = text.indexOf('[');
  const objStart = text.indexOf('{');
  let start = -1;
  if (arrStart >= 0 && (objStart < 0 || arrStart < objStart)) start = arrStart;
  else start = objStart;
  if (start < 0) return null;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    // Try last complete array if banner interleaved oddly
    const lastArr = text.lastIndexOf('\n[');
    if (lastArr >= 0) {
      try {
        return JSON.parse(text.slice(lastArr + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function existingConversationColumns() {
  const result = spawnSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'crew-db',
      locationFlag,
      '--command',
      'PRAGMA table_info(conversations)',
      '--json',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env:
        target === 'local' && process.env.CI === undefined
          ? { ...process.env, CI: '1' }
          : process.env,
    },
  );
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`PRAGMA table_info failed (${result.status})`);
  }
  const parsed = parseJsonStdout(result.stdout);
  // wrangler --json shape: [{ results: [ { name, ... }, ... ], success, ... }]
  const results = Array.isArray(parsed)
    ? parsed[0]?.results ?? parsed
    : parsed?.results ?? [];
  const names = new Set(
    (results || [])
      .map((row) => row?.name)
      .filter((n) => typeof n === 'string'),
  );
  return names;
}

function ensureConversationColumns() {
  console.log(`\n── Ensure conversation columns (${target}) ──`);
  const existing = existingConversationColumns();
  if (!existing.has('id')) {
    throw new Error('conversations table missing — run migrations apply first');
  }
  for (const col of CONVERSATION_COLUMNS) {
    if (existing.has(col.name)) {
      console.log(`  skip ${col.name} (already present)`);
      continue;
    }
    console.log(`  add  ${col.name}`);
    executeSql(col.sql);
  }
}

function main() {
  console.log(`D1 migrate target=${target}`);
  console.log('Step 1: wrangler d1 migrations apply (0001–0005 chain)');
  wrangler(['d1', 'migrations', 'apply', 'crew-db', locationFlag]);
  ensureConversationColumns();
  console.log(`\nOK: crew-db ${target} migration pipeline complete.`);
}

try {
  main();
} catch (err) {
  console.error('\nFAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
}
