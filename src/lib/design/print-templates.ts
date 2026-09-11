import "server-only";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import type { FulfillmentProviderName, PrintTemplate } from "@prisma/client";
import { logActivity, type ActivityActor } from "@/lib/store/activity";
import type { PrintTemplateUpsertInput } from "@/lib/store/schemas";

export function listPrintTemplates(storeId: string) {
  return prisma.printTemplate.findMany({
    where: { storeId },
    orderBy: [{ provider: "asc" }, { productType: "asc" }],
  });
}

export function getPrintTemplate(
  storeId: string,
  provider: FulfillmentProviderName,
  productType: string
) {
  return prisma.printTemplate.findUnique({
    where: { storeId_provider_productType: { storeId, provider, productType } },
  });
}

/**
 * Sets (creating or replacing) the pixel spec a provider expects for a
 * product type on this store — looked up at publish time to derive that
 * provider's exact file from Design.masterImageUrl by crop/resize (see
 * AGENTS.md's design-system notes). Never touches the master itself.
 */
export async function setPrintTemplate(
  storeId: string,
  provider: FulfillmentProviderName,
  productType: string,
  input: PrintTemplateUpsertInput,
  actor: ActivityActor
) {
  const template = await prisma.printTemplate.upsert({
    where: { storeId_provider_productType: { storeId, provider, productType } },
    update: input,
    create: { storeId, provider, productType, ...input },
  });

  await logActivity(storeId, {
    actor,
    category: "print-template",
    summary: `Set print template for ${provider} "${productType}"`,
    details: { provider, productType, ...input },
  });

  return template;
}

/**
 * Derives a provider's exact print file from the design's master image —
 * a crop/resize only, never a regeneration (see AGENTS.md's design-system
 * notes). Resizes to the template's exact dimensions without cropping into
 * the artwork itself: a target aspect ratio different from the master's
 * gets transparent padding, same as the master canvas's own upscale step.
 */
export async function deriveProviderFile(
  masterImageUrl: string,
  template: Pick<PrintTemplate, "widthPx" | "heightPx" | "format">
): Promise<{ data: Buffer; mimeType: string }> {
  const res = await fetch(masterImageUrl);
  if (!res.ok) {
    throw new Error(`Could not fetch master image (HTTP ${res.status})`);
  }
  const input = Buffer.from(await res.arrayBuffer());

  const resized = sharp(input).resize(template.widthPx, template.heightPx, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  const isJpeg = template.format.toLowerCase() === "jpg" || template.format.toLowerCase() === "jpeg";
  const data = isJpeg ? await resized.jpeg({ quality: 95 }).toBuffer() : await resized.png().toBuffer();
  return { data, mimeType: isJpeg ? "image/jpeg" : "image/png" };
}
