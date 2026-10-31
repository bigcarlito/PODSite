import { z } from "zod";
import type { ImageProvider } from "./providers/types";

const text = z.string().trim().min(1).max(2000);
export const designBriefSchema = z.object({
  id: text, storeSlug: text, concept: text, audience: text, subject: text,
  lettering: text,
  originalArt: z.object({ path: text, sha256: z.string().regex(/^[a-f0-9]{64}$/), provenance: text }),
}).strict();
export const styleProfileSchema = z.object({ id: text, name: text, direction: text }).strict();
export type DesignBrief = z.infer<typeof designBriefSchema>;
export type StyleProfile = z.infer<typeof styleProfileSchema>;
export const factoryManifestSchema = z.object({
  version: z.literal(1), brief: designBriefSchema,
  candidates: z.array(z.object({
    id: text, style: styleProfileSchema, prompt: text,
    review: z.object({ status: z.enum(["pending", "selected", "rejected"]), reviewer: text.optional(), notes: text.optional() }).refine(
      review => review.status === "pending" || Boolean(review.reviewer && review.notes),
      "A human review decision requires reviewer and notes",
    ),
    productionReadiness: z.literal("preview-only"),
    preview: z.object({ file: text, sha256: z.string().regex(/^[a-f0-9]{64}$/), width: z.number().int().positive(), height: z.number().int().positive() }).optional(),
    provenance: z.object({ method: z.enum(["planned", "generated", "manual"]), provider: text.optional(), model: text.optional(), seed: z.number().optional(), rawParams: z.record(z.unknown()).optional() }),
    error: text.optional(),
  }).strict()).min(1).max(5),
}).strict();
export type FactoryManifest = z.infer<typeof factoryManifestSchema>;

export function prepareFactoryBatch(briefInput: unknown, stylesInput: unknown): FactoryManifest {
  const brief = designBriefSchema.parse(briefInput);
  const styles = styleProfileSchema.array().min(1).max(5).parse(stylesInput);
  if (new Set(styles.map(s => s.id)).size !== styles.length) throw new Error("Style IDs must be unique");
  return factoryManifestSchema.parse({ version: 1, brief, candidates: styles.map(style => ({
    id: `${brief.id}-${style.id}`, style,
    prompt: `Create an original apparel graphic for ${brief.audience}. Concept: ${brief.concept}. Subject: ${brief.subject}. Exact lettering: ${brief.lettering}. Style: ${style.direction}. Transparent background, centered 4:5 composition, no garment or mockup. Do not copy competitor artwork, trademarks, or signatures. This is a new exploration, not a replacement for the preserved original artwork.`,
    review: { status: "pending" }, productionReadiness: "preview-only", provenance: { method: "planned" },
  })) });
}

/** One attempt per planned candidate, no QC retries, upscale, or publishing. Save after each attempt. */
export async function generateFactoryBatch(
  input: unknown, provider: ImageProvider, model: string,
  savePreview: (id: string, imageUrl: string) => Promise<NonNullable<FactoryManifest["candidates"][number]["preview"]>>,
  checkpoint: (manifest: FactoryManifest) => Promise<void>,
): Promise<FactoryManifest> {
  const manifest = factoryManifestSchema.parse(input);
  for (const candidate of manifest.candidates) {
    if (candidate.provenance.method !== "planned") continue;
    candidate.provenance = { method: "generated", provider: provider.name, model };
    // Checkpoint the attempt first: interrupted runs must not silently spend again.
    await checkpoint(manifest);
    try {
      const image = await provider.generate({ promptText: candidate.prompt, colorRoles: [], exclusions: ["competitor artwork", "watermark", "garment mockup"], aspectRatioBucket: "portrait_4_5" }, { model });
      candidate.provenance.seed = image.seed;
      candidate.provenance.rawParams = image.rawParams;
      candidate.preview = await savePreview(candidate.id, image.imageUrl);
    } catch (error) {
      candidate.error = (error instanceof Error ? error.message : String(error)).slice(0, 2000) || "Generation failed";
    }
    await checkpoint(manifest);
  }
  return factoryManifestSchema.parse(manifest);
}
