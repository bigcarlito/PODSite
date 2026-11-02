import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { cycle, revisionInstruction, revisionSchema, reviewFileSchema } from "../src/lib/design/factory-review";
import { prepareFactoryBatch } from "../src/lib/design/factory";
const seed = JSON.parse(readFileSync("docs/design-factory/the-look.json", "utf8"));
const manifest = prepareFactoryBatch(seed.brief, seed.styles);
test("factory provider orchestration, tenant gates and spend reservation (stubbed)", () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  for (const key of Object.keys(env)) if (/DATABASE_URL|OPENROUTER|PRINTFUL|FACTORY_IMAGE/.test(key)) delete env[key];
  const child = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", "tests/fixtures/factory-review.mjs"], { env, encoding: "utf8", timeout: 30000 });
  assert.equal(child.status, 0, child.stdout + child.stderr);
  assert.match(child.stdout, /tests 4/);
});
test("carousel wraps without coupling candidate and garment state", () => {
  assert.equal(cycle(0, -1, 3), 2); assert.equal(cycle(2, 1, 3), 0); assert.equal(cycle(0, 1, 0), 0);
});
test("revision orchestration retains original and locked aspects and validates structured output", () => {
  const prompt = revisionInstruction({ manifest, candidateId: manifest.candidates[0].id, feedback: "Simplify fine fur", preserve: "Exact lettering and palette" });
  assert.ok(prompt.includes(manifest.candidates[0].prompt)); assert.match(prompt, /lockedAspects/); assert.match(prompt, /do not simply append/);
  assert.throws(() => revisionSchema.parse({ prompt: "feedback" }));
  assert.throws(() => revisionInstruction({ manifest, candidateId: "foreign", feedback: "x", preserve: "y" }));
});
test("review export round trips immutable manifest and lineage", () => {
  const value = { format: "factory-review-1", manifest, versions: [] };
  assert.deepEqual(reviewFileSchema.parse(JSON.parse(JSON.stringify(value))).manifest, manifest);
});
test("admin action and page enforce tenant session; agent endpoint uses bearer wrapper", () => {
  for (const name of ["actions.ts", "page.tsx"]) {
    const text = readFileSync(`src/app/admin/(dashboard)/design-factory/${name}`, "utf8");
    assert.match(text, /requireCurrentStore/); assert.match(text, /await isAdminAuthenticated\(store\)/);
  }
  assert.match(readFileSync("src/app/api/agent/design-factory/refine/route.ts", "utf8"), /withAgentAuth/);
  assert.match(readFileSync("src/lib/store/factory-review.ts", "utf8"), /brief.storeSlug !== store.slug/);
});
test("review UI keeps garment state independent, uses real bases and native alpha placement", () => {
  const text = readFileSync("src/app/admin/(dashboard)/design-factory/review.tsx", "utf8");
  assert.match(text, /scene.bases\[color\]/);
  assert.match(text, /constrainedPlacement\(requested, source, canvas\)/);
  assert.match(text, /profile \? printBoundary\(profile\) : scene\?\.area/);
  assert.match(text, /area.x \* 100/);
  assert.match(text, /alphaBounds\(ctx.getImageData/);
  assert.match(text, /layout\?\.limits\[key\]\.min/);
  assert.match(text, /layout\?\.limits\[key\]\.max/);
  assert.match(text, /onTouchEnd/); assert.match(text, /onKeyDown/);
  assert.match(text, /crypto.subtle.digest\("SHA-256"/);
  assert.match(text, /parentId: version.id/);
  assert.doesNotMatch(text, /select\([^;]+setColor/);
});
