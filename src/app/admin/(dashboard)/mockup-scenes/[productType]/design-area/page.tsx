import type { Metadata } from "next";
import Link from "next/link";
import { getMockupScene } from "@/lib/store/mockup-scenes";
import { requireCurrentStore } from "@/lib/store-context";
import { DEFAULT_DESIGN_AREA } from "@/lib/design/design-area";
import { DesignAreaEditor } from "./DesignAreaEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin — Design area" };

export default async function DesignAreaPage({
  params,
}: {
  params: Promise<{ productType: string }>;
}) {
  const { productType: rawProductType } = await params;
  const productType = decodeURIComponent(rawProductType);
  const store = await requireCurrentStore();
  const scene = await getMockupScene(store.id, productType);

  return (
    <div>
      <p className="text-xs text-muted">
        <Link href="/admin/mockup-scenes" className="underline">
          Mockup scenes
        </Link>{" "}
        / {productType} / Design area
      </p>
      <h1 className="mt-1 text-xl font-semibold">Design area — {productType}</h1>
      <p className="mt-1 text-xs text-muted">
        Drag the rectangle to move it, drag the bottom-right handle to scale
        it. Load a reference design first so the rectangle locks to its
        aspect ratio — every future mockup for this product type scales its
        design to fit this same box, preserving its own proportions.
      </p>

      <DesignAreaEditor
        productType={productType}
        sceneImageUrl={scene.imageUrl}
        initialArea={(scene.designArea as typeof DEFAULT_DESIGN_AREA | null) ?? DEFAULT_DESIGN_AREA}
      />
    </div>
  );
}
