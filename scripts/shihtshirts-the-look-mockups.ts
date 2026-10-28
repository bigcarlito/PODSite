// Uses the existing PODSite compositor and tenant-scoped scene/product operations.
// Default: local previews only. --apply configures the target scene and attaches images.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { compositeDesignOnScene } from "../src/lib/design/compositor";
import { designAreaSchema, aiMockupGenerateSchema } from "../src/lib/store/schemas";
import { prisma } from "../src/lib/prisma";
import { setMockupScene, setMockupSceneBaseImage, setDesignArea } from "../src/lib/store/mockup-scenes";
import { generateAIProductMockups } from "../src/lib/store/ai-mockups";
import { getProductById } from "../src/lib/store/products";
import { uploadStoreAsset } from "../src/lib/store/assets";
import { getCommercePolicy } from "../src/lib/storefront-theme";
import { logActivity } from "../src/lib/store/activity";

const digest = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const dataUrl = (type: string, bytes: Buffer) => `data:${type};base64,${bytes.toString("base64")}`;
const templateRoot = "public/mockup-templates/comfort-colors-1717";
const outputRoot = ".local/the-look/mockups";
const productId = "cmvnb5ci00007xcukkw33n8pj";
const origin = "https://shihtshirts.com";
const names = ["Ivory", "Blossom", "Butter", "Bay", "Espresso"];

async function main() {
  const manifest = z.object({
    garment: z.literal("Comfort Colors 1717"), productType: z.literal("comfort-colors-1717"),
    designArea: designAreaSchema,
    colors: z.array(z.object({name:z.string(),file:z.string().regex(/^[a-z]+\.jpg$/),hex:z.string(),sha256:z.string(),sourceUrl:z.string().url(),width:z.number(),height:z.number()})).length(5),
  }).parse(JSON.parse(await readFile(`${templateRoot}/manifest.json`, "utf8")));
  if (names.some((name,i)=>manifest.colors[i].name!==name)) throw new Error("Unexpected template colors/order");
  const area = manifest.designArea;
  if (area.x+area.width>1 || area.y+area.height>1 || area.width<=0 || area.height<=0) throw new Error("Invalid placement rectangle");
  const artwork = await readFile("public/designs/shihtshirts/the-look-upscaled.png");
  const artworkHash = digest(artwork);
  if (artworkHash!=="604b162e884cf38f3d8a92bd333cf989507f0fadfb61417270867a5c1eee12d2") throw new Error("Approved artwork changed");
  await mkdir(outputRoot,{recursive:true});
  const previewResults=[];
  const baseBytes=new Map<string,Buffer>();
  for (const color of manifest.colors) {
    const bytes=await readFile(`${templateRoot}/${color.file}`);
    if (digest(bytes)!==color.sha256) throw new Error(`Template changed: ${color.name}`);
    const meta=await sharp(bytes).metadata();
    if (meta.width!==1000 || meta.height!==1250) throw new Error("Expected matched 1000x1250 template framing");
    baseBytes.set(color.name,bytes);
    const rendered=await compositeDesignOnScene({baseImageUrl:dataUrl("image/jpeg",bytes),designUrl:dataUrl("image/png",artwork),area});
    await writeFile(`${outputRoot}/${color.file}`,rendered.data);
    previewResults.push({color:color.name,file:`mockups/${color.file}`,sha256:digest(rendered.data),sourceBaseSha256:color.sha256,width:1000,height:1250});
  }
  await writeFile(`${outputRoot}/render-manifest.json`,JSON.stringify({artworkHash,designArea:area,compositor:"src/lib/design/compositor.ts",opacity:0.85,baseRecoloring:false,clothWarping:false,results:previewResults},null,2)+"\n");
  if (!process.argv.includes("--apply")) {console.log("Rendered five local previews with the existing compositor. No database changes.");return;}
  try {
    const store=await prisma.store.findUnique({where:{domain:"shihtshirts.com"}});
    if (!store || store.id!=="cmv4ltgcl0000mv0xwdfdvzg3" || store.slug!=="shihtshirt") throw new Error("Tenant guard failed");
    const before=await getProductById(store.id,productId);
    const policy=getCommercePolicy(store);
    if (before.isActive || before.variants.length!==35 || before.variants.some(v=>v.inStock || v.providerVariantId) || before.productType!==manifest.productType || policy.checkoutEnabled || policy.fulfillmentMode!=="manual") throw new Error("Draft safety guard failed");
    const variantsHash=digest(JSON.stringify([...before.variants].sort((a,b)=>a.id.localeCompare(b.id))));
    const existing=await prisma.mockupScene.findUnique({where:{storeId_productType:{storeId:store.id,productType:manifest.productType}}});
    if (existing) throw new Error("A scene already exists: inspect it before replacing any assets; use the existing API to regenerate from verified bases");
    await setMockupScene(store,manifest.productType,{data:baseBytes.get("Ivory")!,mimeType:"image/jpeg"},"agent",origin,manifest.colors.map(({name,hex})=>({name,hex})));
    await setDesignArea(store.id,manifest.productType,area,"agent");
    for(const color of manifest.colors) await setMockupSceneBaseImage(store,manifest.productType,color.name,{data:baseBytes.get(color.name)!,mimeType:"image/jpeg"},"agent",origin);
    const master=await uploadStoreAsset(store.id,{kind:"design-master",data:artwork,mimeType:"image/png"},"agent");
    const input=aiMockupGenerateSchema.parse({designUrl:origin+master.url,colorOptionName:"color",colors:names,existingBasesOnly:true,primaryColor:"Ivory"});
    const result=await generateAIProductMockups(store,productId,input,"agent",origin);
    if(result.failed.length || result.rendered.length!==5) throw new Error("Not all five mockups rendered; inspect the returned gallery and activity before retrying");
    const after=result.product;
    if(after.isActive || variantsHash!==digest(JSON.stringify([...after.variants].sort((a,b)=>a.id.localeCompare(b.id))))) throw new Error("Product/variant safety verification failed");
    if((after.images[0].optionValues as Record<string,string>)?.color!=="Ivory") throw new Error("Primary image verification failed");
    for(const preview of previewResults) {
      const image=after.images.find(image=>(image.optionValues as Record<string,string> | null)?.color===preview.color);
      if(!image) throw new Error(`Missing color association: ${preview.color}`);
      const response=await fetch(origin+image.url);
      if(!response.ok || digest(Buffer.from(await response.arrayBuffer()))!==preview.sha256) throw new Error(`Stored mockup differs from approved local composite: ${preview.color}`);
    }
    await logActivity(store.id,{actor:"agent",category:"product-review",summary:"The Look: five local composites on labeled S&S Comfort Colors 1717 blanks; owner review required",details:{productId,source:"S&S Activewear 1717 catalog front images",templateManifest:`${templateRoot}/manifest.json`,artworkHash,baseRecoloring:false,primaryColor:"Ivory",supplierVariantPlaceholdersUnchanged:true}});
    const receipt={productId,storeId:store.id,productType:manifest.productType,isActive:after.isActive,variantCount:after.variants.length,variantsUnchanged:true,commerce:policy,primaryColor:"Ivory",masterAsset:master.url,artworkHash,rendered:result.rendered,images:after.images.map(({id,url,position,optionValues})=>({id,url,position,optionValues})),source:"S&S Activewear catalog blanks; composited locally by PODSite",printifyGenerationUsed:false};
    await writeFile(".local/the-look/mockup-receipt.json",JSON.stringify(receipt,null,2)+"\n");
    console.log(JSON.stringify(receipt));
  } finally {await prisma.$disconnect();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Mockup operation failed");process.exitCode=1;});
