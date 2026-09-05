"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { destroyAdminSession } from "@/lib/admin-auth";
import { requireCurrentStore } from "@/lib/store-context";
import * as ordersStore from "@/lib/store/orders";
import { updateStoreBrand } from "@/lib/store/settings";
import { storeUpdateSchema } from "@/lib/store/schemas";
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
      },
      trustBadges: linesOf(formData, "trustBadges"),
      nav: parseJsonField(formData, "nav", "Nav links"),
      footerLinks: parseJsonField(formData, "footerLinks", "Footer links"),
      socialLinks: parseJsonField(formData, "socialLinks", "Social links"),
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
  revalidatePath("/");
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
