import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('Factory Keep-to-draft handoff with isolated persistence and no providers', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  for (const key of Object.keys(env)) if (/DATABASE_URL|OPENROUTER|PRINTFUL/.test(key)) delete env[key];
  const child = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--test', 'tests/fixtures/factory-draft.mjs'], { env, encoding: 'utf8', timeout: 60000 });
  assert.equal(child.status, 0, child.stdout + child.stderr);
  assert.match(child.stdout, /tests 11/);
});
