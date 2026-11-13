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

import { printBoundary, mapPrintPoint, printAreaProfileSchema, printArtworkStyle, printCanvasLayout, productionCanvasPlan } from "../src/lib/design/placement";
const profile = printAreaProfileSchema.parse({ storeSlug: "shihtshirts", productType: "comfort-colors-front", provider: "operator-specified", printAreaId: "front", mockup: { width: 1000, height: 1000 }, canvas: { width: 4494, height: 5097 }, mapping: { x: 0.29, y: 0.24, width: 0.42, height: 0.50 } });
test("4494x5097 canvas contains tall artwork without clipping or stretching", () => {
  assert.ok(Math.abs(profile.canvas.width / profile.canvas.height - 0.8817) < 0.0001);
  for (const source of [{ width: 1000, height: 1400 }, { width: 1800, height: 700 }]) {
    const box = printCanvasLayout(DEFAULT_PLACEMENT, source, profile);
    assert.equal(box.clipped, false);
    assert.ok(Math.abs(box.width / box.height - source.width / source.height) < 1e-10);
    assert.ok(box.top + box.height <= 5097);
    assert.equal(productionCanvasPlan(DEFAULT_PLACEMENT, source, profile).background.alpha, 0);
  }
  const upper = printCanvasLayout({ ...DEFAULT_PLACEMENT, scale: 0.5, y: 0.25 }, { width: 1000, height: 1000 }, profile);
  assert.equal(upper.clipped, false); assert.ok(upper.top + upper.height < 5097 * 0.5);
  assert.equal(productionCanvasPlan({ ...DEFAULT_PLACEMENT, scale: 2 }, { width: 1000, height: 1400 }, profile).layout.normalized.scale, 1);
});
test("mapping is reversible, color independent and roundtrips with review export", () => {
  for (const point of [{ x: 0, y: 0 }, { x: 4494, y: 5097 }, { x: 1234, y: 3500 }]) {
    const back = mapPrintPoint(mapPrintPoint(point, profile), profile, true);
    assert.ok(Math.abs(back.x - point.x) < 1e-9); assert.ok(Math.abs(back.y - point.y) < 1e-9);
  }
  const source = { width: 1000, height: 1500 };
  const styles = ["black", "white", "pepper"].map(() => printArtworkStyle(DEFAULT_PLACEMENT, source, profile));
  assert.deepEqual(styles[0], styles[1]); assert.deepEqual(styles[1], styles[2]);
  const seed = JSON.parse(readFileSync("docs/design-factory/the-look.json", "utf8"));
  const saved = reviewFileSchema.parse(JSON.parse(JSON.stringify({ format: "factory-review-1", manifest: prepareFactoryBatch(seed.brief, seed.styles), versions: [], printAreas: [profile] })));
  assert.deepEqual(saved.printAreas, [profile]);
  assert.throws(() => printAreaProfileSchema.parse({ ...profile, mapping: { ...profile.mapping, y: 0.9 } }));
});

test("calibrated photo boundary is independent and preview matches padded canvas plan", () => {
  const boundary = printBoundary(profile);
  assert.deepEqual(boundary, profile.mapping);
  assert.equal(profile.canvas.width / profile.canvas.height, 4494 / 5097);
  assert.equal(boundary.y, profile.mapping.y);
  const source = { width: 1200, height: 1700 }, p = { ...DEFAULT_PLACEMENT, scale: 0.6, y: 0.35 };
  const plan = productionCanvasPlan(p, source, profile);
  const css = printArtworkStyle(p, source, profile);
  assert.ok(Math.abs(parseFloat(css.left) / 100 * 4494 - plan.layout.left) < 1e-9);
  assert.ok(Math.abs(parseFloat(css.height) / 100 * 5097 - plan.layout.height) < 1e-9);
  assert.equal(plan.ready, false);
});

import { alphaBounds, constrainedPlacement } from "../src/lib/design/placement";
import { constrainReviewPlacements } from "../src/lib/design/factory-review";
test("all slider extremes constrain bottom, top, left and right at every scale", () => {
  for (const source of [{ width: 1000, height: 1400 }, { width: 1800, height: 700 }, { width: 1000, height: 1000, bounds: { left: 100, top: 0, width: 300, height: 800 } }]) {
    for (const scale of [0.1, 0.5, 1, 1.5, 2]) for (const x of [0, 0.25, 0.5, 1]) for (const y of [0, 0.25, 0.5, 1]) {
      const p = { ...DEFAULT_PLACEMENT, scale, x, y };
      const box = printCanvasLayout(p, source, profile);
      assert.ok(box.clip.left >= -1e-9); assert.ok(box.clip.top >= -1e-9);
      assert.ok(box.clip.right <= 4494 + 1e-9); assert.ok(box.clip.bottom <= 5097 + 1e-9);
      for (const key of ["scale", "x", "y"] as const) {
        assert.ok(box.normalized[key] >= box.limits[key].min - 1e-12);
        assert.ok(box.normalized[key] <= box.limits[key].max + 1e-12);
      }
      assert.deepEqual(constrainedPlacement(box.normalized, source, profile.canvas).normalized, box.normalized);
      const css = printArtworkStyle(p, source, profile), plan = productionCanvasPlan(p, source, profile);
      assert.ok(Math.abs(parseFloat(css.top) / 100 * 5097 - plan.layout.top) < 1e-8);
    }
  }
});
test("alpha measurement includes faint pixels and asymmetric padding, rejects blank artwork", () => {
  const pixels = new Uint8Array(10 * 10 * 4);
  pixels[(2 * 10 + 1) * 4 + 3] = 1;
  pixels[(8 * 10 + 6) * 4 + 3] = 255;
  const bounds = alphaBounds(pixels, 10, 10);
  assert.deepEqual(bounds, { left: 1, top: 2, width: 6, height: 7 });
  const source = { width: 10, height: 10, bounds };
  const box = constrainedPlacement({ ...DEFAULT_PLACEMENT, scale: 2, y: 1 }, source, { width: 100, height: 100 });
  assert.equal(box.normalized.scale, 10 / 7);
  assert.ok(Math.abs(box.clip.bottom - 100) < 1e-9);
  assert.ok(box.top < 0); // PNG padding can extend beyond the boundary; ink cannot.
  assert.throws(() => alphaBounds(new Uint8Array(400), 10, 10), /transparent/);
  assert.throws(() => alphaBounds([], 10, 10), /RGBA/);
  assert.throws(() => constrainedPlacement(DEFAULT_PLACEMENT, { ...source, bounds: { ...bounds, width: 20 } }, profile.canvas), /bounds/);
});
test("clamped per-version placements survive export/import and are independent of garment color", () => {
  const seed = JSON.parse(readFileSync("docs/design-factory/the-look.json", "utf8"));
  const manifest = prepareFactoryBatch(seed.brief, seed.styles);
  const version = { id: "a", parentId: null, candidateId: manifest.candidates[0].id, prompt: "original prompt", rationale: "", preserved: [], feedback: "", decision: "keep" as const, createdAt: "now", placements: { tshirt: { ...DEFAULT_PLACEMENT, scale: 2, y: 1 } } };
  const source = { width: 1000, height: 1400, bounds: { left: 200, top: 50, width: 600, height: 1300 } };
  const original = [version, { ...version, id: "b", placements: { tshirt: { ...DEFAULT_PLACEMENT, scale: 0.3 } } }];
  const results = ["ivory", "pepper", "black"].map(() => constrainReviewPlacements(original, () => ({ source, canvas: profile.canvas })));
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
  assert.equal(results[0][0].decision, "pending"); assert.equal(results[0][1], original[1]);
  const saved = reviewFileSchema.parse(JSON.parse(JSON.stringify({ format: "factory-review-1", manifest, versions: results[0], printAreas: [profile] })));
  assert.deepEqual(saved.versions, results[0]);
  assert.equal(constrainReviewPlacements(saved.versions, () => ({ source, canvas: profile.canvas })), saved.versions);
  assert.equal(original[0].placements.tshirt.y, 1);
});

import { resizeBoundary, mergeCalibration } from "../src/lib/design/placement";
import { sharedReviewCalibrations } from "../src/lib/design/placement";

test("review colors share the first color boundary and canvas, retaining photo evidence", () => {
  const first = { ...profile, baseImageUrl: "/api/assets/first" };
  const second = { ...profile, baseImageUrl: "/api/assets/second", mockup: { width: 800, height: 900 }, canvas: { width: 1000, height: 1000 }, mapping: { x: .1, y: .1, width: .2, height: .2 } };
  const foreign = { ...second, storeSlug: "other-store" };
  const before = JSON.stringify([second, foreign, first]);
  const bases = { Ivory: first.baseImageUrl, Black: second.baseImageUrl, Missing: "/api/assets/missing" };
  const result = sharedReviewCalibrations(profile.storeSlug, [second, foreign, first], profile.productType, profile.provider, bases);
  assert.equal(result.shared, first);
  assert.deepEqual(result.profiles[0].mapping, first.mapping);
  assert.deepEqual(result.profiles[0].canvas, first.canvas);
  assert.deepEqual(result.profiles[0].mockup, second.mockup);
  assert.equal(result.profiles[0].baseImageUrl, second.baseImageUrl);
  assert.equal(result.profiles[1], foreign);
  assert.equal(result.profiles.length, 3);
  assert.equal(JSON.stringify([second, foreign, first]), before);
  assert.equal(sharedReviewCalibrations(profile.storeSlug, [second], profile.productType, profile.provider, bases).shared, second);
});
test("edge and corner drag limits stay on photograph without changing canvas or artwork", () => {
  const snapshot = JSON.stringify(profile), placement = { ...DEFAULT_PLACEMENT, scale: .4 };
  const before = printCanvasLayout(placement, { width: 100, height: 200 }, profile);
  for (const handle of ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const) {
    for (const dx of [-10, 0, 10]) for (const dy of [-10, 0, 10]) {
      const mapping = resizeBoundary(profile.mapping, handle, dx, dy);
      assert.ok(mapping.x >= 0 && mapping.y >= 0);
      assert.ok(mapping.width >= .02 - 1e-12 && mapping.height >= .02 - 1e-12);
      assert.ok(mapping.x + mapping.width <= 1 && mapping.y + mapping.height <= 1);
      const next = { ...profile, mapping };
      assert.deepEqual(printCanvasLayout(placement, { width: 100, height: 200 }, next), before);
      const point = { x: 1200, y: 3000 };
      const roundtrip = mapPrintPoint(mapPrintPoint(point, next), next, true);
      assert.ok(Math.abs(roundtrip.x - point.x) < 1e-8 && Math.abs(roundtrip.y - point.y) < 1e-8);
    }
  }
  assert.equal(JSON.stringify(profile), snapshot);
});
test("calibrations persist as JSON and isolate tenant, photograph, garment and side", () => {
  const a = { ...profile, baseImageUrl: "/a.png" };
  const b = { ...profile, baseImageUrl: "/b.png" };
  let saved = mergeCalibration(profile.storeSlug, [a], b);
  saved = mergeCalibration(profile.storeSlug, saved, { ...a, mapping: { ...a.mapping, height: .6 } });
  assert.equal(saved.length, 2);
  assert.equal(saved.find(p => p.baseImageUrl === a.baseImageUrl)?.mapping.height, .6);
  saved = mergeCalibration(profile.storeSlug, saved, { ...a, printAreaId: "back" });
  saved = mergeCalibration(profile.storeSlug, saved, { ...a, productType: "other" });
  assert.equal(saved.length, 4);
  assert.deepEqual(printAreaProfileSchema.array().parse(JSON.parse(JSON.stringify(saved))), saved);
  assert.throws(() => mergeCalibration("foreign", saved, a), /tenant/);
});
