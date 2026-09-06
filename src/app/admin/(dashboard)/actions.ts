"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { destroyAdminSession } from "@/lib/admin-auth";
import { requireCurrentStore } from "@/lib/store-context";
import * as ordersStore from "@/lib/store/orders";
import { updateStoreBrand, setHeroImage } from "@/lib/store/settings";
import { storeUpdateSchema } from "@/lib/store/schemas";
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
