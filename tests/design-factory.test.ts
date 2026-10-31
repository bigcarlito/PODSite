import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { prepareFactoryBatch, factoryManifestSchema, generateFactoryBatch } from "../src/lib/design/factory";
import type { ImageProvider } from "../src/lib/design/providers/types";

const seed = JSON.parse(readFileSync("docs/design-factory/the-look.json", "utf8"));
const prepare = () => prepareFactoryBatch(seed.brief, seed.styles);
test("The Look seed preserves source hash and generates five distinct pending prompts", () => {
  const manifest = prepare();
  assert.equal(createHash("sha256").update(readFileSync(manifest.brief.originalArt.path)).digest("hex"), manifest.brief.originalArt.sha256);
  assert.equal(manifest.candidates.length, 5);
  assert.equal(new Set(manifest.candidates.map(c => c.prompt)).size, 5);
  for (const candidate of manifest.candidates) {
    assert.equal(candidate.review.status, "pending");
    assert.equal(candidate.productionReadiness, "preview-only");
    assert.match(candidate.prompt, /THE LOOK/);
    assert.equal(candidate.preview, undefined);
  }
});
test("batch limits, duplicate profiles and print-ready claims are rejected", () => {
  assert.throws(() => prepareFactoryBatch(seed.brief, []));
  assert.throws(() => prepareFactoryBatch(seed.brief, [...seed.styles, seed.styles[0]]));
  assert.throws(() => prepareFactoryBatch(seed.brief, [seed.styles[0], seed.styles[0]]));
  const manifest = prepare();
  assert.throws(() => factoryManifestSchema.parse({ ...manifest, candidates: [{ ...manifest.candidates[0], productionReadiness: "print-ready" }] }));
  assert.throws(() => factoryManifestSchema.parse({ ...manifest, candidates: [{ ...manifest.candidates[0], review: { status: "selected" } }] }));
});
test("partial failures persist, no automatic selection, no repeated spend on resume", async () => {
  let calls = 0;
  let checkpoints = 0;
  const provider: ImageProvider = { name: "test", async generate(spec) {
    assert.match(spec.promptText, /original apparel/);
    if (++calls === 2) throw new Error("provider unavailable");
    return { imageUrl: "inline-test", width: 20, height: 30, seed: 42, rawParams: { prompt: spec.promptText } };
  } };
  const save = async () => ({ file: "preview.png", sha256: "a".repeat(64), width: 20, height: 30 });
  const checkpoint = async () => { checkpoints++; };
  const result = await generateFactoryBatch(prepare(), provider, "test-model", save, checkpoint);
  assert.equal(calls, 5);
  assert.equal(checkpoints, 10);
  assert.equal(result.candidates[1].error, "provider unavailable");
  assert.equal(result.candidates[0].provenance.seed, 42);
  assert.ok(result.candidates.every(c => c.review.status === "pending" && c.productionReadiness === "preview-only"));
  await generateFactoryBatch(result, provider, "test-model", save, checkpoint);
  assert.equal(calls, 5);
});
