import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { prepareFactoryBatch } from '../../src/lib/design/factory.ts';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
let products, assets, events, sequence, failWrite;
const art = await sharp({create:{width:40,height:60,channels:4,background:{r:255,g:0,b:0,alpha:.7}}}).png().toBuffer();
const blank = await sharp({create:{width:120,height:160,channels:3,background:'#eeeeee'}}).png().toBuffer();
const seed=JSON.parse(readFileSync('docs/design-factory/the-look.json','utf8'));
const manifest=prepareFactoryBatch(seed.brief,seed.styles);
manifest.candidates[0].preview={file:'fixture.png',sha256:digest(art),width:40,height:60};
const store={id:'store-a',slug:manifest.brief.storeSlug};
const version={id:manifest.candidates[0].id,parentId:null,candidateId:manifest.candidates[0].id,prompt:manifest.candidates[0].prompt,rationale:'Imported',preserved:[],feedback:'',decision:'keep',createdAt:'2026-11-07',image:`data:image/png;base64,${art.toString('base64')}`,placements:{'comfort-colors-1717':{version:1,x:.5,y:.5,scale:.8}}};
const profile={storeSlug:store.slug,productType:'comfort-colors-1717',provider:'unverified',printAreaId:'front',baseImageUrl:'/api/assets/base',mockup:{width:120,height:160},canvas:{width:4494,height:5097},mapping:{x:.2,y:.2,width:.6,height:.6}};
const settings={title:'Review title',description:'Review description',priceCents:3200,colors:['Ivory']};
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
    if(data.factorySourceKey && products.some(v=>v!==p&&v.factorySourceKey===data.factorySourceKey))throw Object.assign(new Error('duplicate'),{code:'P2002'});
    Object.assign(p,{...data,images:data.images?.create??p.images,variants:data.variants?.create?.map(v=>({...v,providerVariantId:null}))??p.variants});return p;
  },
};
const db={product,storeAsset:{async findFirst({where}){return assets.find(p=>match(p,where))??null;},async create({data}){if(failWrite)throw new Error('write failed');const a={...data,id:`asset-${++sequence}`};assets.push(a);return a;}},mockupScene:{async findUnique({where}){assert.equal(where.storeId_productType.storeId,store.id);return {baseImages:{Ivory:'/api/assets/base'}};}},activityLogEntry:{async create({data}){assert.equal(data.storeId,store.id);events.push(data);return data;}},productVariant:{async count(){return 0;},async deleteMany({where}){assert.equal(where.storeId,store.id);}}};
let queue=Promise.resolve();
globalThis.prisma={...db,async $transaction(run){
  const previous=queue;let release;queue=new Promise(resolve=>{release=resolve;});await previous;
  const saved=structuredClone({products,assets,events});
  try{return await run(db);}catch(e){({products,assets,events}=saved);throw e;}finally{release();}
}};
globalThis.fetch=async()=>{throw new Error('No network/provider calls allowed');};
const {createFactoryDraft,updateFactoryDraft}=await import('../../src/lib/store/factory-draft.ts');
const {updateProduct}=await import('../../src/lib/store/products.ts');
beforeEach(()=>{products=[];assets=[{id:'base',storeId:store.id,data:blank}];events=[];sequence=0;failWrite=false;});
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
  assert.match(r.product.images[0].altText,/Not Printify verified/);
  assert.ok(events.every(e=>e.actor==='admin'));assert.equal(events.length,2);
});
test('sequential duplicates return existing draft without new assets or overwritten copy',async()=>{
  const a=await createFactoryDraft(store,input(),'agent');
  const b=await createFactoryDraft(store,{...input(),settings:{...settings,title:'Changed request'}},'agent');
  assert.equal(a.product.id,b.product.id);assert.equal(b.reused,true);assert.equal(b.product.title,'Review title');assert.equal(products.length,1);assert.equal(assets.length,3);
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
  assert.equal(results.filter(r=>r.reused).length,1);assert.equal(products.length,1);assert.equal(assets.length,3);assert.equal(events.length,2);
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
