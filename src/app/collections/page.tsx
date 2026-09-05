import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const collections = await prisma.collection.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Collections
      </h1>

      {collections.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No collections yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.slug}`}
              className="group flex aspect-[3/2] flex-col justify-end overflow-hidden rounded-2xl bg-accent/10 p-6"
            >
              <h2 className="text-lg font-semibold">{c.title}</h2>
              <p className="text-sm text-muted">
                {c._count.products} item{c._count.products === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
