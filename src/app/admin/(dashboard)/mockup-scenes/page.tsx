import type { Metadata } from "next";
import { listMockupScenes } from "@/lib/store/mockup-scenes";
import { requireCurrentStore } from "@/lib/store-context";
import { MockupSceneForm } from "./MockupSceneForm";
import { MockupSceneCard } from "./MockupSceneCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Mockup scenes" };

export default async function MockupScenesPage() {
  const store = await requireCurrentStore();
  const scenes = await listMockupScenes(store.id);

  return (
    <div>
      <h1 className="text-xl font-semibold">Mockup scenes</h1>
      <p className="mt-1 text-xs text-muted">
        One shared scene photo per product type (e.g. &quot;tshirt&quot;) — a
        blank garment in a real setting. Every product with that{" "}
        <code>productType</code> uses this same photo: each color gets a
        pre-generated, design-free base mockup (recolored once, reused for
        every design), and each design gets deterministically placed into
        the design area you define below — no AI call needed per design.
      </p>

      {scenes.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-4">
          {scenes.map((s) => (
            <MockupSceneCard
              key={s.id}
              scene={{
                id: s.id,
                productType: s.productType,
                imageUrl: s.imageUrl,
                colors: (s.colors as { name: string; hex: string }[]) ?? [],
                baseImages: (s.baseImages as Record<string, string>) ?? {},
                hasDesignArea: s.designArea != null,
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-8 max-w-md">
        <MockupSceneForm />
      </div>
    </div>
  );
}
