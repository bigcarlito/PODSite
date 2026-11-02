import "server-only";
import { Prisma, type Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mergeCalibration, printAreaProfileSchema } from "@/lib/design/placement";
import { logActivity, type ActivityActor } from "./activity";
import { StoreError } from "./errors";

export function readCalibrations(store: Pick<Store, "slug" | "brief">) {
  const brief = store.brief as Record<string, unknown> | null;
  return printAreaProfileSchema.array().parse(brief?.factoryPrintAreas ?? []).filter(p => p.storeSlug === store.slug);
}

export async function saveFactoryCalibration(store: Store, raw: unknown, actor: ActivityActor) {
  const profile = printAreaProfileSchema.parse(raw);
  if (profile.storeSlug !== store.slug) throw new StoreError("TENANT_MISMATCH", "Calibration belongs to another store");
  if (!profile.baseImageUrl) throw new StoreError("BASE_REQUIRED", "Choose a specific mockup photograph");
  return prisma.$transaction(async tx => {
    const current = await tx.store.findUniqueOrThrow({ where: { id: store.id } });
    const scene = await tx.mockupScene.findUnique({ where: { storeId_productType: { storeId: store.id, productType: profile.productType } } });
    if (!scene || !Object.values((scene.baseImages ?? {}) as Record<string, string>).includes(profile.baseImageUrl!)) throw new StoreError("BASE_NOT_FOUND", "Photograph is not in this tenant's scene", { status: 404 });
    const profiles = mergeCalibration(store.slug, readCalibrations(current), profile);
    await tx.store.update({ where: { id: store.id }, data: { brief: { ...(current.brief as Prisma.JsonObject), factoryPrintAreas: profiles } as Prisma.InputJsonValue } });
    await logActivity(store.id, { actor, category: "factory-calibration", summary: `Calibrated ${profile.productType} ${profile.printAreaId}`, details: { profile } });
    return printAreaProfileSchema.parse(profile);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
