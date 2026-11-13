"use server";
import { requireCurrentStore } from "@/lib/store-context";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { generateFactoryRevision, refineFactoryPrompt } from "@/lib/store/factory-review";
import { saveFactoryCalibration } from "@/lib/store/factory-calibration";
import { StoreError } from "@/lib/store/errors";
import { ZodError } from "zod";

async function draftResponse<T>(run: () => Promise<T>) {
  try { return await run(); }
  catch (error) {
    // Expected validation failures must survive production server-action redaction.
    if (error instanceof StoreError) return { error: { code: error.code, message: error.message } };
    if (error instanceof ZodError) return { error: { code: "INVALID_INPUT", message: error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") } };
    throw error;
  }
}
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
  return draftResponse(() => createFactoryDraft(store, raw, "admin"));
}
export async function editDraft(id: string, raw: unknown) {
  const store = await requireCurrentStore();
  if (!await isAdminAuthenticated(store)) throw new Error("Unauthorized");
  const { updateFactoryDraft } = await import("@/lib/store/factory-draft");
  return draftResponse(() => updateFactoryDraft(store, id, raw, "admin"));
}
