import { requireCurrentStore } from "@/lib/store-context";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { listMockupScenes } from "@/lib/store/mockup-scenes";
import { DEFAULT_DESIGN_AREA, type DesignArea } from "@/lib/design/design-area";
import { readCalibrations } from "@/lib/store/factory-calibration";
import Review from "./review";
export default async function Page() {
  const store = await requireCurrentStore();
  if (!await isAdminAuthenticated(store)) redirect("/admin/login");
  const scenes = await listMockupScenes(store.id);
  return <Review initialPrintAreas={readCalibrations(store)} storeSlug={store.slug} scenes={scenes.map(s => ({ defaultPriceCents: s.defaultPriceCents, productType: s.productType, area: (s.designArea as DesignArea | null) ?? DEFAULT_DESIGN_AREA, bases: (s.baseImages as Record<string, string> | null) ?? {} }))} />;
}
