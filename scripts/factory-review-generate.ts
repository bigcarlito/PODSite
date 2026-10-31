import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, relative, isAbsolute, join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { reviewFileSchema } from "../src/lib/design/factory-review";
import { generateFactoryBatch } from "../src/lib/design/factory";

async function main() {
  const [file, versionId, output, model, consent] = process.argv.slice(2);
  if (!file || !versionId || !output || !model || consent !== "--approve-paid-generation") throw new Error("Usage: factory-review-generate.ts REVIEW_JSON VERSION_ID NEW_OUTPUT_DIR MODEL --approve-paid-generation");
  const dir = resolve(output), rel = relative(resolve(".local/design-factory"), dir);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Use a new subdirectory under .local/design-factory");
  const review = reviewFileSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const version = review.versions.find(v => v.id === versionId);
  if (!version || version.image || !version.parentId) throw new Error("Select an ungenerated child version");
  const original = review.manifest.candidates.find(c => c.id === version.candidateId);
  if (!original) throw new Error("Missing original candidate");
  // Exclusive directory + attempt checkpoint prohibit accidental retry/spend on resume.
  await mkdir(dir, { recursive: false });
  await writeFile(join(dir, "source-review.json"), JSON.stringify(review, null, 2), { flag: "wx" });
  const { getImageProvider } = await import("../src/lib/design/providers/registry");
  const manifest = { ...review.manifest, candidates: [{ ...original, id: version.id, prompt: version.prompt, preview: undefined, error: undefined, review: { status: "pending" as const }, provenance: { method: "planned" as const } }] };
  const result = await generateFactoryBatch(manifest, getImageProvider("openrouter"), model, async (id, url) => {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(url);
    if (!match) throw new Error("Expected inline PNG");
    const bytes = Buffer.from(match[1], "base64");
    const meta = await sharp(bytes).metadata();
    const name = `${createHash("sha256").update(id).digest("hex")}.png`;
    await writeFile(join(dir, name), bytes, { flag: "wx" });
    version.image = url;
    return { file: name, sha256: createHash("sha256").update(bytes).digest("hex"), width: meta.width!, height: meta.height! };
  }, async state => { await writeFile(join(dir, "attempt.json"), JSON.stringify(state, null, 2)); });
  version.provenance = result.candidates[0].provenance;
  await writeFile(join(dir, "review.json"), JSON.stringify(review, null, 2), { flag: "wx" });
  if (result.candidates[0].error) throw new Error(result.candidates[0].error);
  console.log(join(dir, "review.json"));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
