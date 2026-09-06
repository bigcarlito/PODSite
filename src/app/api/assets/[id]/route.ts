import { getStoreAsset } from "@/lib/store/assets";
import { errorResponse } from "@/lib/store/api-helpers";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Publicly serves an uploaded store asset (currently just hero images) by
 * id — no auth, since these are meant to be viewable on the public
 * storefront (same trust level as any other image URL on the site). Not
 * store-scoped for the same reason: the id itself is the unguessable
 * capability, like a product image URL.
 */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const asset = await getStoreAsset(id);
    return new Response(new Uint8Array(asset.data), {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
