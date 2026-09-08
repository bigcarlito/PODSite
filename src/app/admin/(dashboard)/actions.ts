"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { originFromHeaders } from "@/lib/origin";
import { destroyAdminSession } from "@/lib/admin-auth";
import { requireCurrentStore } from "@/lib/store-context";
import * as ordersStore from "@/lib/store/orders";
import { updateStoreBrand, setHeroImage } from "@/lib/store/settings";
import { generateProductMockups, type ColorReport } from "@/lib/store/mockups";
import { generateAIProductMockups } from "@/lib/store/ai-mockups";
import { generateProductFromDesign } from "@/lib/store/ai-product-create";
import { updateProduct } from "@/lib/store/products";
import { uploadStoreAsset } from "@/lib/store/assets";
import {
  setMockupScene,
  deleteMockupScene,
  generateMockupSceneBases,
  setDesignArea,
} from "@/lib/store/mockup-scenes";
import {
  storeUpdateSchema,
  mockupGenerateSchema,
  aiMockupGenerateSchema,
  aiProductCreateSchema,
  designAreaSchema,
  productUpdateSchema,
} from "@/lib/store/schemas";
import { StoreError } from "@/lib/store/errors";
import { ZodError } from "zod";

export async function logoutAdmin() {
  await destroyAdminSession();
  redirect("/admin/login");
}

export type SettingsState = { error?: string; success?: boolean };

/** Splits a textarea into non-empty, trimmed lines. */
function linesOf(formData: FormData, field: string): string[] {
  return String(formData.get(field) ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Parses a JSON textarea field; throws with a field-specific message on bad input. */
function parseJsonField(formData: FormData, field: string, label: string) {
  const raw = String(formData.get(field) ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label} isn't valid JSON.`);
  }
}

export async function updateStoreSettings(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const store = await requireCurrentStore();

  try {
    const currentBrief = (store.brief as Record<string, unknown>) ?? {};
    const currentTheme = (store.theme as Record<string, unknown>) ?? {};

    const input = storeUpdateSchema.parse({
      name: String(formData.get("name") ?? ""),
      tagline: String(formData.get("tagline") ?? ""),
      description: String(formData.get("description") ?? ""),
      tone: String(formData.get("tone") ?? "") || undefined,
      audience: String(formData.get("audience") ?? "") || undefined,
      brief: {
        ...currentBrief,
        mission: String(formData.get("brief_mission") ?? ""),
        pricingPhilosophy: String(formData.get("brief_pricingPhilosophy") ?? ""),
        voiceExamples: linesOf(formData, "brief_voiceExamples"),
        avoid: linesOf(formData, "brief_avoid"),
      },
      theme: {
        ...currentTheme,
        accent: String(formData.get("theme_accent") ?? ""),
        accentDark: String(formData.get("theme_accentDark") ?? ""),
        heroImageUrl: String(formData.get("theme_heroImageUrl") ?? "") || undefined,
      },
      trustBadges: linesOf(formData, "trustBadges"),
      nav: parseJsonField(formData, "nav", "Nav links"),
      footerLinks: parseJsonField(formData, "footerLinks", "Footer links"),
      socialLinks: parseJsonField(formData, "socialLinks", "Social links"),
      bannerHtml: String(formData.get("bannerHtml") ?? ""),
    });

    await updateStoreBrand(store.id, input, "admin");
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      return { error: `${first.path.join(".")}: ${first.message}` };
    }
    return {
      error:
        e instanceof Error
          ? e.message
          : "Couldn't save settings — check the form and try again.",
    };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout"); // banner/theme show on every page via RootLayout
  return { success: true };
}

export type HeroImageUploadState = { url?: string; error?: string };

/**
 * Uploads a hero image file and immediately sets it as the store's active
 * homepage hero (see setHeroImage in src/lib/store/settings.ts — the same
 * function POST /api/agent/store/hero-image calls). Called directly from
 * SettingsForm's file input, not tied to the main settings form submit, so
 * the "Hero image URL" field can auto-fill with the uploaded image's URL
 * as soon as the upload finishes.
 */
export async function uploadHeroImage(formData: FormData): Promise<HeroImageUploadState> {
  const store = await requireCurrentStore();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file first." };
  }

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const updated = await setHeroImage(store, { data, mimeType: file.type }, "admin");
    const theme = (updated.theme as { heroImageUrl?: string } | null) ?? {};

    revalidatePath("/admin/settings");
    revalidatePath("/", "layout"); // hero shows on the homepage

    return { url: theme.heroImageUrl };
  } catch (e) {
    return {
      error:
        e instanceof StoreError
          ? e.message
          : "Couldn't upload image — try again.",
    };
  }
}

export type DesignUploadState = { url?: string; error?: string };

/**
 * Uploads a design image for the mockup test form — same uploadStoreAsset
 * plumbing as uploadHeroImage, just tagged "design" instead of "hero-image"
 * (see src/lib/store/assets.ts). Unlike the hero image, this isn't set
 * anywhere on Store; it just returns a public URL to fill into the
 * designUrl field. uploadStoreAsset's URL is host-relative, but
 * generateProductMockups (and, downstream, Printful) fetch designUrl
 * as an absolute URL from outside this request, so it's resolved against
 * this request's own host here rather than handed back as-is.
 */
export async function uploadDesignImage(formData: FormData): Promise<DesignUploadState> {
  const store = await requireCurrentStore();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file first." };
  }

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const asset = await uploadStoreAsset(store.id, { kind: "design", data, mimeType: file.type }, "admin");
    const origin = originFromHeaders(await headers());

    return { url: `${origin}${asset.url}` };
  } catch (e) {
    return {
      error: e instanceof StoreError ? e.message : "Couldn't upload image — try again.",
    };
  }
}

export type MockupTestState = {
  error?: string;
  result?: {
    dryRun: boolean;
    design: { palette: { hex: string; coverage: number }[]; opaqueRatio: number };
    colors: ColorReport[];
  };
};

/**
 * Admin-side form wrapper over generateProductMockups (the same function
 * POST /api/agent/products/:id/mockups calls) so the mockup feature can be
 * tried from a browser instead of curl. See MockupTestForm.
 */
export async function generateMockupsAction(
  _prevState: MockupTestState,
  formData: FormData
): Promise<MockupTestState> {
  const store = await requireCurrentStore();
  const productId = String(formData.get("productId") ?? "");

  try {
    const colorsRaw = String(formData.get("colors") ?? "").trim();
    const garmentsRaw = String(formData.get("garments") ?? "").trim();
    const minContrastRaw = String(formData.get("minContrast") ?? "").trim();
    const minCoverageRaw = String(formData.get("minCoverage") ?? "").trim();
    const catalogProductId = String(formData.get("catalogProductId") ?? "").trim();

    const input = mockupGenerateSchema.parse({
      designUrl: String(formData.get("designUrl") ?? ""),
      placement: String(formData.get("placement") ?? "") || undefined,
      colorOptionName: String(formData.get("colorOptionName") ?? "") || undefined,
      colors: colorsRaw
        ? colorsRaw.split(",").map((c) => c.trim()).filter(Boolean)
        : undefined,
      garments: garmentsRaw ? parseJsonField(formData, "garments", "Garments") : undefined,
      catalogProductId: catalogProductId || undefined,
      minContrast: minContrastRaw ? Number(minContrastRaw) : undefined,
      minCoverage: minCoverageRaw ? Number(minCoverageRaw) : undefined,
      dryRun: formData.get("dryRun") === "on",
    });

    const result = await generateProductMockups(store, productId, input, "admin");
    if (!result.dryRun) {
      revalidatePath(`/admin/products/${productId}/mockups`);
      revalidatePath("/admin/products");
    }
    return { result: { dryRun: result.dryRun, design: result.design, colors: result.colors } };
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      return { error: `${first.path.join(".")}: ${first.message}` };
    }
    if (e instanceof StoreError) {
      return { error: e.message };
    }
    return {
      error: e instanceof Error ? e.message : "Couldn't generate mockups — try again.",
    };
  }
}

export type AIMockupTestState = {
  error?: string;
  result?: {
    rendered: Array<{ color: string; mockupUrl: string }>;
    failed: Array<{ color: string; error: string }>;
  };
};

/**
 * Admin-side form wrapper over generateAIProductMockups (the same function
 * POST /api/agent/products/:id/mockups/ai calls) — recolors this product's
 * MockupScene and composites the design onto it via OpenRouter, as an
 * alternative to generateMockupsAction's Printful flat-mockup path.
 */
export async function generateAIMockupsAction(
  _prevState: AIMockupTestState,
  formData: FormData
): Promise<AIMockupTestState> {
  const store = await requireCurrentStore();
  const productId = String(formData.get("productId") ?? "");

  try {
    const colorsRaw = String(formData.get("colors") ?? "").trim();

    const input = aiMockupGenerateSchema.parse({
      designUrl: String(formData.get("designUrl") ?? ""),
      colorOptionName: String(formData.get("colorOptionName") ?? "") || undefined,
      colors: colorsRaw
        ? colorsRaw.split(",").map((c) => c.trim()).filter(Boolean)
        : undefined,
    });

    const origin = originFromHeaders(await headers());
    const result = await generateAIProductMockups(store, productId, input, "admin", origin);
    if (result.rendered.length > 0) {
      revalidatePath(`/admin/products/${productId}/mockups`);
      revalidatePath("/admin/products");
    }
    return { result: { rendered: result.rendered, failed: result.failed } };
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      return { error: `${first.path.join(".")}: ${first.message}` };
    }
    if (e instanceof StoreError) {
      return { error: e.message };
    }
    return {
      error: e instanceof Error ? e.message : "Couldn't generate AI mockups — try again.",
    };
  }
}

export type MockupSceneUploadState = { error?: string; success?: boolean };

/**
 * Uploads a scene photo and sets it as the shared AI-mockup template for a
 * product type — same uploadStoreAsset plumbing as uploadHeroImage/
 * uploadDesignImage, tagged "mockup-scene" (see mockup-scenes.ts).
 */
export async function uploadMockupScene(
  _prevState: MockupSceneUploadState,
  formData: FormData
): Promise<MockupSceneUploadState> {
  const store = await requireCurrentStore();

  const file = formData.get("file");
  const productType = String(formData.get("productType") ?? "").trim();
  if (!productType) {
    return { error: "Enter a product type (e.g. \"tshirt\") first." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file first." };
  }

  const colorsRaw = String(formData.get("colors") ?? "").trim();

  try {
    const colors = colorsRaw ? parseJsonField(formData, "colors", "Colors") : undefined;
    const data = Buffer.from(await file.arrayBuffer());
    const origin = originFromHeaders(await headers());

    await setMockupScene(store, productType, { data, mimeType: file.type }, "admin", origin, colors);
  } catch (e) {
    return {
      error: e instanceof StoreError ? e.message : "Couldn't upload scene photo — try again.",
    };
  }

  revalidatePath("/admin/mockup-scenes");
  return { success: true };
}

export async function deleteMockupSceneAction(productType: string) {
  const store = await requireCurrentStore();
  await deleteMockupScene(store.id, productType, "admin");
  revalidatePath("/admin/mockup-scenes");
}

export type GenerateBasesState = {
  error?: string;
  result?: { generated: Record<string, string>; failed: Array<{ color: string; error: string }> };
};

/**
 * Admin-side form wrapper over generateMockupSceneBases (the same
 * function POST /api/agent/mockup-scenes/:productType/generate-bases
 * calls) — pre-renders every color's design-free base mockup so later
 * per-design generation is a fast local composite instead of an AI call.
 */
export async function generateMockupSceneBasesAction(
  _prevState: GenerateBasesState,
  formData: FormData
): Promise<GenerateBasesState> {
  const store = await requireCurrentStore();
  const productType = String(formData.get("productType") ?? "");

  try {
    const origin = originFromHeaders(await headers());
    const result = await generateMockupSceneBases(store, productType, "admin", origin);
    revalidatePath("/admin/mockup-scenes");
    return { result: { generated: result.generated, failed: result.failed } };
  } catch (e) {
    return {
      error:
        e instanceof StoreError ? e.message : "Couldn't generate base mockups — try again.",
    };
  }
}

export type DesignAreaState = { error?: string; success?: boolean };

/** Sets the rectangle a design gets placed into for a product type's scene. */
export async function setDesignAreaAction(
  _prevState: DesignAreaState,
  formData: FormData
): Promise<DesignAreaState> {
  const store = await requireCurrentStore();
  const productType = String(formData.get("productType") ?? "");

  try {
    const area = designAreaSchema.parse({
      x: Number(formData.get("x")),
      y: Number(formData.get("y")),
      width: Number(formData.get("width")),
      height: Number(formData.get("height")),
    });
    await setDesignArea(store.id, productType, area, "admin");
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      return { error: `${first.path.join(".")}: ${first.message}` };
    }
    return {
      error: e instanceof StoreError ? e.message : "Couldn't save the design area — try again.",
    };
  }

  revalidatePath(`/admin/mockup-scenes/${productType}/design-area`);
  return { success: true };
}

export type GenerateProductState = {
  error?: string;
  result?: {
    productId: string;
    slug: string;
    title: string;
    description: string;
    rendered: Array<{ color: string; mockupUrl: string }>;
    failed: Array<{ color: string; error: string }>;
  };
};

/**
 * Admin-side form wrapper over generateProductFromDesign (the same
 * function POST /api/agent/products/generate-from-design calls) — the
 * "pick a type, upload a design, get a finished product" flow. Title,
 * description, and every color's mockup are generated automatically.
 */
export async function generateProductAction(
  _prevState: GenerateProductState,
  formData: FormData
): Promise<GenerateProductState> {
  const store = await requireCurrentStore();

  try {
    const priceDollars = Number(formData.get("price") ?? "0");
    const sizesRaw = String(formData.get("sizes") ?? "").trim();

    const input = aiProductCreateSchema.parse({
      productType: String(formData.get("productType") ?? ""),
      designUrl: String(formData.get("designUrl") ?? ""),
      priceCents: Math.round(priceDollars * 100),
      sizes: sizesRaw
        ? sizesRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    });

    const origin = originFromHeaders(await headers());
    const result = await generateProductFromDesign(store, input, "admin", origin);
    revalidatePath("/admin/products");

    return {
      result: {
        productId: result.product.id,
        slug: result.product.slug,
        title: result.title,
        description: result.description,
        rendered: result.rendered,
        failed: result.failed,
      },
    };
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      return { error: `${first.path.join(".")}: ${first.message}` };
    }
    if (e instanceof StoreError) {
      return { error: e.message };
    }
    return {
      error: e instanceof Error ? e.message : "Couldn't generate product — try again.",
    };
  }
}

export type ProductTypeState = { error?: string; success?: boolean };

/** Sets Product.productType — which MockupScene this product uses for AI mockups. */
export async function updateProductType(
  _prevState: ProductTypeState,
  formData: FormData
): Promise<ProductTypeState> {
  const store = await requireCurrentStore();
  const productId = String(formData.get("productId") ?? "");
  const productType = String(formData.get("productType") ?? "").trim();

  try {
    await updateProduct(store.id, productId, { productType: productType || undefined }, "admin");
  } catch (e) {
    return {
      error: e instanceof StoreError ? e.message : "Couldn't save product type — try again.",
    };
  }

  revalidatePath(`/admin/products/${productId}/mockups`);
  return { success: true };
}

export type VariantProviderIdsState = { error?: string; success?: boolean };

/**
 * Sets each variant's providerVariantId (the fulfillment provider's own
 * variant id, e.g. a Printful catalog variant) — the same updateProduct
 * function PATCH /api/agent/products/:id calls (rule #1). variantInputSchema
 * requires a full variant record per entry (not a partial patch), so every
 * other field is round-tripped from a hidden input rather than re-typed.
 */
export async function updateProviderVariantIds(
  _prevState: VariantProviderIdsState,
  formData: FormData
): Promise<VariantProviderIdsState> {
  const store = await requireCurrentStore();
  const productId = String(formData.get("productId") ?? "");
  const variantIds = formData.getAll("variantId").map(String);

  try {
    const variants = variantIds.map((id) => ({
      id,
      sku: String(formData.get(`sku_${id}`) ?? ""),
      options: parseJsonField(formData, `options_${id}`, "Options"),
      priceCents: Number(formData.get(`priceCents_${id}`)),
      currency: String(formData.get(`currency_${id}`) ?? "USD"),
      provider: String(formData.get(`provider_${id}`) ?? "PRINTFUL"),
      providerVariantId:
        String(formData.get(`providerVariantId_${id}`) ?? "").trim() || undefined,
      inStock: formData.get(`inStock_${id}`) === "on",
    }));

    const input = productUpdateSchema.parse({ variants });
    await updateProduct(store.id, productId, input, "admin");
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      return { error: `${first.path.join(".")}: ${first.message}` };
    }
    return {
      error:
        e instanceof StoreError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Couldn't save provider variant IDs — try again.",
    };
  }

  revalidatePath(`/admin/products/${productId}`);
  return { success: true };
}

export async function submitOrderToFulfillment(orderId: string) {
  const store = await requireCurrentStore();
  await ordersStore.submitOrderToFulfillment(store, orderId, "admin");
  revalidatePath("/admin");
}

export async function markOrderPaid(orderId: string) {
  const store = await requireCurrentStore();
  await ordersStore.markOrderPaid(store.id, orderId, "admin");
  revalidatePath("/admin");
}
