import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, Store } from "@prisma/client";
import { StoreError, notFound } from "@/lib/store/errors";
import { logActivity, type ActivityActor } from "@/lib/store/activity";
import { uploadStoreAsset } from "@/lib/store/assets";
import type { DesignCreateInput, DesignPublishInput, DesignRegenerateInput } from "@/lib/store/schemas";
import { generateProductFromDesign } from "@/lib/store/ai-product-create";
import { ASPECTS_VERSION, aspectsSchema, type DesignAspects } from "./aspects";
import { compileDesignPrompt, type CompiledDesignPrompt } from "./prompt";
import { getImageProvider } from "./providers/registry";
import type { ImageProvider } from "./providers/types";
import { runQcGate, type QcResult } from "./qc";
import { upscaleToMasterCanvas } from "./upscale";
import { deriveProviderFile, getPrintTemplate } from "./print-templates";

/** Reject-and-regenerate this many times before giving up and persisting a
 * "rejected" design — bounds the cost of a genuinely bad aspect combination
 * (see AGENTS.md's design-system notes on the QC gate). */
const MAX_GENERATION_ATTEMPTS = 2;

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "design"
  );
}

function openRouterApiKeyOrThrow(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new StoreError(
      "MISSING_PROVIDER_CREDENTIALS",
      "OPENROUTER_API_KEY is not configured.",
      { status: 422 }
    );
  }
  return apiKey;
}

/** A relative StoreAsset URL stays relative; an already-absolute URL from a
 * future provider that hosts images itself is used as-is (same reasoning
 * as generateAIProductMockups — see AGENTS.md's design-system notes). */
function toAbsolute(url: string, origin: string): string {
  return /^https?:\/\//.test(url) ? url : `${origin}${url}`;
}

/**
 * Finds a free slug for a new design. An explicit slug (the caller passed
 * one) collides as a hard error — the caller asked for that exact slug.
 * An auto-derived slug (from `phrase`/`subject`) instead appends a
 * numeric suffix and retries, same pattern as generateProductFromDesign's
 * retry-on-collision loop — otherwise every retry of a rejected design's
 * phrase (the normal QC-iteration workflow) would collide with the
 * design that got rejected, since a rejected design still keeps its slug.
 */
async function resolveDesignSlug(storeId: string, baseSlug: string, explicit: boolean): Promise<string> {
  let candidate = baseSlug;
  for (let attempt = 1; attempt <= 50; attempt++) {
    const existing = await prisma.design.findUnique({
      where: { storeId_slug: { storeId, slug: candidate } },
    });
    if (!existing) return candidate;
    if (explicit) {
      throw new StoreError("SLUG_TAKEN", `A design with slug "${baseSlug}" already exists`, {
        field: "slug",
        status: 409,
      });
    }
    candidate = `${baseSlug}-${attempt + 1}`;
  }
  throw new StoreError("SLUG_TAKEN", `Could not find an available slug based on "${baseSlug}"`, {
    field: "slug",
    status: 409,
  });
}

export async function getDesign(storeId: string, id: string) {
  const design = await prisma.design.findFirst({ where: { id, storeId } });
  if (!design) throw notFound(`Design "${id}"`);
  return design;
}

export function listDesigns(storeId: string, opts?: { status?: string; take?: number }) {
  return prisma.design.findMany({
    where: { storeId, ...(opts?.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 50,
  });
}

type GenerationOutcome = {
  status: "generated" | "rejected";
  previewImageUrl: string;
  masterImageUrl: string | null;
  masterWidthPx: number | null;
  masterHeightPx: number | null;
  seed: number | null;
  model: string;
  attempts: number;
  qc: QcResult;
};

/**
 * Generates via the chosen provider, running the QC gate against each
 * attempt's native-resolution preview before spending an upscale on it —
 * the step that saves the most money (see AGENTS.md's design-system
 * notes). On the first QC pass, upscales to the print-ready master canvas
 * and returns status "generated"; if every attempt fails QC, returns
 * status "rejected" with the last attempt's preview and QC detail, rather
 * than throwing — a rejected design is still useful evidence of which
 * aspect combinations are expensive to produce.
 */
async function generateWithQc(
  store: Store,
  aspects: DesignAspects,
  compiled: CompiledDesignPrompt,
  provider: ImageProvider,
  opts: { model?: string; negativePrompt?: string },
  actor: ActivityActor,
  origin: string
): Promise<GenerationOutcome> {
  const openRouterApiKey = openRouterApiKeyOrThrow();

  let lastPreviewUrl = "";
  let lastSeed: number | undefined;
  let lastModel = opts.model ?? "";
  let lastQc: QcResult | undefined;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    let generated;
    try {
      generated = await provider.generate(compiled, {
        model: opts.model,
        negativePrompt: opts.negativePrompt,
      });
    } catch (cause) {
      throw new StoreError(
        "AI_PROVIDER_ERROR",
        `Design generation failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        { status: 502 }
      );
    }

    let previewUrl = generated.imageUrl;
    const dataUrlMatch = /^data:([^;]+);base64,([\s\S]+)$/.exec(generated.imageUrl);
    if (dataUrlMatch) {
      const asset = await uploadStoreAsset(
        store.id,
        { kind: "design-preview", data: Buffer.from(dataUrlMatch[2], "base64"), mimeType: dataUrlMatch[1] },
        actor
      );
      previewUrl = asset.url;
    }

    lastPreviewUrl = previewUrl;
    lastSeed = generated.seed;
    lastModel = opts.model || String(generated.rawParams.model ?? "");

    const qc = await runQcGate(toAbsolute(previewUrl, origin), aspects, { apiKey: openRouterApiKey });
    lastQc = qc;

    await logActivity(store.id, {
      actor,
      category: "design",
      summary: qc.pass
        ? `QC passed on attempt ${attempt}`
        : `QC rejected attempt ${attempt}: ${Object.values(qc.checks)
            .filter((c) => !c.pass)
            .map((c) => c.detail)
            .join("; ")}`,
      details: { checks: qc.checks },
    });

    if (qc.pass) {
      const upscaled = await upscaleToMasterCanvas(toAbsolute(previewUrl, origin));
      const masterAsset = await uploadStoreAsset(
        store.id,
        { kind: "design-master", data: upscaled.data, mimeType: upscaled.mimeType },
        actor
      );
      return {
        status: "generated",
        previewImageUrl: previewUrl,
        masterImageUrl: masterAsset.url,
        masterWidthPx: upscaled.width,
        masterHeightPx: upscaled.height,
        seed: lastSeed ?? null,
        model: lastModel,
        attempts: attempt,
        qc,
      };
    }
  }

  return {
    status: "rejected",
    previewImageUrl: lastPreviewUrl,
    masterImageUrl: null,
    masterWidthPx: null,
    masterHeightPx: null,
    seed: lastSeed ?? null,
    model: lastModel,
    attempts: MAX_GENERATION_ATTEMPTS,
    qc: lastQc!,
  };
}

/**
 * Validates aspects → compiles the prompt → generates via the chosen
 * ImageProvider, running the QC gate and (on pass) the upscale to the
 * print-ready master canvas — see AGENTS.md's design-system notes for the
 * full pipeline. `origin` must be this request's own absolute origin: the
 * preview/master URLs are stored relative (same reasoning as every other
 * StoreAsset reference), but QC and upscale both need an absolute URL to
 * fetch them from outside a browser context.
 */
export async function createDesign(
  store: Store,
  input: DesignCreateInput,
  actor: ActivityActor,
  origin: string
) {
  const aspects = aspectsSchema.parse(input.aspects);

  const baseSlug = input.slug ? slugify(input.slug) : slugify(aspects.phrase || aspects.subject || "design");
  const slug = await resolveDesignSlug(store.id, baseSlug, Boolean(input.slug));

  const compiled = compileDesignPrompt(aspects);
  const provider = getImageProvider(input.provider);
  const outcome = await generateWithQc(
    store,
    aspects,
    compiled,
    provider,
    { model: input.model, negativePrompt: input.negativePrompt },
    actor,
    origin
  );

  const design = await prisma.design.create({
    data: {
      storeId: store.id,
      slug,
      aspects: aspects as unknown as Prisma.InputJsonValue,
      aspectsVersion: ASPECTS_VERSION,
      prompt: compiled.promptText,
      negativePrompt: input.negativePrompt,
      provider: input.provider,
      model: outcome.model,
      seed: outcome.seed,
      params: {
        aspectRatioBucket: compiled.aspectRatioBucket,
        colorRoles: compiled.colorRoles,
        exclusions: compiled.exclusions,
        qc: outcome.qc.checks,
        attempts: outcome.attempts,
      } as unknown as Prisma.InputJsonValue,
      previewImageUrl: outcome.previewImageUrl,
      masterImageUrl: outcome.masterImageUrl,
      masterWidthPx: outcome.masterWidthPx,
      masterHeightPx: outcome.masterHeightPx,
      status: outcome.status,
    },
  });

  await logActivity(store.id, {
    actor,
    category: "design",
    summary: `${outcome.status === "generated" ? "Generated" : "Rejected"} design "${slug}"`,
    details: { designId: design.id, aspects, provider: input.provider, attempts: outcome.attempts },
  });

  return design;
}

/**
 * Re-runs generation for an existing design's aspects — a new seed/attempt,
 * same aspects, same provider/model unless overridden. Replaces the
 * design's prompt/preview/master/status in place rather than creating a
 * new row, since it's the same design being re-tried, not a new one.
 */
export async function regenerateDesign(
  store: Store,
  id: string,
  input: DesignRegenerateInput,
  actor: ActivityActor,
  origin: string
) {
  const existing = await getDesign(store.id, id);
  const aspects = aspectsSchema.parse(existing.aspects);
  const compiled = compileDesignPrompt(aspects);
  const providerName = input.provider || existing.provider;
  const provider = getImageProvider(providerName);

  const outcome = await generateWithQc(
    store,
    aspects,
    compiled,
    provider,
    { model: input.model, negativePrompt: input.negativePrompt ?? existing.negativePrompt ?? undefined },
    actor,
    origin
  );

  const design = await prisma.design.update({
    where: { id: existing.id },
    data: {
      prompt: compiled.promptText,
      negativePrompt: input.negativePrompt ?? existing.negativePrompt,
      provider: providerName,
      model: outcome.model,
      seed: outcome.seed,
      params: {
        aspectRatioBucket: compiled.aspectRatioBucket,
        colorRoles: compiled.colorRoles,
        exclusions: compiled.exclusions,
        qc: outcome.qc.checks,
        attempts: outcome.attempts,
      } as unknown as Prisma.InputJsonValue,
      previewImageUrl: outcome.previewImageUrl,
      masterImageUrl: outcome.masterImageUrl,
      masterWidthPx: outcome.masterWidthPx,
      masterHeightPx: outcome.masterHeightPx,
      status: outcome.status,
    },
  });

  await logActivity(store.id, {
    actor,
    category: "design",
    summary: `${outcome.status === "generated" ? "Regenerated" : "Re-rejected"} design "${existing.slug}"`,
    details: { designId: design.id, provider: providerName, attempts: outcome.attempts },
  });

  return design;
}

/**
 * Turns a QC-passed design into one or more real products, one per garment
 * type — wraps the existing generateProductFromDesign flow (same "upload a
 * design, get a finished product" pipeline any store already uses), except
 * the design's own masterImageUrl (cropped/resized to each provider's
 * PrintTemplate, never regenerated) is the source image instead of an
 * externally-hosted URL. See AGENTS.md's design-system notes.
 */
export async function publishDesign(
  store: Store,
  id: string,
  input: DesignPublishInput,
  actor: ActivityActor,
  origin: string
) {
  const design = await getDesign(store.id, id);

  if (design.status === "published") {
    throw new StoreError("ALREADY_PUBLISHED", "This design has already been published.", {
      status: 409,
    });
  }
  if (design.status !== "generated" || !design.masterImageUrl || !design.previewImageUrl) {
    throw new StoreError(
      "DESIGN_NOT_READY",
      `Design status is "${design.status}" — only a "generated" (QC-passed, upscaled) design can be published.`,
      { status: 409 }
    );
  }

  const masterAbsolute = toAbsolute(design.masterImageUrl, origin);
  const previewAbsolute = toAbsolute(design.previewImageUrl, origin);
  const products: Array<{
    productType: string;
    product: Awaited<ReturnType<typeof generateProductFromDesign>>["product"];
    rendered: Awaited<ReturnType<typeof generateProductFromDesign>>["rendered"];
    failed: Awaited<ReturnType<typeof generateProductFromDesign>>["failed"];
  }> = [];

  for (const entry of input.productTypes) {
    const template = await getPrintTemplate(store.id, entry.provider, entry.productType);

    let fileUrl = masterAbsolute;
    if (template) {
      const derived = await deriveProviderFile(masterAbsolute, template);
      const asset = await uploadStoreAsset(
        store.id,
        { kind: "design-print-file", data: derived.data, mimeType: derived.mimeType },
        actor
      );
      fileUrl = toAbsolute(asset.url, origin);
    } else {
      await logActivity(store.id, {
        actor,
        category: "design",
        summary: `No PrintTemplate for ${entry.provider} "${entry.productType}" — published with the master's own dimensions`,
        details: { designId: design.id, provider: entry.provider, productType: entry.productType },
      });
    }

    const result = await generateProductFromDesign(
      store,
      {
        productType: entry.productType,
        designUrl: fileUrl,
        // The print-resolution file above can lose fine linework when a
        // vision model downscales it for its own encoder — pass the
        // design's own (much smaller) QC-proven preview for the AI
        // title/description call instead.
        visionUrl: previewAbsolute,
        priceCents: entry.priceCents,
        currency: entry.currency,
        sizes: entry.sizes,
        colorOptionName: entry.colorOptionName,
        sizeOptionName: entry.sizeOptionName,
        textModel: input.textModel,
      },
      actor,
      origin
    );

    await prisma.product.update({
      where: { id: result.product.id, storeId: store.id },
      data: { designId: design.id },
    });

    products.push({
      productType: entry.productType,
      product: result.product,
      rendered: result.rendered,
      failed: result.failed,
    });
  }

  const updated = await prisma.design.update({
    where: { id: design.id },
    data: { status: "published" },
  });

  await logActivity(store.id, {
    actor,
    category: "design",
    summary: `Published design "${design.slug}" as ${products.length} product(s)`,
    details: { designId: design.id, productTypes: input.productTypes.map((p) => p.productType) },
  });

  return { design: updated, products };
}
