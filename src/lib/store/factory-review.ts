import "server-only";
import type { Store } from "@prisma/client";
import { factoryGenerationSchema, refineSchema, revisionInstruction, revisionSchema } from "@/lib/design/factory-review";
import { DEFAULT_DESIGN_MODEL, DEFAULT_TEXT_MODEL, generateTextWithOpenRouter } from "@/lib/ai/openrouter";
import { getImageProvider } from "@/lib/design/providers/registry";
import { createHash } from "node:crypto";
import { z } from "zod";
import { StoreError } from "./errors";
import { logActivity, type ActivityActor } from "./activity";

export async function refineFactoryPrompt(store: Store, raw: unknown, actor: ActivityActor) {
  const input = refineSchema.parse(raw);
  if (input.manifest.brief.storeSlug !== store.slug) throw new StoreError("STORE_MISMATCH", "Manifest belongs to another store", { status: 403 });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new StoreError("MISSING_PROVIDER_CREDENTIALS", "Text provider is not configured", { status: 422 });
  const text = await generateTextWithOpenRouter({ apiKey, model: DEFAULT_TEXT_MODEL, prompt: revisionInstruction(input) });
  const revision = revisionSchema.parse(JSON.parse(text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")));
  await logActivity(store.id, { actor, category: "factory-review", summary: "Prepared a human-requested prompt revision", details: { candidateId: input.candidateId, feedback: input.feedback, revision, model: DEFAULT_TEXT_MODEL } });
  return revision;
}

const generationResultSchema = z.object({ image: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/), provenance: z.object({ provider: z.string(), model: z.string(), sha256: z.string(), seed: z.number().optional(), rawParams: z.record(z.unknown()) }) });
export async function generateFactoryRevision(store: Store, raw: unknown, actor: ActivityActor) {
  const { manifest, version } = factoryGenerationSchema.parse(raw);
  if (manifest.brief.storeSlug !== store.slug) throw new StoreError("STORE_MISMATCH", "Manifest belongs to another store", { status: 403 });
  if (process.env.FACTORY_IMAGE_GENERATION_ENABLED !== "true") throw new StoreError("GENERATION_DISABLED", "Factory image generation requires the server operator to enable FACTORY_IMAGE_GENERATION_ENABLED", { status: 403 });
  if (!version.parentId || version.image || !manifest.candidates.some(c => c.id === version.candidateId)) throw new StoreError("INVALID_VERSION", "Select an ungenerated child revision", { status: 422 });
  // Unique activity ID reserves the attempt before any paid call, including concurrent requests.
  const attemptId = `factory-attempt-${store.id}-${createHash("sha256").update(version.id).digest("hex")}`;
  try {
    await logActivity(store.id, { id: attemptId, actor, category: "factory-generation-attempt", summary: "Reserved one explicitly approved image generation", details: { versionId: version.id, parentId: version.parentId, prompt: version.prompt, model: DEFAULT_DESIGN_MODEL } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new StoreError("ATTEMPT_EXISTS", "This version already has a generation attempt; no automatic retry is permitted", { status: 409 });
    throw error;
  }
  const provider = getImageProvider("openrouter");
  try {
    const result = await provider.generate({ promptText: version.prompt, colorRoles: [], exclusions: ["watermark", "garment mockup"], aspectRatioBucket: "portrait_4_5" }, { model: DEFAULT_DESIGN_MODEL });
    const data = generationResultSchema.parse({ image: result.imageUrl, provenance: { provider: provider.name, model: DEFAULT_DESIGN_MODEL, seed: result.seed, rawParams: result.rawParams, sha256: createHash("sha256").update(Buffer.from(result.imageUrl.split(",")[1] ?? "", "base64")).digest("hex") } });
    await logActivity(store.id, { actor, category: "factory-review", summary: "Generated one human-requested preview revision", details: { versionId: version.id, provenance: data.provenance } });
    return data;
  } catch {
    throw new StoreError("GENERATION_FAILED", "Attempt failed or was interrupted. Credits may have been spent. This version cannot be retried automatically.", { status: 502 });
  }
}
