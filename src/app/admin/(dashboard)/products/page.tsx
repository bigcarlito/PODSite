import type { Metadata } from "next";
import { listProducts } from "@/lib/store/products";
import { requireCurrentStore } from "@/lib/store-context";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Products" };

export default async function AdminProductsPage() {
  const store = await requireCurrentStore();
  const products = await listProducts(store.id);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products</h1>
        <p className="text-xs text-muted">
          Manage products via the seed script, Prisma Studio, or the{" "}
          <code>/api/agent/products</code> API (see docs/AGENT_API.md).
        </p>
      </div>

      {products.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No products yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 pr-4 font-medium">Price</th>
                <th className="pb-2 pr-4 font-medium">Active</th>
                <th className="pb-2 font-medium">Featured</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <td className="py-3 pr-4">{p.title}</td>
                  <td className="py-3 pr-4">
                    {formatCents(p.variants[0]?.priceCents ?? 0)}
                  </td>
                  <td className="py-3 pr-4">{p.isActive ? "Yes" : "No"}</td>
                  <td className="py-3">{p.isFeatured ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
