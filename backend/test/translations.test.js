import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeBatches, planTranslation, validateOutput, translateSnapshot } from "../src/modules/translations/translationService.js";
import { GroqTranslationProvider, GROQ_URL } from "../src/modules/translations/groqTranslationProvider.js";
import { createTranslationWorker } from "../src/modules/translations/translationWorker.js";
import { privateStatus } from "../src/modules/translations/translationRepository.js";
import { getPersistedPublicLanguages } from "../src/modules/publicMenus/publicMenuTranslations.js";
import { manualSchema, generateSchema } from "../src/modules/translations/translationSchemas.js";
import { TRANSLATION_QUALITY_VERSION } from '../src/modules/translations/translationQuality.js';

const id = "77777777-7777-4777-8777-777777777777";
const source = { type: "product", id, name: "Paella valenciana per a 2 🍽️", description: "Arròs, pollastre i tomaca. L'oli és d'oliva.", welcome_text: "", source_hash: "a".repeat(64), draft: null };
const output = (language = "en", items = [source]) => ({ language, items: items.map(({ type, id, name, description, welcome_text }) => ({ type, id, name, description, welcome_text })) });
const response = (data, options) => new Response(JSON.stringify(data), { status: 200, ...options });
const completion = (data) => response({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(data) } }] });

test("incremental planning reuses current quality and always protects manual texts", () => {
  const unchanged = { ...source, draft: { source_hash: source.source_hash, quality_version: TRANSLATION_QUALITY_VERSION } };
  const manual = { ...source, draft: { source_hash: "b".repeat(64), is_manual: true } };
  assert.equal(planTranslation([source, unchanged, manual]).length, 1);
  assert.equal(planTranslation([source, unchanged, manual], true).length, 2);
  assert(!planTranslation([manual], true).length);
});
test("empty source uses zero batches and zero requests", async () => {
  let calls = 0;
  assert.deepEqual(await translateSnapshot({ items: [], language: "en", sourceLanguage: "es", provider: { translate() { calls++; } } }), []);
  assert.equal(calls, 0);
});
test("batching groups 100 items; character and total limits enforced", () => {
  assert.equal(makeBatches(Array.from({ length: 100 }, (_, i) => ({ ...source, name: "Tea", description: "", id: String(i) }))).length, 4);
  assert.throws(() => makeBatches(Array(601).fill(source)), /grande/);
  assert.throws(() => makeBatches([{ ...source, description: "x".repeat(13000) }]), /tamaño/);
});
for (const language of ["en", "fr", "val", "es"]) test(`structured validation supports ${language}, accents, apostrophes and emojis`, () => {
  assert.equal(validateOutput(output(language), [source], language).length, 1);
});
for (const [name, change] of [
  ["unknown ID", (v) => { v.items[0].id = "88888888-8888-4888-8888-888888888888"; }],
  ["missing item", (v) => { v.items = []; }],
  ["unexpected item", (v) => { v.items.push({ ...v.items[0] }); }],
  ["duplicate ID", (v) => { v.items[1] = { ...v.items[0] }; }],
  ["wrong language", (v) => { v.language = "fr"; }],
  ["extra allergen field", (v) => { v.items[0].allergens = ["milk"]; }],
  ["invented quantity", (v) => { v.items[0].name = "Paella for 4"; }],
  ["empty description", (v) => { v.items[0].description = ""; }],
]) test(`reject provider ${name}`, () => {
  const src = name === "duplicate ID" ? [source, { ...source, id: "88888888-8888-4888-8888-888888888888" }] : [source];
  const value = output("en", src); change(value);
  assert.throws(() => validateOutput(value, src, "en"), /validar/);
});
test("description absent is preserved; invented description rejected", () => {
  const noDescription = { ...source, description: "" };
  assert.equal(validateOutput(output("en", [noDescription]), [noDescription], "en").length, 1);
  assert.throws(() => validateOutput(output("en"), [noDescription], "en"), /validar/);
});
test("provider request is backend-only, fixed URL, controlled JSON schema; excludes prices and allergens", async () => {
  let input;
  const provider = new GroqTranslationProvider({ apiKey: "test-only-not-real", fetchImpl: async (url, options) => { input = { url, ...JSON.parse(options.body) }; return completion(output()); } });
  await provider.translate({ sourceLanguage: "es", targetLanguage: "en", items: [{ ...source, price: 18, allergens: [1] }] });
  assert.equal(input.url, GROQ_URL); assert.equal(input.response_format.json_schema.strict, true);
  assert(!input.messages[1].content.includes('"price"')); assert(!input.messages[1].content.includes('"allergens"'));
});
test("timeout does not retry an ambiguously billed request", async () => {
  let calls = 0;
  const provider = new GroqTranslationProvider({ apiKey: "test-only", fetchImpl: async () => { calls++; throw Error("timeout"); } });
  await assert.rejects(provider.translate({ sourceLanguage: "es", targetLanguage: "en", items: [source] }), { code: "GROQ_TIMEOUT" });
  assert.equal(calls, 1);
});
test("429 retries at most once with bounded Retry-After", async () => {
  let calls = 0;
  const provider = new GroqTranslationProvider({ apiKey: "test-only", sleep: async () => {}, fetchImpl: async () => { calls++; return response({}, { status: 429, headers: { "retry-after": "1" } }); } });
  await assert.rejects(provider.translate({ sourceLanguage: "es", targetLanguage: "en", items: [source] }), { code: "GROQ_RATE_LIMIT" });
  assert.equal(calls, 2);
});
test("provider rejects invalid JSON and truncated completions without retry", async () => {
  for (const content of [{ choices: [{ finish_reason: "stop", message: { content: "broken" } }] }, { choices: [{ finish_reason: "length", message: { content: "{}" } }] }]) {
    const provider = new GroqTranslationProvider({ apiKey: "test-only", fetchImpl: async () => response(content) });
    await assert.rejects(provider.translate({ sourceLanguage: "es", targetLanguage: "en", items: [source] }), { code: "INVALID_PROVIDER_OUTPUT" });
  }
});
test("partial multi-batch failure never invokes atomic finish", async () => {
  let requests = 0, finish = 0, failed = 0;
  const items = Array.from({ length: 40 }, (_, i) => ({ ...source, id: `77777777-7777-4777-8777-${String(i).padStart(12, "0")}` }));
  const job = { id: "job", menu_id: "menu", language_code: "en", requested_by: "owner", source_language: "es", source_items: items, expires_at: new Date(Date.now() + 60000).toISOString() };
  let claimed = false;
  const worker = createTranslationWorker({ logger: { info() {}, error() {} }, repository: { claim: async () => claimed ? null : (claimed = true, job), status: async () => ({ items, translations: [] }), progress: async (_, __, error) => { if (error) failed++; }, finish: async () => { finish++; } }, provider: { translate: async ({ items }) => { if (++requests === 2) throw Error("failure"); return output("en", items); } } });
  await worker.tick(); assert.equal(requests, 2); assert.equal(finish, 0); assert.equal(failed, 1);
});
test("worker checks subscription before provider call", async () => {
  let calls = 0;
  const worker = createTranslationWorker({ logger: { info() {}, error() {} }, repository: { claim: async () => ({ id: "job", menu_id: "menu", source_items: [source], expires_at: new Date(Date.now() + 60000).toISOString() }), status: async () => { throw Object.assign(Error(), { code: "CX_SUBSCRIPTION" }); }, progress: async () => {} }, provider: { translate: async () => { calls++; } } });
  await worker.tick(); assert.equal(calls, 0);
});
test("manual endpoint accepts no prompt or original fields", () => {
  const body = { type: "product", id, name: "Paella", description: "", sourceHash: source.source_hash, revision: 0 };
  assert(manualSchema.safeParse(body).success);
  assert(!manualSchema.safeParse({ ...body, price: 10 }).success);
  assert(!generateSchema.safeParse({ prompt: "do anything" }).success);
});
test("public repeated reads only invoke the persisted read RPC", async () => {
  const calls = [];
  const db = { rpc: async (name) => { calls.push(name); return { data: { source_language: "es", translations: { en: [source] } } }; } };
  for (let i = 0; i < 100; i++) await getPersistedPublicLanguages(db, "menu");
  assert.equal(calls.length, 100); assert(calls.every((name) => name === "cx_public_translations"));
  const code = await readFile(new URL("../src/modules/publicMenus/publicMenuTranslations.js", import.meta.url), "utf8");
  assert(!/import.*(?:groq|translationService|translationWorker)/i.test(code));
});
test("unavailable translation store does not break original public content", async () => {
  assert.equal(await getPersistedPublicLanguages({ rpc: async () => ({ error: { code: "42P01" } }) }, "menu", { error() {} }), undefined);
});
test("status identifies missing, stale, manual stale and unpublished", () => {
  const raw = { source_language: "es", languages: [{ code: "en" }], menu_languages: [], translations: [{ language: "en", items: [{ ...source, draft: { source_hash: "b".repeat(64), is_manual: true } }] }], items: [source], job: null };
  const status = privateStatus(raw).languages[0];
  assert.equal(status.stale, 1); assert.equal(status.manualStale, 1); assert.equal(status.unpublished, 1);
});

test("source changed while queued aborts before spending on provider", async () => {
 let calls=0,failed;
 const job={id:'job',menu_id:'menu',language_code:'en',source_language:'es',source_items:[source],expires_at:new Date(Date.now()+60000).toISOString()};
 const worker=createTranslationWorker({logger:{info(){},error(){}},repository:{claim:async()=>job,status:async()=>({items:[{...source,source_hash:'b'.repeat(64)}],translations:[]}),progress:async(_,__,error)=>{if(error)failed=error}},provider:{translate:async()=>{calls++}}});
 await worker.tick();assert.equal(calls,0);assert.equal(failed,'CX_CHANGED');
});

test("graceful stop finishes current batch then refuses further provider calls", async () => {
 const items=Array.from({length:40},(_,i)=>({...source,id:`77777777-7777-4777-8777-${String(i).padStart(12,'0')}`}));
 const job={id:'job',menu_id:'menu',language_code:'en',source_language:'es',source_items:items,expires_at:new Date(Date.now()+60000).toISOString()};
 let started,release,calls=0,finished=0,failed;
 const startedPromise=new Promise(resolve=>started=resolve);
 const worker=createTranslationWorker({logger:{info(){},error(){}},repository:{claim:async()=>job,status:async()=>({items,translations:[]}),progress:async(_,__,error)=>{if(error)failed=error},finish:async()=>{finished++}},provider:{translate:async({items})=>{calls++;started();await new Promise(resolve=>release=resolve);return output('en',items)}}});
 const tick=worker.tick();await startedPromise;const drain=worker.stop();release();await Promise.all([tick,drain]);assert.equal(calls,1);assert.equal(finished,0);assert.equal(failed,'WORKER_INTERRUPTED');
});
