import "server-only";
import { prisma } from "@/lib/prisma";
import { StoreError, notFound } from "./errors";
import type { ProductCreateInput, ProductUpdateInput } from "./schemas";

const productInclude = {
  images: { orderBy: { position: "asc" } as const },
  variants: true,
  collections: { include: { collection: true } },
} as const;

export function listProducts(storeId: string, opts?: { activeOnly?: boolean }) {
  return prisma.product.findMany({
    where: { storeId, ...(opts?.activeOnly ? { isActive: true } : {}) },
    include: productInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductBySlug(storeId: string, slug: string) {
  const product = await prisma.product.findUnique({
    where: { storeId_slug: { storeId, slug } },
    include: productInclude,
  });
  if (!product) throw notFound(`Product "${slug}"`);
  return product;
}

export async function getProductById(storeId: string, id: string) {
  const product = await prisma.product.findFirst({
    where: { id, storeId },
    include: productInclude,
  });
  if (!product) throw notFound(`Product "${id}"`);
  return product;
}

export async function createProduct(storeId: string, input: ProductCreateInput) {
  const existing = await prisma.product.findUnique({
    where: { storeId_slug: { storeId, slug: input.slug } },
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
      storeId,
      slug: input.slug,
      title: input.title,
      description: input.description,
      optionNames: input.optionNames,
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
          storeId,
          sku: v.sku,
          options: v.options,
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

export async function updateProduct(
  storeId: string,
  id: string,
  input: ProductUpdateInput
) {
  const existing = await prisma.product.findFirst({ where: { id, storeId } });
  if (!existing) throw notFound(`Product "${id}"`);

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        optionNames: input.optionNames,
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
            where: { id: v.id, storeId },
            data: {
              sku: v.sku,
              options: v.options,
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
              storeId,
              productId: id,
              sku: v.sku,
              options: v.options,
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

  return getProductById(storeId, id);
}

/** Soft delete — print-on-demand orders may still reference this product. */
export async function deactivateProduct(storeId: string, id: string) {
  const existing = await prisma.product.findFirst({ where: { id, storeId } });
  if (!existing) throw notFound(`Product "${id}"`);
  return prisma.product.update({
    where: { id },
    data: { isActive: false },
    include: productInclude,
  });
}

/** Variants that are out of stock or have no price set — worth an agent's attention. */
export function listAttentionVariants(storeId: string) {
  return prisma.productVariant.findMany({
    where: { storeId, OR: [{ inStock: false }, { priceCents: 0 }] },
    include: { product: { select: { title: true, slug: true, isActive: true } } },
  });
}
