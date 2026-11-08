"use server";
import { requireCurrentStore } from "@/lib/store-context";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { generateFactoryRevision, refineFactoryPrompt } from "@/lib/store/factory-review";
import { saveFactoryCalibration } from "@/lib/store/factory-calibration";
export async function refine(raw: unknown) {
  const store = await requireCurrentStore();
  if (!await isAdminAuthenticated(store)) throw new Error("Unauthorized");
  return refineFactoryPrompt(store, raw, "admin");
}
export async function generate(raw: unknown) {
  const store = await requireCurrentStore();
  if (!await isAdminAuthenticated(store)) throw new Error("Unauthorized");
  return generateFactoryRevision(store, raw, "admin");
}

export async function saveCalibration(raw: unknown) {
  const store = await requireCurrentStore();
  if (!await isAdminAuthenticated(store)) throw new Error("Unauthorized");
  return saveFactoryCalibration(store, raw, "admin");
}

export async function createDraft(raw: unknown) {
  const store = await requireCurrentStore();
  if (!await isAdminAuthenticated(store)) throw new Error("Unauthorized");
  const { createFactoryDraft } = await import("@/lib/store/factory-draft");
  return createFactoryDraft(store, raw, "admin");
}
export async function editDraft(id: string, raw: unknown) {
  const store = await requireCurrentStore();
  if (!await isAdminAuthenticated(store)) throw new Error("Unauthorized");
  const { updateFactoryDraft } = await import("@/lib/store/factory-draft");
  return updateFactoryDraft(store, id, raw, "admin");
}
