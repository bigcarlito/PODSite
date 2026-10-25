import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("scene mockups preserve alpha, reject missing bases and isolate gallery changes", () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // Otherwise Node suppresses a nested --test run.
  for (const key of Object.keys(env)) if (/DATABASE_URL|OPENROUTER|PRINTFUL|PRINTIFY/.test(key)) delete env[key];
  const child = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", "tests/fixtures/mockup-pipeline.mjs"], { env, encoding:"utf8", timeout:30000 });
  assert.equal(child.status, 0, child.stdout + child.stderr);
  assert.match(child.stdout, /tests 7/);
});
