/** One-product draft operation using existing tenant-scoped platform functions.
 * Default: read-only validation. --apply creates only an inactive, unavailable draft.
 * Run with --conditions=react-server so server-only imports work in Node.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";
import { createProduct, getProductBySlug } from "../src/lib/store/products";
import { updateStoreBrand } from "../src/lib/store/settings";
import { uploadStoreAsset } from "../src/lib/store/assets";
import { logActivity } from "../src/lib/store/activity";
import { productCreateSchema } from "../src/lib/store/schemas";
import { getCommercePolicy } from "../src/lib/storefront-theme";

async function main() {
const directory = "docs/products/the-look";
const product = JSON.parse(await readFile(`${directory}/product.json`, "utf8"));
const review = JSON.parse(await readFile(`${directory}/review-data.json`, "utf8"));
const token = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const input = productCreateSchema.parse({ ...product, variants: review.colors.flatMap((color: {name:string}) =>
  review.candidateSizes.map((size: string) => ({
    sku: `the-look-cc1717-${token(color.name)}-${token(size)}`,
    options: { color: color.name, size }, priceCents: review.priceProposalCents[size],
    currency: "USD", provider: "PRINTIFY", inStock: false,
  }))) });
if (input.isActive || input.isFeatured || input.variants.some(v => v.inStock || v.providerVariantId)) throw new Error("Draft safety invariant failed");
const artwork = await readFile(review.artwork.approvedUpscaled);
if (createHash("sha256").update(artwork).digest("hex") !== "604b162e884cf38f3d8a92bd333cf989507f0fadfb61417270867a5c1eee12d2") throw new Error("Approved artwork changed");
await mkdir(".local", { recursive: true });
await writeFile(".local/the-look-api-payload.json", JSON.stringify(input, null, 2));
if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({mode:"dry-run", variantCount:input.variants.length, isActive:input.isActive, providerIds:"absent; verification required"}));
} else {
  try {
    const store = await prisma.store.findUnique({ where: {domain:review.storeDomain} });
    if (!store || store.domain !== "shihtshirts.com" || store.slug !== "shihtshirt") throw new Error("Expected ShihTshirts tenant not found; stop for review");
    const existing = await prisma.product.findUnique({where:{storeId_slug:{storeId:store.id,slug:input.slug}}});
    if (existing) {
      if (existing.isActive) throw new Error("Existing product is active; refusing to overwrite");
      console.log(JSON.stringify({mode:"existing-no-change",productId:existing.id}));
    } else {
      // Actual tenant slug is singular; never rely on a slug-default commerce policy.
      const theme = (store.theme ?? {}) as Record<string, unknown>;
      const closedStore = await updateStoreBrand(store.id, {theme:{...theme,commerce:{checkoutEnabled:false,fulfillmentMode:"manual"}}}, "agent");
      const policy = getCommercePolicy(closedStore);
      if (policy.checkoutEnabled || policy.fulfillmentMode !== "manual") throw new Error("Commerce must be closed/manual");
      const preview = await sharp(artwork).resize(1600,1600,{fit:"inside",withoutEnlargement:true}).png().toBuffer();
      const asset = await uploadStoreAsset(store.id, {kind:"product-artwork-preview",data:preview,mimeType:"image/png"}, "agent");
      const created = await createProduct(store.id, {...input,images:[{url:`https://${store.domain}${asset.url}`,altText:"Approved The Look artwork — design preview only, not a garment mockup"}]}, "agent");
      await logActivity(store.id,{actor:"agent",category:"product-review",summary:"The Look inactive review draft; supplier evidence required before release",details:{productId:created.id,plannedVariants:35,provider:"PRINTIFY",providerIdsVerified:false,mockupsVerified:false,seo:review.seo,sourceArtwork:review.artwork.approvedUpscaled}});
      const saved = await getProductBySlug(store.id,input.slug);
      if (saved.isActive || saved.variants.some(v=>v.inStock || v.providerVariantId)) throw new Error("Persisted draft safety check failed");
      const receipt = {productId:saved.id,storeId:store.id,storeSlug:store.slug,domain:store.domain,slug:saved.slug,isActive:saved.isActive,variantCount:saved.variants.length,allVariantsUnavailable:saved.variants.every(v=>!v.inStock),allSupplierIdsAbsent:saved.variants.every(v=>!v.providerVariantId),commerce:policy,adminUrl:`https://${store.domain}/admin/products/${saved.id}`,mockupAdminUrl:`https://${store.domain}/admin/products/${saved.id}/mockups`,publicProductExpected:"404 while inactive",mockups:0,artworkPreview:asset.url};
      await writeFile(`${directory}/draft-receipt.json`,JSON.stringify(receipt,null,2)+"\n");
      console.log(JSON.stringify(receipt));
    }
  } finally { await prisma.$disconnect(); }
}
}
main().catch(() => { console.error("The Look draft operation failed; inspect configuration and tenant safety checks. No credentials are logged."); process.exitCode=1; });
