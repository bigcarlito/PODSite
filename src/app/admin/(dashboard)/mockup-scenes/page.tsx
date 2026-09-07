import type { Metadata } from "next";
import { listMockupScenes } from "@/lib/store/mockup-scenes";
import { requireCurrentStore } from "@/lib/store-context";
import { MockupSceneForm } from "./MockupSceneForm";
import { DeleteMockupSceneButton } from "./DeleteMockupSceneButton";

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
        <code>productType</code> uses this same photo for AI mockup
        generation: the garment gets recolored to match each variant, and the
        design is composited onto it.
      </p>

      {scenes.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-4">
          {scenes.map((s) => (
            <div key={s.id} className="w-48 text-center text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element -- our own asset URL */}
              <img
                src={s.imageUrl}
                alt={s.productType}
                className="h-48 w-48 rounded-lg border border-border object-cover"
              />
              <p className="mt-1 font-medium">{s.productType}</p>
              <DeleteMockupSceneButton productType={s.productType} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 max-w-md">
        <MockupSceneForm />
      </div>
    </div>
  );
}
