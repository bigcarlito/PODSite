import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareFactoryBatch } from '../../src/lib/design/factory.ts';
const records = new Map();
globalThis.prisma = { activityLogEntry: { async create({data}) {
  assert.equal(data.storeId, 'store-a');
  if (data.id && records.has(data.id)) throw Object.assign(new Error('duplicate'), {code:'P2002'});
  if (data.id) records.set(data.id, data);
  return data;
} } };
const { generateFactoryRevision, refineFactoryPrompt } = await import('../../src/lib/store/factory-review.ts');
const { openRouterImageProvider } = await import('../../src/lib/design/providers/openrouter.ts');
const seed = JSON.parse(readFileSync('docs/design-factory/the-look.json','utf8'));
const manifest = prepareFactoryBatch(seed.brief, seed.styles);
const store = {id:'store-a',slug:manifest.brief.storeSlug};
const version = {id:'child',parentId:manifest.candidates[0].id,candidateId:manifest.candidates[0].id,prompt:'Revised precise image prompt',rationale:'Simplified',preserved:['Lettering'],feedback:'Simplify',decision:'pending',createdAt:'2026-10-31'};
const input = {manifest,version,approvePaidGeneration:true};
afterEach(()=>{mock.restoreAll();records.clear();delete process.env.FACTORY_IMAGE_GENERATION_ENABLED;delete process.env.OPENROUTER_API_KEY;});
test('disabled generation and foreign tenant stop before any provider request',async()=>{
  mock.method(openRouterImageProvider,'generate',async()=>{throw new Error('Forbidden provider call');});
  await assert.rejects(generateFactoryRevision(store,input,'admin'),{code:'GENERATION_DISABLED'});
  await assert.rejects(generateFactoryRevision({...store,slug:'foreign'},input,'admin'),{code:'STORE_MISMATCH'});
  assert.equal(records.size,0);
});
test('generation reserves once before the provider, preserves provenance and blocks duplicate spend',async()=>{
  process.env.FACTORY_IMAGE_GENERATION_ENABLED='true';
  let calls=0;
  mock.method(openRouterImageProvider,'generate',async spec=>{calls++;assert.equal(records.size,1);assert.equal(spec.promptText,version.prompt);return {imageUrl:'data:image/png;base64,YQ==',rawParams:{fixture:true},seed:17};});
  const result=await generateFactoryRevision(store,input,'admin');
  assert.equal(result.provenance.seed,17);assert.equal(result.provenance.sha256.length,64);
  await assert.rejects(generateFactoryRevision(store,input,'admin'),{code:'ATTEMPT_EXISTS'});
  assert.equal(calls,1);
});
test('failed attempt remains reserved; consent is mandatory',async()=>{
  process.env.FACTORY_IMAGE_GENERATION_ENABLED='true';
  mock.method(openRouterImageProvider,'generate',async()=>{throw new Error('fixture failure');});
  await assert.rejects(generateFactoryRevision(store,{...input,approvePaidGeneration:false},'admin'));
  assert.equal(records.size,0);
  await assert.rejects(generateFactoryRevision(store,input,'admin'),{code:'GENERATION_FAILED'});
  await assert.rejects(generateFactoryRevision(store,input,'admin'),{code:'ATTEMPT_EXISTS'});
});
test('prompt revision uses structured LLM response with original prompt and locked aspects',async()=>{
  process.env.OPENROUTER_API_KEY='test-placeholder';
  mock.method(globalThis,'fetch',async(url,opts)=>{
    assert.equal(String(url),'https://openrouter.ai/api/v1/chat/completions');
    const body=JSON.parse(opts.body);assert.ok(body.messages[0].content[0].text.includes(manifest.candidates[0].prompt));
    return Response.json({choices:[{message:{content:JSON.stringify({prompt:'A complete revised apparel artwork prompt',rationale:'Reduced fine fur strokes',preserved:['Exact lettering']})}}]});
  });
  const result=await refineFactoryPrompt(store,{manifest,candidateId:version.candidateId,feedback:'Simplify fur',preserve:'Exact lettering'},'admin');
  assert.equal(result.rationale,'Reduced fine fur strokes');
});

const { saveFactoryCalibration, readCalibrations } = await import('../../src/lib/store/factory-calibration.ts');
const calibration = {storeSlug:store.slug,productType:'cc1717',provider:'operator',printAreaId:'front',baseImageUrl:'/tenant-a.png',mockup:{width:1000,height:1000},canvas:{width:4494,height:5097},mapping:{x:.3,y:.2,width:.4,height:.6}};
test('calibration persists by tenant and photograph and preserves unrelated brief keys',async()=>{
  let row = {...store,brief:{audience:'small dog parents'}};
  globalThis.prisma.$transaction = async (run, options) => {
    assert.equal(options.isolationLevel,'Serializable');
    return run({store:{findUniqueOrThrow:async ({where})=>{assert.equal(where.id,store.id);return structuredClone(row);},update:async ({where,data})=>{assert.equal(where.id,store.id);row={...row,...data};return row;}},mockupScene:{findUnique:async ({where})=>{assert.deepEqual(where.storeId_productType,{storeId:store.id,productType:'cc1717'});return {baseImages:{pepper:'/tenant-a.png'}};}}});
  };
  const saved = await saveFactoryCalibration(store,calibration,'admin');
  assert.deepEqual(saved,calibration);
  assert.equal(row.brief.audience,'small dog parents');
  assert.deepEqual(readCalibrations(JSON.parse(JSON.stringify(row))),[calibration]);
  await saveFactoryCalibration(store,{...calibration,mapping:{...calibration.mapping,y:.1}},'agent');
  assert.equal(readCalibrations(row).length,1);
  assert.equal(readCalibrations(row)[0].mapping.y,.1);
});
test('foreign tenant or photograph cannot save calibration',async()=>{
  let writes=0;
  globalThis.prisma.$transaction = async run => run({store:{findUniqueOrThrow:async()=>({...store,brief:{}}),update:async()=>{writes++;}},mockupScene:{findUnique:async()=>({baseImages:{pepper:'/tenant-a.png'}})}});
  await assert.rejects(saveFactoryCalibration(store,{...calibration,storeSlug:'foreign'},'agent'),{code:'TENANT_MISMATCH'});
  await assert.rejects(saveFactoryCalibration(store,{...calibration,baseImageUrl:'/tenant-b.png'},'agent'),{code:'BASE_NOT_FOUND'});
  assert.equal(writes,0);
});
