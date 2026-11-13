"use server";
import { revalidatePath } from "next/cache";
import { requireCurrentStore } from "@/lib/store-context";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { publishProduct, unpublishProduct } from "@/lib/store/product-publication";
import { StoreError } from "@/lib/store/errors";

export async function setProductPublished(id: string, published: boolean) {
  const store = await requireCurrentStore();
  if (!await isAdminAuthenticated(store)) return { error: "Unauthorized" };
  try {
    const result = await (published ? publishProduct : unpublishProduct)(store, id, {}, "admin");
    revalidatePath("/", "layout");
    return result;
  } catch (error) {
    return { error: error instanceof StoreError ? error.message : "Product publication failed. Please try again." };
  }
}
