import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, Store } from "@prisma/client";
import { getFulfillmentProvider } from "@/lib/fulfillment/registry";
import type { GarmentColor } from "@/lib/design/palette";
import {
  DEFAULT_MIN_CONTRAST,
  extractDesignPalette,
  scoreGarmentColors,
} from "@/lib/design/palette";
import { StoreError } from "./errors";
import { logActivity, type ActivityActor } from "./activity";
import { getProductById } from "./products";
import type { MockupGenerateInput } from "./schemas";

export type ColorReport = {
  color: string;
  hex: string;
  minContrast: number;
  /** The design color that contrasts worst against this garment. */
  worstColor: string;
  fits: boolean;
  mockupUrl?: string;
  skipped?: string;
};

/**
 * Surfaces provider failures (missing credentials, upstream API errors,
 * render timeouts) as structured errors carrying the provider's own
 * message, rather than letting them fall through as a bare 500.
 */
async function callProvider<T>(action: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (cause) {
    throw new StoreError(
      "PROVIDER_ERROR",
      `Fulfillment provider failed while ${action}: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
      { status: 502 }
    );
  }
}

/**
 * Renders per-color product mockups of a design and attaches them to a
 * product, skipping garment colors the design would disappear on.
 *
 * Mockups are per *color*, not per variant — S/M/L of the same color share
 * one image — so variants are collapsed to one representative per color
 * before anything is sent to the provider.
 */
export async function generateProductMockups(
  store: Store,
  productId: string,
  input: MockupGenerateInput,
  actor: ActivityActor = "agent"
) {
  const product = await getProductById(store.id, productId);

  // One representative variant per garment color.
  const byColor = new Map<string, string>();
  for (const variant of product.variants) {
    const options = (variant.options as Record<string, string> | null) ?? {};
    const color = options[input.colorOptionName];
    if (!color || !variant.providerVariantId) continue;
    if (input.colors && !input.colors.includes(color)) continue;
    if (!byColor.has(color)) byColor.set(color, variant.providerVariantId);
  }

  if (byColor.size === 0) {
    throw new StoreError(
      "NO_MOCKUP_VARIANTS",
      `No variants on "${product.title}" have both a "${input.colorOptionName}" ` +
        `option and a providerVariantId, so there's nothing to render mockups for.`,
      { status: 422 }
    );
  }

  // A URL that can't be fetched or decoded is the caller's mistake, not a
  // server fault — report it as such instead of a bare 500.
  const palette = await extractDesignPalette(input.designUrl).catch((cause) => {
    throw new StoreError(
      "DESIGN_UNREADABLE",
      `Could not read the design at ${input.designUrl}: ` +
        `${cause instanceof Error ? cause.message : String(cause)}`,
      { field: "designUrl", status: 422 }
    );
  });

  if (palette.colors.length === 0) {
    throw new StoreError(
      "EMPTY_DESIGN",
      "The design image has no opaque pixels — is it fully transparent?",
      { field: "designUrl", status: 422 }
    );
  }

  const provider = getFulfillmentProvider("PRINTFUL", store.printfulApiKey);

  // Garment hexes come from the caller when supplied (lets an agent preview
  // color fit with no provider credentials), otherwise from the provider.
  let catalogProductId = input.catalogProductId;
  let garments: GarmentColor[];

  // Colors we have no hex for are reported as unscored rather than guessed
  // at — inventing a hex would silently produce a wrong accept/reject.
  const unscored: string[] = [];

  if (input.garments) {
    const supplied = new Map(input.garments.map((g) => [g.name, g.hex]));
    garments = [];
    for (const color of byColor.keys()) {
      const hex = supplied.get(color);
      if (hex) garments.push({ name: color, hex });
      else unscored.push(color);
    }
  } else {
    const details = await callProvider("looking up garment colors", () =>
      provider.getVariantDetails([...byColor.values()])
    );
    const byProviderId = new Map(details.map((d) => [d.providerVariantId, d]));
    catalogProductId ??= details[0]?.catalogProductId;
    garments = [...byColor.entries()].map(([color, providerVariantId]) => ({
      name: color,
      hex: byProviderId.get(providerVariantId)?.colorHex || "#ffffff",
    }));
  }

  const fits = scoreGarmentColors(palette, garments, {
    minContrast: input.minContrast,
    minCoverage: input.minCoverage,
  });

  const report: ColorReport[] = [
    ...fits.map((fit) => ({
      color: fit.garment,
      hex: fit.hex,
      minContrast: fit.minContrast,
      worstColor: fit.worstColor,
      fits: fit.fits,
      ...(fit.fits
        ? {}
        : {
            skipped: `design color ${fit.worstColor} only reaches ${fit.minContrast}:1 against this garment`,
          }),
    })),
    ...unscored.map((color) => ({
      color,
      hex: "",
      minContrast: 0,
      worstColor: "",
      fits: false,
      skipped: "no hex supplied for this garment color, so it wasn't scored",
    })),
  ];

  const design = { palette: palette.colors, opaqueRatio: palette.opaqueRatio };

  if (input.dryRun) {
    return { product, design, colors: report, dryRun: true as const };
  }

  const wanted = report.filter((r) => r.fits);
  if (wanted.length === 0) {
    // Carry the scoring back with the failure: the caller needs the actual
    // numbers to pick a workable threshold, and making them re-run with
    // dryRun just to see them would be a wasted round-trip.
    const threshold = input.minContrast ?? DEFAULT_MIN_CONTRAST;
    const closest = report
      .filter((r) => r.hex)
      .reduce<ColorReport | null>(
        (best, r) => (best && best.minContrast >= r.minContrast ? best : r),
        null
      );

    throw new StoreError(
      "NO_LEGIBLE_COLORS",
      `No garment color reaches the ${threshold}:1 contrast threshold for this design` +
        (closest
          ? `; the closest was ${closest.color} at ${closest.minContrast}:1, ` +
            `limited by design color ${closest.worstColor}. ` +
            `Lower minContrast, offer different garment colors, or rework the artwork.`
          : ". No garment color could be scored — check that the colors have hexes."),
      {
        status: 422,
        details: { threshold, design, colors: report },
      }
    );
  }

  if (!catalogProductId) {
    throw new StoreError(
      "MISSING_CATALOG_PRODUCT",
      "Could not determine the provider catalog product to render on — " +
        "pass catalogProductId explicitly.",
      { field: "catalogProductId", status: 422 }
    );
  }

  const mockups = await callProvider("rendering mockups", () =>
    provider.generateMockups({
      catalogProductId,
      providerVariantIds: wanted.map((r) => byColor.get(r.color)!),
      imageUrl: input.designUrl,
      placement: input.placement,
    })
  );

  const urlByProviderId = new Map(mockups.map((m) => [m.providerVariantId, m.url]));
  const rendered = wanted
    .map((r) => ({ ...r, mockupUrl: urlByProviderId.get(byColor.get(r.color)!) }))
    .filter((r): r is ColorReport & { mockupUrl: string } => Boolean(r.mockupUrl));

  await prisma.$transaction(async (tx) => {
    // Replace any previous mockup for these colors so re-running is idempotent
    // rather than piling up stale renders of an older design.
    const existing = await tx.productImage.findMany({ where: { productId } });
    const supersededIds = existing
      .filter((image) => {
        const values = (image.optionValues as Record<string, string> | null) ?? null;
        const color = values?.[input.colorOptionName];
        return color != null && rendered.some((r) => r.color === color);
      })
      .map((image) => image.id);

    if (supersededIds.length > 0) {
      await tx.productImage.deleteMany({ where: { id: { in: supersededIds } } });
    }

    const basePosition = existing.reduce(
      (max, image) => Math.max(max, image.position + 1),
      0
    );

    await tx.productImage.createMany({
      data: rendered.map((r, index) => ({
        productId,
        url: r.mockupUrl,
        altText: `${product.title} — ${r.color}`,
        position: basePosition + index,
        optionValues: {
          [input.colorOptionName]: r.color,
        } as Prisma.InputJsonValue,
      })),
    });
  });

  await logActivity(store.id, {
    actor,
    category: "mockup",
    summary: `Generated ${rendered.length} mockup(s) for "${product.title}"`,
    details: {
      productId,
      designUrl: input.designUrl,
      placement: input.placement,
      rendered: rendered.map((r) => r.color),
      skipped: report.filter((r) => !r.fits).map((r) => r.color),
    },
  });

  const colors = report.map((r) => ({
    ...r,
    mockupUrl: rendered.find((x) => x.color === r.color)?.mockupUrl,
  }));

  return {
    product: await getProductById(store.id, productId),
    design,
    colors,
    dryRun: false as const,
  };
}
