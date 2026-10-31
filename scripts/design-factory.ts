import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { factoryManifestSchema, prepareFactoryBatch, generateFactoryBatch } from "../src/lib/design/factory";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
// All disposable outputs are checkout-local. No database or storefront writes.
function outputDirectory(input: string) {
  const root = resolve(".local/design-factory");
  const dir = resolve(input);
  const rel = relative(root, dir);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Output must be under .local/design-factory");
  return dir;
}
async function main() {
  const [command, directory, model] = process.argv.slice(2);
  if (!directory || !["prepare", "generate"].includes(command)) throw new Error("Usage: design-factory.ts prepare|generate .local/design-factory/RUN [model]");
  const dir = outputDirectory(directory);
  const manifestPath = join(dir, "manifest.json");
  if (command === "prepare") {
    const seed = JSON.parse(await readFile("docs/design-factory/the-look.json", "utf8"));
    const manifest = prepareFactoryBatch(seed.brief, seed.styles);
    if (hash(await readFile(manifest.brief.originalArt.path)) !== manifest.brief.originalArt.sha256) throw new Error("Original artwork hash mismatch");
    await mkdir(dir, { recursive: true });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { flag: "wx" });
  } else {
    if (!model) throw new Error("Explicit model required; generation spends provider credits");
    const manifest = factoryManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
    const { getImageProvider } = await import("../src/lib/design/providers/registry");
    const result = await generateFactoryBatch(manifest, getImageProvider("openrouter"), model, async (id, url) => {
      // Existing adapter returns inline PNGs; do not fetch arbitrary remote URLs.
      const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(url);
      if (!match) throw new Error("Expected inline PNG from existing adapter");
      const bytes = Buffer.from(match[1], "base64");
      const metadata = await sharp(bytes).metadata();
      const file = `${createHash("sha256").update(id).digest("hex")}-preview.png`;
      await writeFile(join(dir, file), bytes, { flag: "wx" });
      return { file, sha256: hash(bytes), width: metadata.width!, height: metadata.height! };
    }, async state => {
      await writeFile(`${manifestPath}.tmp`, JSON.stringify(state, null, 2));
      await rename(`${manifestPath}.tmp`, manifestPath);
    });
    if (result.candidates.some(c => c.error || !c.preview)) process.exitCode = 1;
  }
  console.log(manifestPath);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
