import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, Store } from "@prisma/client";
import { StoreError, notFound } from "@/lib/store/errors";
import { logActivity, type ActivityActor } from "@/lib/store/activity";
import { uploadStoreAsset } from "@/lib/store/assets";
import type { DesignCreateInput } from "@/lib/store/schemas";
import { ASPECTS_VERSION, aspectsSchema } from "./aspects";
import { compileDesignPrompt } from "./prompt";
import { getImageProvider } from "./providers/registry";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "design"
  );
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

/**
 * Validates aspects → compiles the prompt → generates via the chosen
 * ImageProvider → persists the Design row. Phase 1 stops here: no QC gate
 * and no upscale yet (previewImageUrl is set, masterImageUrl stays null),
 * so status lands on "generated" rather than "published" — see AGENTS.md's
 * design-system notes for the full pipeline this is the first stage of.
 */
export async function createDesign(store: Store, input: DesignCreateInput, actor: ActivityActor) {
  const aspects = aspectsSchema.parse(input.aspects);

  const slug = input.slug ? slugify(input.slug) : slugify(aspects.phrase || aspects.subject || "design");
  const existing = await prisma.design.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } });
  if (existing) {
    throw new StoreError("SLUG_TAKEN", `A design with slug "${slug}" already exists`, {
      field: "slug",
      status: 409,
    });
  }

  const compiled = compileDesignPrompt(aspects);
  const provider = getImageProvider(input.provider);

  let generated;
  try {
    generated = await provider.generate(compiled, {
      model: input.model,
      negativePrompt: input.negativePrompt,
    });
  } catch (cause) {
    throw new StoreError(
      "AI_PROVIDER_ERROR",
      `Design generation failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      { status: 502 }
    );
  }

  // Providers return either a publicly reachable URL or a data: URI (see
  // ImageProvider) — persist through the same asset store every other
  // AI-generated image uses rather than trusting a provider's own
  // (often temporary) hosting.
  let previewImageUrl = generated.imageUrl;
  const dataUrlMatch = /^data:([^;]+);base64,([\s\S]+)$/.exec(generated.imageUrl);
  if (dataUrlMatch) {
    const asset = await uploadStoreAsset(
      store.id,
      { kind: "design-preview", data: Buffer.from(dataUrlMatch[2], "base64"), mimeType: dataUrlMatch[1] },
      actor
    );
    previewImageUrl = asset.url;
  }

  const design = await prisma.design.create({
    data: {
      storeId: store.id,
      slug,
      aspects: aspects as unknown as Prisma.InputJsonValue,
      aspectsVersion: ASPECTS_VERSION,
      prompt: compiled.promptText,
      negativePrompt: input.negativePrompt,
      provider: input.provider,
      model: input.model || String(generated.rawParams.model ?? ""),
      seed: generated.seed,
      params: {
        aspectRatioBucket: compiled.aspectRatioBucket,
        colorRoles: compiled.colorRoles,
        exclusions: compiled.exclusions,
        rawParams: generated.rawParams,
      } as unknown as Prisma.InputJsonValue,
      previewImageUrl,
      status: "generated",
    },
  });

  await logActivity(store.id, {
    actor,
    category: "design",
    summary: `Generated design "${slug}"`,
    details: { designId: design.id, aspects, provider: input.provider },
  });

  return design;
}
