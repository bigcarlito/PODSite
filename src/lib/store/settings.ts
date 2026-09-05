import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { logActivity, type ActivityActor } from "./activity";
import type { StoreUpdateInput } from "./schemas";

/** Fields a store can update about itself — brand/copy/theme, never credentials or slug/domain. */
export async function updateStoreBrand(
  storeId: string,
  input: StoreUpdateInput,
  actor: ActivityActor = "agent"
) {
  const store = await prisma.store.update({
    where: { id: storeId },
    data: input as Prisma.StoreUpdateInput,
  });

  await logActivity(storeId, {
    actor,
    category: "brand",
    summary: "Updated store branding",
    details: { changes: input },
  });

  return store;
}
