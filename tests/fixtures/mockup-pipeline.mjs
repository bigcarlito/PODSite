// No real DB or provider network access: every persistence method and fetch is stubbed.
import {test,mock,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {compositeDesignOnScene} from '../../src/lib/design/compositor.ts';

const unstubbed=()=>{throw new Error('Unstubbed persistence is forbidden');};
const prisma={product:{findFirst:unstubbed},mockupScene:{findUnique:unstubbed},storeAsset:{create:unstubbed},activityLogEntry:{create:unstubbed},$transaction:unstubbed};
globalThis.prisma=prisma; // Existing client singleton injection, before store modules load.
const {generateAIProductMockups}=await import('../../src/lib/store/ai-mockups.ts');

afterEach(()=>mock.restoreAll());
const store={id:'store-a'};
const input={designUrl:'https://fixture.test/design.png',colorOptionName:'color',existingBasesOnly:true,primaryColor:'Bay'};
async function fixture({missing=false,invalidBase=false,failPrimary=false,wrongTenant=false}={}) {
  let images=[{id:'art',productId:'product-a',url:'https://fixture.test/api/assets/art',position:0,optionValues:null}];
  const calls={fetch:0,assets:0,transactions:0};
  const base=await sharp({create:{width:100,height:100,channels:4,background:'#eeeeee'}}).png().toBuffer();
  const design=await sharp({create:{width:40,height:20,channels:4,background:'#cc3300'}}).png().toBuffer();
  mock.method(globalThis,'fetch',async url=>{
    calls.fetch++;
    assert(String(url).startsWith('https://fixture.test/'),'No provider requests permitted');
    if(failPrimary&&String(url).includes('bay'))return new Response(null,{status:503});
    return new Response(String(url).includes('design')?design:base);
  });
  mock.method(prisma.product,'findFirst',async ({where})=>{
    assert.equal(where.storeId,'store-a');
    return wrongTenant?null:{id:'product-a',title:'Fixture',productType:'1717',variants:[{options:{color:'Ivory',size:'S'}},{options:{color:'Ivory',size:'M'}},{options:{color:'Bay',size:'S'}}],images:[...images].sort((a,b)=>a.position-b.position)};
  });
  mock.method(prisma.mockupScene,'findUnique',async ({where})=>{
    assert.equal(where.storeId_productType.storeId,'store-a');
    return {id:'scene-a',colors:[{name:'Ivory'},{name:'Bay'}],baseImages:missing?{Ivory:'https://fixture.test/ivory.jpg'}:{Ivory:'https://fixture.test/ivory.jpg',Bay:invalidBase?'https://':'https://fixture.test/bay.jpg'},designArea:{x:.2,y:.2,width:.5,height:.5}};
  });
  mock.method(prisma.storeAsset,'create',async ({data})=>{calls.assets++;assert.equal(data.storeId,'store-a');return {id:'asset-'+calls.assets,mimeType:data.mimeType};});
  mock.method(prisma.activityLogEntry,'create',async ({data})=>{assert.equal(data.storeId,'store-a');return {};});
  mock.method(prisma,'$transaction',async action=>{
    calls.transactions++;
    const scoped=where=>{assert.equal(where.productId,'product-a');assert.equal(where.product.storeId,'store-a');};
    return action({productImage:{
      findMany:async ({where})=>{scoped(where);return [...images];},
      deleteMany:async ({where})=>{scoped(where);images=images.filter(i=>!where.id.in.includes(i.id));},
      updateMany:async ({where,data})=>{scoped(where);Object.assign(images.find(i=>i.id===where.id),data);},
      createMany:async ({data})=>{for(const row of data){assert.equal(row.productId,'product-a');images.push({...row,id:'image-'+images.length});}},
    }});
  });
  return {calls,images:()=>images};
}
test('missing verified base fails before any fetch, recolor or persistence',async()=>{
  const f=await fixture({missing:true});
  await assert.rejects(generateAIProductMockups(store,'product-a',input,'agent','https://fixture.test'),{code:'MISSING_MOCKUP_BASE'});
  assert.deepEqual(f.calls,{fetch:0,assets:0,transactions:0});
});
test('invalid primary fails before rendering',async()=>{
  const f=await fixture();
  await assert.rejects(generateAIProductMockups(store,'product-a',{...input,primaryColor:'Black'},'agent','https://fixture.test'),{code:'INVALID_PRIMARY_COLOR'});
  assert.equal(f.calls.fetch,0);
});
test('malformed cached URLs fail before any fetch or persistence',async()=>{
  const f=await fixture({invalidBase:true});
  await assert.rejects(generateAIProductMockups(store,'product-a',input,'agent','https://fixture.test'),{code:'MISSING_MOCKUP_BASE'});
  assert.deepEqual(f.calls,{fetch:0,assets:0,transactions:0});
});
test('one render per color, correct color mapping and non-destructive primary promotion',async()=>{
  const f=await fixture();
  const result=await generateAIProductMockups(store,'product-a',input,'agent','https://fixture.test');
  assert.equal(result.rendered.length,2);
  assert.equal(result.failed.length,0);
  assert.equal(f.calls.assets,2);
  assert.equal(result.product.images[0].optionValues.color,'Bay');
  assert.equal(result.product.images[1].optionValues.color,'Ivory');
  assert.equal(result.product.images[2].id,'art');
  assert.equal(result.product.images[2].url,'/api/assets/art');
  assert.equal(f.calls.transactions,1);
});
test('a failed requested primary cannot replace the gallery',async()=>{
  const f=await fixture({failPrimary:true});
  await assert.rejects(generateAIProductMockups(store,'product-a',input,'agent','https://fixture.test'),{code:'PRIMARY_MOCKUP_FAILED'});
  assert.equal(f.calls.transactions,0);
  assert.deepEqual(f.images().map(i=>i.id),['art']);
});
test('a product outside the requested tenant cannot reach rendering or persistence',async()=>{
  const f=await fixture({wrongTenant:true});
  await assert.rejects(generateAIProductMockups(store,'other-product',input,'agent','https://fixture.test'),{code:'NOT_FOUND'});
  assert.deepEqual(f.calls,{fetch:0,assets:0,transactions:0});
});
test('existing compositor centers without stretching and retains transparent regions',async()=>{
  const base=await sharp({create:{width:100,height:100,channels:4,background:'#0000ff'}}).png().toBuffer();
  const raw=Buffer.alloc(40*20*4);
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){const i=(y*40+x)*4;raw[i]=255;raw[i+3]=255;}
  const art=await sharp(raw,{raw:{width:40,height:20,channels:4}}).png().toBuffer();
  const url=bytes=>'data:image/png;base64,'+bytes.toString('base64');
  const result=await compositeDesignOnScene({baseImageUrl:url(base),designUrl:url(art),area:{x:.25,y:.25,width:.4,height:.4},opacity:1});
  const {data,info}=await sharp(result.data).raw().toBuffer({resolveWithObject:true});
  const pixel=(x,y)=>data.subarray((y*info.width+x)*3,(y*info.width+x)*3+3);
  assert.equal(info.width,100);assert.equal(info.height,100);
  assert(pixel(30,40)[0]>200); // opaque art, centered vertically at y=35..54
  assert(pixel(30,28)[2]>200); // letterbox above the short artwork remains blue
  assert(pixel(57,40)[2]>200); // transparent right half remains blue
});

test('durable mockups isolate tenant/product/color and never overwrite prior renders',async()=>{
  const {uploadStoreAsset,getStoreAsset}=await import('../../src/lib/store/assets.ts');
  const rows=new Map();
  mock.method(prisma.product,'findFirst',async({where})=>where.storeId==='store-a'&&where.id==='product-a'?{id:where.id}:null);
  mock.method(prisma.storeAsset,'create',async({data})=>{assert(!rows.has(data.id));rows.set(data.id,structuredClone(data));return data;});
  prisma.storeAsset.findUnique=async({where})=>rows.get(where.id)??null;
  mock.method(prisma.activityLogEntry,'create',async()=>({}));
  const save=color=>uploadStoreAsset('store-a',{kind:'ai-mockup',data:Buffer.from('persisted'),mimeType:'image/jpeg',mockup:{productId:'product-a',color}},'agent');
  const assets=await Promise.all(['Blue/Green','Blue-Green','Blue/Green'].map(save));
  assert.equal(new Set(assets.map(a=>a.url)).size,3);
  for(const asset of assets){assert.equal(asset.url,`/api/assets/${asset.id}`);assert.equal(Buffer.from((await getStoreAsset(asset.id)).data).toString(),'persisted');}
  for(const [storeId,productId] of [['store-b','product-a'],['store-a','product-b']])await assert.rejects(uploadStoreAsset(storeId,{kind:'ai-mockup',data:Buffer.from('x'),mimeType:'image/jpeg',mockup:{productId,color:'Ivory'}},'agent'),{code:'NOT_FOUND'});
  await assert.rejects(getStoreAsset('missing'),{code:'NOT_FOUND'});
  assert.equal(rows.size,3);
});
