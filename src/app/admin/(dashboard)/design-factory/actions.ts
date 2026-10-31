"use server";
import { requireCurrentStore } from "@/lib/store-context";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { generateFactoryRevision, refineFactoryPrompt } from "@/lib/store/factory-review";
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
