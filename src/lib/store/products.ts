import "server-only";
import { prisma } from "@/lib/prisma";
import { StoreError, notFound } from "./errors";
import type { ProductCreateInput, ProductUpdateInput } from "./schemas";

const productInclude = {
  images: { orderBy: { position: "asc" } as const },
  variants: true,
  collections: { include: { collection: true } },
} as const;

export function listProducts(opts?: { activeOnly?: boolean }) {
  return prisma.product.findMany({
    where: opts?.activeOnly ? { isActive: true } : undefined,
    include: productInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: productInclude,
  });
  if (!product) throw notFound(`Product "${slug}"`);
  return product;
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!product) throw notFound(`Product "${id}"`);
  return product;
}

export async function createProduct(input: ProductCreateInput) {
  const existing = await prisma.product.findUnique({
    where: { slug: input.slug },
  });
  if (existing) {
    throw new StoreError(
      "SLUG_TAKEN",
      `A product with slug "${input.slug}" already exists`,
      { field: "slug", status: 409 }
    );
  }

  const product = await prisma.product.create({
    data: {
      slug: input.slug,
      title: input.title,
      description: input.description,
      isFeatured: input.isFeatured,
      isActive: input.isActive,
      collections: {
        create: input.collectionIds.map((collectionId) => ({
          collectionId,
        })),
      },
      images: {
        create: input.images.map((img, position) => ({
          url: img.url,
          altText: img.altText,
          position,
        })),
      },
      variants: {
        create: input.variants.map((v) => ({
          sku: v.sku,
          size: v.size,
          color: v.color,
          priceCents: v.priceCents,
          currency: v.currency,
          provider: v.provider,
          providerVariantId: v.providerVariantId,
          inStock: v.inStock,
        })),
      },
    },
    include: productInclude,
  });

  return product;
}

export async function updateProduct(id: string, input: ProductUpdateInput) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw notFound(`Product "${id}"`);

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        isFeatured: input.isFeatured,
        isActive: input.isActive,
      },
    });

    if (input.collectionIds) {
      await tx.productCollection.deleteMany({ where: { productId: id } });
      await tx.productCollection.createMany({
        data: input.collectionIds.map((collectionId) => ({
          productId: id,
          collectionId,
        })),
      });
    }

    if (input.images) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: input.images.map((img, position) => ({
          productId: id,
          url: img.url,
          altText: img.altText,
          position,
        })),
      });
    }

    if (input.variants) {
      for (const v of input.variants) {
        if (v.id) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              sku: v.sku,
              size: v.size,
              color: v.color,
              priceCents: v.priceCents,
              currency: v.currency,
              provider: v.provider,
              providerVariantId: v.providerVariantId,
              inStock: v.inStock,
            },
          });
        } else {
          await tx.productVariant.create({
            data: {
              productId: id,
              sku: v.sku,
              size: v.size,
              color: v.color,
              priceCents: v.priceCents,
              currency: v.currency,
              provider: v.provider,
              providerVariantId: v.providerVariantId,
              inStock: v.inStock,
            },
          });
        }
      }
    }
  });

  return getProductById(id);
}

/** Soft delete — print-on-demand orders may still reference this product. */
export async function deactivateProduct(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw notFound(`Product "${id}"`);
  return prisma.product.update({
    where: { id },
    data: { isActive: false },
    include: productInclude,
  });
}

/** Variants that are out of stock or have no price set — worth an agent's attention. */
export function listAttentionVariants() {
  return prisma.productVariant.findMany({
    where: { OR: [{ inStock: false }, { priceCents: 0 }] },
    include: { product: { select: { title: true, slug: true, isActive: true } } },
  });
}
