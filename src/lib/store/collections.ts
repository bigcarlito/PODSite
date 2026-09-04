import "server-only";
import { prisma } from "@/lib/prisma";
import { StoreError, notFound } from "./errors";
import type { CollectionCreateInput } from "./schemas";

export function listCollections() {
  return prisma.collection.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { title: "asc" },
  });
}

export async function getCollectionBySlug(slug: string) {
  const collection = await prisma.collection.findUnique({
    where: { slug },
    include: { products: { include: { product: true } } },
  });
  if (!collection) throw notFound(`Collection "${slug}"`);
  return collection;
}

export async function createCollection(input: CollectionCreateInput) {
  const existing = await prisma.collection.findUnique({
    where: { slug: input.slug },
  });
  if (existing) {
    throw new StoreError(
      "SLUG_TAKEN",
      `A collection with slug "${input.slug}" already exists`,
      { field: "slug", status: 409 }
    );
  }
  return prisma.collection.create({ data: input });
}
