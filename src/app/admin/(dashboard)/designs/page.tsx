import type { Metadata } from "next";
import Link from "next/link";
import { listDesigns } from "@/lib/design/designs";
import { requireCurrentStore } from "@/lib/store-context";
import { BatchGenerateForm } from "./BatchGenerateForm";
import { DesignCard } from "./DesignCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Designs" };

const STATUS_TABS = ["generated", "rejected", "published", "all"] as const;

export default async function DesignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const store = await requireCurrentStore();
  const { status: statusParam } = await searchParams;
  const status = STATUS_TABS.includes(statusParam as (typeof STATUS_TABS)[number])
    ? (statusParam as (typeof STATUS_TABS)[number])
    : "generated";

  const designs = await listDesigns(store.id, {
    status: status === "all" ? undefined : status,
    take: 100,
  });

  return (
    <div>
      <h1 className="text-xl font-semibold">Designs</h1>
      <p className="mt-1 text-xs text-muted">
        Generate a batch of t-shirt design concepts, review each one, then
        either reject it or turn it into a real product in one click. Every
        image still runs through the same QC gate and upscale as a design
        created one at a time.
      </p>

      <div className="mt-6 max-w-xl rounded-lg border border-border p-4">
        <BatchGenerateForm defaultNiche={store.audience ?? ""} />
      </div>

      <nav className="mt-8 flex gap-4 border-b border-border text-sm font-medium">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab}
            href={`/admin/designs?status=${tab}`}
            className={`pb-2 ${
              status === tab ? "border-b-2 border-accent text-accent" : "text-muted"
            }`}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </Link>
        ))}
      </nav>

      {designs.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No designs in this view yet.</p>
      ) : (
        <div className="mt-6 flex flex-wrap gap-4">
          {designs.map((d) => (
            <DesignCard
              key={d.id}
              design={{
                id: d.id,
                slug: d.slug,
                status: d.status,
                previewImageUrl: d.previewImageUrl,
                batchLabel: d.batchLabel,
                aspects: (d.aspects as Record<string, unknown>) ?? {},
                params: (d.params as Record<string, unknown>) ?? {},
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
