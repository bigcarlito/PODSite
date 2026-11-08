import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { keepReviewedVersion, type ReviewVersion } from "../src/lib/design/factory-review";
const version: ReviewVersion = { id: "original", candidateId: "original", parentId: null, prompt: "original prompt", rationale: "original", preserved: [], feedback: "", decision: "pending", createdAt: "2026-11-08", image: "data:image/png;base64,YQ==" };
const placement = { version: 1 as const, x: .5, y: .5, scale: .7 };
test("Keep captures viewed scene identifier and placement without changing source version", () => {
  const kept = keepReviewedVersion(version, "actual-scene-garment", placement);
  assert.deepEqual(kept.placements?.["actual-scene-garment"], placement);
  assert.equal(kept.placements?.["comfort-colors-1717"], undefined);
  assert.equal(kept.image, version.image); assert.equal(kept.id, version.id);
  assert.equal(version.decision, "pending"); assert.equal(kept.decision, "keep");
  assert.equal(kept.decisions?.at(-1)?.decision, "keep");
  assert.throws(() => keepReviewedVersion(version, "", placement), /Select a garment/);
  assert.throws(() => keepReviewedVersion(version, "garment", { ...placement, scale: -1 }));
});
test("previously kept review retains artwork and other garment placements", () => {
  const original = keepReviewedVersion(version, "first", placement);
  const kept = keepReviewedVersion(original, "second", placement);
  assert.deepEqual(kept.placements, { first: placement, second: placement });
  assert.deepEqual(original.placements, { first: placement });
  assert.equal(kept.image, original.image); assert.equal(kept.createdAt, original.createdAt);
});
test("modal wiring preserves Keep on close and reopening does not re-Keep", () => {
  const ui = readFileSync("src/app/admin/(dashboard)/design-factory/review.tsx", "utf8");
  assert.match(ui, /<dialog ref=\{dialog\} aria-labelledby=/);
  assert.match(ui, /dialog.current\?\.showModal\(\)/);
  assert.match(ui, /onClose=\{\(\) => setHandoff\(undefined\)\}/);
  assert.match(ui, /onClick=\{\(\) => setHandoff\(\{ version, productType: scene.productType \}\)\}/);
  assert.match(ui, /version: reviewed, productType: scene.productType/);
  assert.match(ui, /onSettingsChange=/);
  const form = readFileSync("src/app/admin/(dashboard)/design-factory/draft-product.tsx", "utf8");
  assert.doesNotMatch(form, /<select/);
  assert.match(form, /submitting.current/);
  assert.match(form, /setError\(e instanceof Error \? e.message/);
  assert.match(form, /garments\[0\]/);
});
