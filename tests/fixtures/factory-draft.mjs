import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { prepareFactoryBatch } from '../../src/lib/design/factory.ts';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
let products, assets, events, sequence, failWrite, baseUrl, extraBases;
const art = await sharp({create:{width:40,height:60,channels:4,background:{r:255,g:0,b:0,alpha:.7}}}).png().toBuffer();
const blank = await sharp({create:{width:120,height:160,channels:3,background:'#eeeeee'}}).png().toBuffer();
const seed=JSON.parse(readFileSync('docs/design-factory/the-look.json','utf8'));
const manifest=prepareFactoryBatch(seed.brief,seed.styles);
manifest.candidates[0].preview={file:'fixture.png',sha256:digest(art),width:40,height:60};
const store={id:'store-a',slug:manifest.brief.storeSlug,theme:{commerce:{checkoutEnabled:false,fulfillmentMode:'manual'}}};
const version={id:manifest.candidates[0].id,parentId:null,candidateId:manifest.candidates[0].id,prompt:manifest.candidates[0].prompt,rationale:'Imported',preserved:[],feedback:'',decision:'keep',createdAt:'2026-11-07',image:`data:image/png;base64,${art.toString('base64')}`,placements:{'comfort-colors-1717':{version:1,x:.5,y:.5,scale:.8}}};
const profile={storeSlug:store.slug,productType:'comfort-colors-1717',provider:'unverified',printAreaId:'front',baseImageUrl:'/api/assets/base',mockup:{width:120,height:160},canvas:{width:4494,height:5097},mapping:{x:.2,y:.2,width:.6,height:.6}};
const settings={productType:'comfort-colors-1717',title:'Review title',description:'Review description',priceCents:3200,colors:['Ivory']};
const input=()=>structuredClone({manifest,version,printAreas:[profile],settings});
const match=(p,w)=>Object.entries(w).every(([k,v])=>p[k]===v);
const product={
  async findUnique({where}){return products.find(p=>match(p,where.storeId_slug))??null;},
  async findFirst({where}){return products.find(p=>match(p,where))??null;},
  async create({data}){
    const p={...data,id:`product-${++sequence}`,variants:data.variants.create.map((v,i)=>({...v,id:`variant-${i}`,providerVariantId:null})),images:[]};products.push(p);return p;
  },
  async update({where,data}){
    assert.equal(where.storeId,store.id);
    const p=products.find(p=>match(p,where));
    if(data.variants?.updateMany) assert.equal(data.variants.updateMany.where.storeId,store.id);
    if(data.factorySourceKey && products.some(v=>v!==p&&v.factorySourceKey===data.factorySourceKey))throw Object.assign(new Error('duplicate'),{code:'P2002'});
    Object.assign(p,{...data,images:data.images?.create??p.images,variants:data.variants?.create?.map(v=>({...v,providerVariantId:null}))??(data.variants?.updateMany ? p.variants.map(v=>({...v,...data.variants.updateMany.data})) : p.variants)});return p;
  },
};
const db={product,storeAsset:{async findFirst({where}){return assets.find(p=>match(p,where))??null;},async create({data}){if(failWrite)throw new Error('write failed');const a={...data,id:`asset-${++sequence}`};assets.push(a);return a;}},mockupScene:{async findUnique({where}){assert.equal(where.storeId_productType.storeId,store.id);return {baseImages:{Ivory:baseUrl,...extraBases}};}},activityLogEntry:{async create({data}){assert.equal(data.storeId,store.id);events.push(data);return data;}},productVariant:{async count(){return 0;},async deleteMany({where}){assert.equal(where.storeId,store.id);}}};
let queue=Promise.resolve();
globalThis.prisma={...db,async $transaction(run){
  const previous=queue;let release;queue=new Promise(resolve=>{release=resolve;});await previous;
  const saved=structuredClone({products,assets,events});
  try{return await run(db);}catch(e){({products,assets,events}=saved);throw e;}finally{release();}
}};
globalThis.fetch=async()=>{throw new Error('No network/provider calls allowed');};
const {createFactoryDraft,updateFactoryDraft}=await import('../../src/lib/store/factory-draft.ts');
const {updateProduct}=await import('../../src/lib/store/products.ts');
const {compositeDesignOnScene}=await import('../../src/lib/design/compositor.ts');
const {DEFAULT_PLACEMENT}=await import('../../src/lib/design/placement.ts');
const {publishProduct,unpublishProduct}=await import('../../src/lib/store/product-publication.ts');
beforeEach(()=>{extraBases={};baseUrl='/api/assets/base';products=[];assets=[{id:'base',storeId:store.id,data:blank}];events=[];sequence=0;failWrite=false;});
test('only kept rendered designs qualify and tenant mismatch cannot write',async()=>{
  await assert.rejects(createFactoryDraft({...store,slug:'foreign'},input(),'agent'),{code:'STORE_MISMATCH'});
  for(const decision of ['pending','reject','refine'])await assert.rejects(createFactoryDraft(store,{...input(),version:{...version,decision}},'admin'),{code:'KEEP_REQUIRED'});
  await assert.rejects(createFactoryDraft(store,{...input(),version:{...version,image:undefined}},'admin'),{code:'KEEP_REQUIRED'});
  assert.equal(products.length,0);assert.equal(assets.length,1);
});
test('draft retains exact artwork provenance, placement/calibration and labeled composites',async()=>{
  const r=await createFactoryDraft(store,input(),'admin');
  assert.equal(r.product.isActive,false);assert.equal(r.product.isFeatured,false);assert.equal(r.product.variants.length,4);
  assert.ok(r.product.variants.every(v=>!v.inStock&&v.providerVariantId===null&&v.provider==='PRINTIFY'));
  assert.equal(r.product.factoryDraft.artworkHash,digest(art));
  assert.deepEqual(r.product.factoryDraft.version.placements,version.placements);
  assert.deepEqual(r.product.factoryDraft.printAreas,[profile]);
  assert.equal(r.product.factoryDraft.ready,false);
  assert.deepEqual(Buffer.from(assets.find(a=>a.kind==='factory-preview-artwork').data),art);
  assert.match(r.product.images[0].altText,/Ivory/);
  const master=assets.find(a=>a.kind==='design-master');
  const dimensions=await sharp(master.data).metadata();
  assert.equal(dimensions.width,profile.canvas.width);assert.equal(dimensions.height,profile.canvas.height);
  assert.equal(dimensions.hasAlpha,true);
  assert.equal(r.product.factoryDraft.master.sha256,digest(Buffer.from(master.data)));
  assert.equal(r.product.factoryDraft.master.method,'lanczos3');
  const expected=await compositeDesignOnScene({baseImageUrl:'',baseImageData:blank,designUrl:'',designData:Buffer.from(master.data),area:profile.mapping,placement:DEFAULT_PLACEMENT,printCanvas:profile.canvas});
  assert.deepEqual(Buffer.from(assets.find(a=>a.kind==='factory-preview-composite').data),expected.data);

  assert.ok(events.every(e=>e.actor==='admin'));assert.equal(events.length,2);
});
test('sequential duplicates return existing draft without new assets or overwritten copy',async()=>{
  const a=await createFactoryDraft(store,input(),'agent');
  const b=await createFactoryDraft(store,{...input(),settings:{...settings,title:'Changed request'}},'agent');
  assert.equal(a.product.id,b.product.id);assert.equal(b.reused,true);assert.equal(b.product.title,'Review title');assert.equal(products.length,1);assert.equal(assets.length,4);
  const changed=input();changed.version.prompt='Changed evidence';await assert.rejects(createFactoryDraft(store,changed,'agent'),{code:'VERSION_CHANGED'});
});
test('hash mismatch, missing lineage and changed placement fail before assets',async()=>{
  const bad=input();bad.manifest.candidates[0].preview.sha256='0'.repeat(64);await assert.rejects(createFactoryDraft(store,bad,'agent'),{code:'ARTWORK_HASH_MISMATCH'});
  await assert.rejects(createFactoryDraft(store,{...input(),version:{...version,parentId:'missing'}},'agent'),{code:'INVALID_LINEAGE'});
  const moved=input();moved.version.placements['comfort-colors-1717'].x=0;await assert.rejects(createFactoryDraft(store,moved,'agent'),{code:'PLACEMENT_CHANGED'});
  assert.equal(assets.length,1);
});
test('foreign base and missing calibration fail closed without provider fallback',async()=>{
  assets[0].storeId='store-b';await assert.rejects(createFactoryDraft(store,input(),'agent'),{code:'BASE_REQUIRED'});
  assets[0].storeId=store.id;await assert.rejects(createFactoryDraft(store,{...input(),printAreas:[]},'agent'),{code:'CALIBRATION_REQUIRED'});
  assert.equal(products.length,0);
});
test('asset persistence failure rolls back and retry can create exactly one draft',async()=>{
  failWrite=true;await assert.rejects(createFactoryDraft(store,input(),'agent'),/write failed/);
  assert.equal(products.length,0);assert.equal(assets.length,1);assert.equal(events.length,0);
  failWrite=false;await createFactoryDraft(store,input(),'agent');assert.equal(products.length,1);
});
test('draft editor is tenant scoped and preserves source evidence while editing price and copy',async()=>{
  const r=await createFactoryDraft(store,input(),'agent');const before=structuredClone(r.product.factoryDraft);
  await assert.rejects(updateFactoryDraft({...store,id:'store-b'},r.product.id,{...settings},'agent'),{code:'NOT_FOUND'});
  const edited=await updateFactoryDraft(store,r.product.id,{...settings,title:'Owner copy',priceCents:3500},'admin');
  assert.equal(edited.product.title,'Owner copy');assert.equal(edited.product.variants[0].priceCents,3500);assert.deepEqual(edited.product.factoryDraft,before);
  await assert.rejects(updateFactoryDraft(store,r.product.id,{...settings,productType:'other'},'admin'),{code:'REVIEW_GARMENT_FIRST'});
});
test('normal product update cannot activate, feature or verify Factory variants',async()=>{
  const r=await createFactoryDraft(store,input(),'agent');
  for(const change of [{isActive:true},{isFeatured:true},{variants:[{inStock:true}]}]) await assert.rejects(updateProduct(store.id,r.product.id,change,'agent'),{code:'FACTORY_DRAFT_ONLY'});
});

test('concurrent duplicate handoffs return one product and one immutable asset set',async()=>{
  const results=await Promise.all([createFactoryDraft(store,input(),'agent'),createFactoryDraft(store,input(),'agent')]);
  assert.equal(results[0].product.id,results[1].product.id);
  assert.equal(results.filter(r=>r.reused).length,1);assert.equal(products.length,1);assert.equal(assets.length,4);assert.equal(events.length,2);
});

test('invalid PNG, invisible artwork and ambiguous ancestry fail before persistence', async()=>{
  const malformed=input();
  const bytes=Buffer.from('not a PNG');
  malformed.version.image=`data:image/png;base64,${bytes.toString('base64')}`;
  malformed.manifest.candidates[0].preview.sha256=digest(bytes);
  await assert.rejects(createFactoryDraft(store,malformed,'agent'),{code:'INVALID_ARTWORK'});
  const empty=await sharp({create:{width:40,height:60,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toBuffer();
  const invisible=input();invisible.version.image=`data:image/png;base64,${empty.toString('base64')}`;invisible.manifest.candidates[0].preview.sha256=digest(empty);
  await assert.rejects(createFactoryDraft(store,invisible,'agent'),{code:'INVALID_ARTWORK'});
  const duplicate=input();duplicate.manifest.candidates.push(structuredClone(duplicate.manifest.candidates[0]));
  // Manifest has a maximum of five candidates, so replace rather than extend.
  duplicate.manifest.candidates.pop();duplicate.manifest.candidates[1]=structuredClone(duplicate.manifest.candidates[0]);
  await assert.rejects(createFactoryDraft(store,duplicate,'agent'),{code:'INVALID_LINEAGE'});
  assert.equal(products.length,0);assert.equal(assets.length,1);
});

test('child handoff preserves ancestry and requires current Keep history and hash', async()=>{
  const child=input();
  const {image, ...ancestor}=child.version;
  assert.equal(image,version.image);
  child.ancestors=[ancestor];
  child.version={...child.version,id:'child-1',parentId:ancestor.id,provenance:{sha256:digest(art),provider:'fixture',model:'unverified'},decisions:[{decision:'keep',at:'2026-11-07'}]};
  const saved=await createFactoryDraft(store,child,'admin');
  assert.equal(saved.product.factoryDraft.version.parentId,ancestor.id);
  assert.deepEqual(saved.product.factoryDraft.ancestors,[ancestor]);
  const stale=structuredClone(child);stale.version.decisions.push({decision:'reject',at:'2026-11-08'});
  await assert.rejects(createFactoryDraft(store,stale,'agent'),{code:'KEEP_REQUIRED'});
  const changed=structuredClone(child);changed.version.provenance.sha256='0'.repeat(64);
  await assert.rejects(createFactoryDraft(store,changed,'agent'),{code:'ARTWORK_HASH_MISMATCH'});
  for(const change of [{images:[]},{optionNames:['size']},{variants:[{sku:'invented',options:{color:'Red'},priceCents:10,currency:'USD',provider:'PRINTIFY',inStock:false}]}])
    await assert.rejects(updateProduct(store.id,saved.product.id,change,'agent'),{code:'FACTORY_DRAFT_ONLY'});
});

 test('scene identifier must match explicit reviewed placement', async()=>{
  const other=input();other.settings.productType='actual-scene';
  await assert.rejects(createFactoryDraft(store,other,'admin'),{code:'PLACEMENT_REQUIRED'});
  other.version.placements['actual-scene']=other.version.placements['comfort-colors-1717'];
  other.printAreas[0].productType='actual-scene';
  const saved=await createFactoryDraft(store,other,'admin');
  assert.equal(saved.product.productType,'actual-scene');
});


test('absolute scene asset URLs and relative calibrations resolve tenant-owned bytes without fetching', async()=>{
  baseUrl='https://shihtshirts.com/api/assets/base?preview=1';
  const saved=await createFactoryDraft(store,input(),'admin');
  assert.equal(saved.product.images.length,2);
  assert.equal(products.length,1);
});

test('absolute calibration URLs match relative scene assets and preserve ownership checks', async()=>{
  const request=input();
  request.printAreas[0].baseImageUrl='https://shihtshirts.com/api/assets/base';
  assets[0].storeId='store-b';
  await assert.rejects(createFactoryDraft(store,request,'agent'),{code:'BASE_REQUIRED'});
  assets[0].storeId=store.id;
  await createFactoryDraft(store,request,'agent');
  assert.equal(products.length,1);
});

test('external images, malformed URLs and missing asset IDs cannot create a draft', async()=>{
  for(const url of ['https://example.com/blank.png','https://[invalid/api/assets/base','https://shihtshirts.com/api/assets/missing','data:image/png;base64,YQ==']) {
    baseUrl=url;
    await assert.rejects(createFactoryDraft(store,input(),'agent'),{code:'BASE_REQUIRED'});
  }
  assert.equal(products.length,0);
  assert.equal(assets.length,1);
});


test('one reviewed color calibration supplies every selected color using its own photograph dimensions', async()=>{
  extraBases={Blossom:'https://shihtshirts.com/api/assets/blossom'};
  const otherBlank=await sharp({create:{width:240,height:320,channels:3,background:'#f0dddd'}}).png().toBuffer();
  assets.push({id:'blossom',storeId:store.id,data:otherBlank});
  const request=input();
  request.settings.colors=['Ivory','Blossom'];
  // The sole calibration is on Blossom; Ivory has never had a separate profile.
  request.printAreas=[{...profile,baseImageUrl:'/api/assets/blossom',mockup:{width:240,height:320}}];
  const saved=await createFactoryDraft(store,request,'admin');
  const previews=saved.product.factoryDraft.previews;
  assert.equal(previews.length,2);
  assert.deepEqual(previews[0].profile.mockup,{width:120,height:160});
  assert.deepEqual(previews[1].profile.mockup,{width:240,height:320});
  for(const p of previews) {
    assert.deepEqual(p.profile.mapping,profile.mapping);
    assert.deepEqual(p.profile.canvas,profile.canvas);
  }
});

test('shared calibration rejects a stale source photo and ambiguous providers', async()=>{
  const stale=input();stale.printAreas[0].mockup.width=999;
  await assert.rejects(createFactoryDraft(store,stale,'admin'),{code:'STALE_CALIBRATION'});
  const ambiguous=input();ambiguous.printAreas.push({...profile,provider:'another'});
  await assert.rejects(createFactoryDraft(store,ambiguous,'admin'),{code:'CALIBRATION_REQUIRED'});
  assert.equal(products.length,0);
});


test('publish makes factory variants purchasable in manual mode and unpublish preserves orderable variant records',async()=>{
  const draft=await createFactoryDraft(store,input(),'admin');
  const before=assets.length;
  const published=await publishProduct(store,draft.product.id,{},'admin');
  assert.equal(published.product.isActive,true);
  assert.ok(published.product.variants.every(v=>v.inStock&&!v.providerVariantId));
  assert.equal(published.product.images.length,1);
  assert.ok(published.product.images.every(i=>i.optionValues.color));
  assert.equal(published.product.factoryDraft.publication.fulfillmentMode,'manual');
  assert.equal(store.theme.commerce.checkoutEnabled,false);
  assert.equal(assets.length,before);
  const ids=published.product.variants.map(v=>v.id);
  const eventCount=events.length;
  await publishProduct(store,draft.product.id,{},'admin');
  assert.equal(events.length,eventCount);
  const hidden=await unpublishProduct(store,draft.product.id,{},'agent');
  assert.equal(hidden.product.isActive,false);
  assert.deepEqual(hidden.product.variants.map(v=>v.id),ids);
  products[0].variants[0].inStock=false;
  const again=await publishProduct(store,draft.product.id,{},'admin');
  assert.equal(again.product.variants[0].inStock,false);
  const reused=await createFactoryDraft(store,input(),'admin');
  assert.equal(reused.reused,true);assert.equal(reused.product.isActive,true);
});

test('publication checks store ownership, manual mode and listing completeness',async()=>{
  const draft=await createFactoryDraft(store,input(),'admin');
  await assert.rejects(publishProduct({...store,id:'store-b'},draft.product.id,{},'agent'),{code:'NOT_FOUND'});
  await assert.rejects(unpublishProduct({...store,id:'store-b'},draft.product.id,{},'agent'),{code:'NOT_FOUND'});
  await assert.rejects(publishProduct({...store,theme:{commerce:{checkoutEnabled:true,fulfillmentMode:'automatic'}}},draft.product.id,{},'agent'),{code:'MANUAL_FULFILLMENT_REQUIRED'});
  products[0].description='';
  await assert.rejects(publishProduct(store,draft.product.id,{},'admin'),{code:'PRODUCT_INCOMPLETE'});
  assert.equal(products[0].isActive,false);
});

test('publishing a legacy draft upscales the kept bytes and replaces its mockups atomically',async()=>{
  const draft=await createFactoryDraft(store,input(),'admin');
  delete draft.product.factoryDraft.master;
  const before=assets.length;
  const published=await publishProduct(store,draft.product.id,{},'admin');
  assert.equal(published.product.isActive,true);
  assert.ok(published.product.factoryDraft.master.url);
  assert.equal(assets.length,before+2);
  assert.equal(published.product.images.length,1);
  assert.equal(published.product.factoryDraft.artworkHash,digest(art));
});

test('missing master or failed legacy upgrade cannot activate a product',async()=>{
  const draft=await createFactoryDraft(store,input(),'admin');
  const master=assets.find(a=>a.kind==='design-master');master.storeId='other';
  await assert.rejects(publishProduct(store,draft.product.id,{},'admin'),{code:'MASTER_REQUIRED'});
  assert.equal(products[0].isActive,false);
  delete products[0].factoryDraft.master;
  const before=assets.length;failWrite=true;
  await assert.rejects(publishProduct(store,draft.product.id,{},'admin'),/write failed/);
  assert.equal(products[0].isActive,false);assert.equal(assets.length,before);
});

test('normal product publication preserves stock and logs the correct actor',async()=>{
  products.push({id:'ordinary',storeId:store.id,title:'Normal',description:'Description',isActive:false,isFeatured:false,variants:[{id:'normal-v',priceCents:2500,currency:'USD',inStock:false}],images:[{id:'normal-img',url:'/api/assets/test'}]});
  const published=await publishProduct(store,'ordinary',{},'agent');
  assert.equal(published.product.isActive,true);assert.equal(published.product.variants[0].inStock,false);
  assert.equal(events.at(-1).actor,'agent');
  await unpublishProduct(store,'ordinary',{},'admin');
  assert.equal(products[0].isActive,false);assert.equal(events.at(-1).actor,'admin');
});


test('upscale preserves asymmetric alpha placement and transparent canvas padding',async()=>{
  const {upscaleToPrintCanvas}=await import('../../src/lib/design/upscale.ts');
  const {alphaBounds,constrainedPlacement}=await import('../../src/lib/design/placement.ts');
  const rgba=Buffer.alloc(20*30*4);
  for(let y=3;y<22;y++)for(let x=4;x<15;x++)rgba[(y*20+x)*4+3]=255;
  const sourcePng=await sharp(rgba,{raw:{width:20,height:30,channels:4}}).png().toBuffer();
  const original=Buffer.from(sourcePng);
  const placement={version:1,x:.65,y:.6,scale:.6};
  const canvas={width:400,height:600};
  const source={width:20,height:30,bounds:alphaBounds(rgba,20,30)};
  const expected=constrainedPlacement(placement,source,canvas);
  const master=await upscaleToPrintCanvas(sourcePng,placement,canvas);
  const {data,info}=await sharp(master.data).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const bounds=alphaBounds(data,info.width,info.height);
  // Lanczos filtering adds a narrow antialiased fringe around the source bounds.
  assert.equal(data[3],0);
  assert.ok(Math.abs(bounds.left-expected.clip.left)<30);
  assert.ok(Math.abs(bounds.top-expected.clip.top)<30);
  assert.ok(Math.abs(bounds.width-(expected.clip.right-expected.clip.left))<60);
  assert.deepEqual(sourcePng,original);
  assert.deepEqual(master.placement,placement);
  assert.equal(info.width,canvas.width);assert.equal(info.height,canvas.height);
  await assert.rejects(upscaleToPrintCanvas(sourcePng,{...placement,x:0},canvas),/containment changes/);
});
