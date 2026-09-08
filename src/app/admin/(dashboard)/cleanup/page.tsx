import type { Metadata } from "next";
import { pruneOrphanedAssets, deleteOrphanedInactiveProducts } from "@/lib/store/cleanup";
import { requireCurrentStore } from "@/lib/store-context";
import { PruneAssetsButton } from "./PruneAssetsButton";
import { PruneProductsButton } from "./PruneProductsButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Cleanup" };

export default async function CleanupPage() {
  const store = await requireCurrentStore();

  const [assetsPreview, productsPreview] = await Promise.all([
    pruneOrphanedAssets(store.id, "admin", true),
    deleteOrphanedInactiveProducts(store.id, "admin", true),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold">Cleanup</h1>
      <p className="mt-1 text-xs text-muted">
        Housekeeping for data nothing else cleans up automatically. Both
        previews below are dry runs — nothing is deleted until you click the
        button.
      </p>

      <section className="mt-8 max-w-2xl">
        <h2 className="text-sm font-semibold uppercase text-muted">
          Orphaned assets
        </h2>
        <p className="mt-1 text-xs text-muted">
          Uploaded designs, scene photos, base mockups, and generated
          mockups are stored permanently (see AGENTS.md) — replacing one
          leaves the old copy behind with nothing pointing to it anymore.
        </p>

        <p className="mt-3 text-sm">
          <strong>{assetsPreview.orphaned.length}</strong> of{" "}
          {assetsPreview.total} stored asset(s) are unreferenced.
        </p>

        {assetsPreview.orphaned.length > 0 && (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border p-3 text-xs text-muted">
            {assetsPreview.orphaned.map((a) => (
              <li key={a.id}>
                {a.kind} — {a.id} ({new Date(a.createdAt).toLocaleDateString()})
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3">
          <PruneAssetsButton count={assetsPreview.orphaned.length} />
        </div>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-sm font-semibold uppercase text-muted">
          Orphaned inactive products
        </h2>
        <p className="mt-1 text-xs text-muted">
          Deactivated products are normally kept forever (past orders
          reference their variants) — these have no cart or order
          referencing any variant, so hard-deleting them is safe.
        </p>

        <p className="mt-3 text-sm">
          <strong>{productsPreview.eligible.length}</strong> of{" "}
          {productsPreview.total} inactive product(s) are safe to delete.
          {productsPreview.skipped.length > 0 && (
            <> {productsPreview.skipped.length} kept (still referenced).</>
          )}
        </p>

        {productsPreview.eligible.length > 0 && (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border p-3 text-xs text-muted">
            {productsPreview.eligible.map((p) => (
              <li key={p.id}>{p.title}</li>
            ))}
          </ul>
        )}

        <div className="mt-3">
          <PruneProductsButton count={productsPreview.eligible.length} />
        </div>
      </section>
    </div>
  );
}
