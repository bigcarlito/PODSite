import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PLACEMENT, placementLayout, placementSchema, placementStyle, productionPlacement, serializePlacement } from "../src/lib/design/placement";
import { updateReviewPlacement, reviewFileSchema } from "../src/lib/design/factory-review";
import { prepareFactoryBatch } from "../src/lib/design/factory";
import { readFileSync } from "node:fs";

test("contain, scale, translation and clipping use print area coordinates", () => {
  const source = { width: 200, height: 100 }, area = { width: 400, height: 600 };
  assert.deepEqual(placementLayout(DEFAULT_PLACEMENT, source, area), { left: 0, top: 200, width: 400, height: 200, clip: { left: 0, top: 200, right: 400, bottom: 400 }, clipped: false });
  const p = { ...DEFAULT_PLACEMENT, scale: 2, x: 0, y: 1 };
  const box = placementLayout(p, source, area);
  assert.equal(box.left, -400); assert.equal(box.top, 400);
  assert.deepEqual(box.clip, { left: 0, top: 400, right: 400, bottom: 600 });
  assert.equal(box.clipped, true);
  assert.equal(placementStyle(p).left, "0%");
  assert.equal(placementStyle(p).height, "200%");
  assert.equal(placementLayout(DEFAULT_PLACEMENT, { width: 100, height: 200 }, area).width, 300);
});

test("provider mapping requires explicit dimensions and identity, never scene pixels", () => {
  const source = { width: 100, height: 100 };
  assert.equal(productionPlacement(DEFAULT_PLACEMENT, source).ready, false);
  const mapped = productionPlacement({ ...DEFAULT_PLACEMENT, scale: 0.5, x: 0.25 }, source, { provider: "printify", printAreaId: "front", width: 4000, height: 5000 });
  assert.equal(mapped.ready, true);
  if (mapped.ready) { assert.equal(mapped.layout.width, 2000); assert.equal(mapped.layout.left, 0); assert.equal(mapped.layout.top, 1500); }
  assert.throws(() => placementSchema.parse({ ...DEFAULT_PLACEMENT, scale: Infinity }));
  assert.throws(() => placementLayout(DEFAULT_PLACEMENT, source, { width: 0, height: 10 }));
  assert.throws(() => placementSchema.parse({ ...DEFAULT_PLACEMENT, x: -1 }));
});

test("review roundtrip retains per-version per-garment placements and immutable originals", () => {
  const seed = JSON.parse(readFileSync("docs/design-factory/the-look.json", "utf8"));
  const manifest = prepareFactoryBatch(seed.brief, seed.styles);
  const before = JSON.stringify(manifest);
  const placement = { ...DEFAULT_PLACEMENT, scale: 0.75, y: 0.4 };
  const version = { id: "a", parentId: null, candidateId: manifest.candidates[0].id, prompt: "original prompt", rationale: "", preserved: [], feedback: "", decision: "keep", createdAt: "now", placements: { tshirt: placement } };
  const review = reviewFileSchema.parse(JSON.parse(JSON.stringify({ format: "factory-review-1", manifest, versions: [version, { ...version, id: "b", placements: undefined }] })));
  assert.deepEqual(review.versions[0].placements?.tshirt, placement);
  const copied = updateReviewPlacement(review.versions, "a", "tshirt", DEFAULT_PLACEMENT, true);
  assert.equal(copied[0], review.versions[0]);
  assert.deepEqual(copied[1].placements?.tshirt, DEFAULT_PLACEMENT);
  const again = updateReviewPlacement(copied, "a", "tshirt", placement, true);
  assert.equal(again[1], copied[1]);
  const changed = updateReviewPlacement(copied, "a", "tshirt", DEFAULT_PLACEMENT);
  assert.equal(changed[0].decision, "pending");
  assert.equal(changed[1], copied[1]);
  assert.equal(review.versions[1].placements, undefined);
  assert.equal(JSON.stringify(manifest), before);
  assert.equal(serializePlacement(placement), serializePlacement(JSON.parse(serializePlacement(placement))));
  assert.equal(reviewFileSchema.parse({ format: "factory-review-1", manifest, versions: [] }).versions.length, 0);
});
