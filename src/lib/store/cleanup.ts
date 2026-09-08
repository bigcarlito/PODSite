import "server-only";
import { prisma } from "@/lib/prisma";
import { logActivity, type ActivityActor } from "./activity";

/**
 * Every place a StoreAsset's URL ("/api/assets/<id>") can be referenced
 * from, scanned to find assets nothing points to anymore. Deliberately
 * does NOT scan Store.bannerHtml (free-form admin/agent-authored HTML) —
 * it's meant for externally-hosted images, and parsing arbitrary HTML for
 * asset links isn't worth the complexity for that edge case (see AGENTS.md
 * #9). If you start linking uploaded assets from the banner, list them
 * here too.
 */
async function collectReferencedAssetIds(storeId: string): Promise<Set<string>> {
  const [store, scenes, images] = await Promise.all([
    prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { theme: true } }),
    prisma.mockupScene.findMany({ where: { storeId }, select: { imageUrl: true, baseImages: true } }),
    prisma.productImage.findMany({ where: { product: { storeId } }, select: { url: true } }),
  ]);

  const urls: string[] = [];
  const theme = (store.theme as { heroImageUrl?: string; logoUrl?: string } | null) ?? {};
  if (theme.heroImageUrl) urls.push(theme.heroImageUrl);
  if (theme.logoUrl) urls.push(theme.logoUrl);
  for (const scene of scenes) {
    urls.push(scene.imageUrl);
    urls.push(...Object.values((scene.baseImages as Record<string, string> | null) ?? {}));
  }
  urls.push(...images.map((i) => i.url));

  const ids = new Set<string>();
  for (const url of urls) {
    const match = /\/api\/assets\/([^/?#]+)/.exec(url);
    if (match) ids.add(match[1]);
  }
  return ids;
}

export type OrphanedAsset = { id: string; kind: string; mimeType: string; createdAt: Date };

/**
 * Finds (and, unless dryRun, deletes) every StoreAsset this store owns
 * that nothing references anymore — a design/scene/mockup image that was
 * replaced or superseded, since nothing currently cleans those up (see
 * AGENTS.md's asset-storage notes). dryRun defaults true: a caller must
 * explicitly ask for the real thing.
 */
export async function pruneOrphanedAssets(
  storeId: string,
  actor: ActivityActor,
  dryRun: boolean = true
) {
  const referenced = await collectReferencedAssetIds(storeId);
  const assets = await prisma.storeAsset.findMany({
    where: { storeId },
    select: { id: true, kind: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const orphaned: OrphanedAsset[] = assets.filter((a) => !referenced.has(a.id));

  if (dryRun || orphaned.length === 0) {
    return { total: assets.length, orphaned, deleted: 0, dryRun };
  }

  await prisma.storeAsset.deleteMany({ where: { id: { in: orphaned.map((a) => a.id) } } });

  await logActivity(storeId, {
    actor,
    category: "cleanup",
    summary: `Pruned ${orphaned.length} orphaned asset(s)`,
    details: { ids: orphaned.map((a) => a.id), kinds: [...new Set(orphaned.map((a) => a.kind))] },
  });

  return { total: assets.length, orphaned, deleted: orphaned.length, dryRun: false };
}

export type ProductSummary = { id: string; title: string; slug: string };

/**
 * Hard-deletes inactive products that no cart or order still references
 * through their variants — the one case where hard-deleting a product is
 * actually safe (see the soft-delete note on deactivateProduct: past
 * orders normally keep a product's variants alive by reference). A
 * product with even one variant still referenced by a CartItem/OrderItem
 * is left alone; the DB's own FK constraint would reject that delete
 * anyway; this just avoids attempting (and reporting) known-bad ones.
 * dryRun defaults true.
 */
export async function deleteOrphanedInactiveProducts(
  storeId: string,
  actor: ActivityActor,
  dryRun: boolean = true
) {
  const candidates = await prisma.product.findMany({
    where: { storeId, isActive: false },
    select: {
      id: true,
      title: true,
      slug: true,
      variants: {
        select: { _count: { select: { cartItems: true, orderItems: true } } },
      },
    },
  });

  const isEligible = (p: (typeof candidates)[number]) =>
    p.variants.every((v) => v._count.cartItems === 0 && v._count.orderItems === 0);

  const eligible: ProductSummary[] = candidates.filter(isEligible).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
  }));
  const skipped: ProductSummary[] = candidates
    .filter((p) => !isEligible(p))
    .map((p) => ({ id: p.id, title: p.title, slug: p.slug }));

  if (dryRun || eligible.length === 0) {
    return { total: candidates.length, eligible, skipped, deleted: 0, dryRun };
  }

  const deleted: ProductSummary[] = [];
  const failed: Array<{ id: string; title: string; error: string }> = [];
  for (const p of eligible) {
    try {
      await prisma.product.delete({ where: { id: p.id } });
      deleted.push(p);
    } catch (cause) {
      failed.push({ id: p.id, title: p.title, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  await logActivity(storeId, {
    actor,
    category: "cleanup",
    summary: `Hard-deleted ${deleted.length} orphaned inactive product(s)`,
    details: { deleted: deleted.map((d) => d.slug), failed },
  });

  return { total: candidates.length, eligible, skipped, deleted: deleted.length, failed, dryRun: false };
}
