import test from 'node:test';
import assert from 'node:assert/strict';
import { gastronomicCorpus } from './fixtures/gastronomic-corpus.js';
import { suspiciousTranslation, translationPrompt, TRANSLATION_QUALITY_VERSION } from '../src/modules/translations/translationQuality.js';
import { translateSnapshot, validateOutput, planTranslation } from '../src/modules/translations/translationService.js';
import { generateSchema, manualSchema } from '../src/modules/translations/translationSchemas.js';
import { GroqTranslationProvider } from '../src/modules/translations/groqTranslationProvider.js';

for (const language of ['es','val','en','fr']) {
  test(`${language}: synthetic gastronomic corpus validates all fields without treating dish names as foreign sentences`, () => {
    const items = gastronomicCorpus(language);
    const translated = items.map(({ type, id, name, description, welcome_text }) => ({ type, id, name, description, welcome_text }));
    assert.equal(validateOutput({ language, items: translated }, items, language).length, 13);
    for (let index = 0; index < items.length; index++) assert.deepEqual(suspiciousTranslation(items[index], translated[index], language), []);
    assert(translationPrompt('es', language).includes('DESTINATION:'));
  });
}
test('wrong-language long prose and unit changes trigger quality checks; culinary borrowings and brands do not', () => {
  const source = gastronomicCorpus('es')[11];
  assert(suspiciousTranslation(source, source, 'en').some(issue => issue.code === 'POSSIBLE_WRONG_LANGUAGE'));
  const drink = gastronomicCorpus('en')[9];
  assert(suspiciousTranslation(drink, { ...drink, name: 'Coca-Cola 330 cl' }, 'en').some(issue => issue.code === 'UNIT_CHANGED'));
  const restaurant = gastronomicCorpus('en')[12];
  assert(suspiciousTranslation(restaurant, { ...restaurant, name: 'Invented brand' }, 'en').some(issue => issue.code === 'BRAND_CHANGED'));
});
test('confusable ingredients are rejected without rewriting text; French citron vert is lime', () => {
  for (const [sourceText, resultText, language] of [
    ['Thin noodles with cuttlefish.', 'Nouilles avec calmar.', 'fr'],
    ['Con una rodaja de llima.', 'With a slice of lime.', 'en'],
    ['Rice with butter beans.', 'Riz avec des fèves.', 'fr'],
  ]) {
    const source = { type:'product', name:'Dish', description:sourceText };
    assert(suspiciousTranslation(source,{ name:'Dish',description:resultText },language).some(issue=>issue.code==='INGREDIENT_CHANGED'));
  }
  assert(!suspiciousTranslation({type:'product',name:'Drink',description:'With lime.'},{name:'Boisson',description:'Avec du citron vert.'},'fr').some(issue=>issue.code==='INGREDIENT_CHANGED'));
  assert(suspiciousTranslation({type:'restaurant',name:'Brand',description:''},{name:'Brand',welcome_text:'Informació sobre al·lígens.'},'val').some(issue=>issue.code==='INVALID_CULINARY_TERM'));
  assert(suspiciousTranslation({type:'product',name:'Ensalada',description:'Tomates frescos.'},{name:'Ensalada',description:'Tomàquets frescos.'},'val').some(issue=>issue.code==='VALENCIAN_STYLE_DRIFT'));
  assert.deepEqual(suspiciousTranslation({type:'restaurant',name:'La Seva',description:'Cuina familiar.'},{name:'La Seva',description:'Cuina familiar.'},'val'),[]);
  assert(suspiciousTranslation({type:'restaurant',name:'Brand',welcome_text:'No garantizamos la ausencia de trazas.'},{name:'Brand',welcome_text:'No garantim l’absència de traços.'},'val').some(issue=>issue.code==='ALLERGEN_TRACE_CHANGED'));
});
test('one controlled retry repairs suspicious output, passes only reason codes, and persists only accepted complete results', async () => {
  const items = [gastronomicCorpus('es')[11]], target = gastronomicCorpus('en')[11];
  let calls = 0;
  const result = await translateSnapshot({ items, language: 'en', sourceLanguage: 'es', provider: { async translate(input) {
    calls++;
    if (calls === 2) { assert(input.retryIssues.some(issue => issue.code === 'POSSIBLE_WRONG_LANGUAGE')); assert(!JSON.stringify(input.retryIssues).includes(items[0].description)); assert.equal(input.retryCandidate[0].description,items[0].description); }
    const text = calls === 1 ? items[0] : target;
    const { type, id, name, description, welcome_text } = text;
    return { language: 'en', items: [{ type, id, name, description, welcome_text }] };
  } } });
  assert.equal(calls, 2); assert.equal(result[0].description, target.description);
});
test('Valencian uses a bounded editorial pass with the same provider even after initial heuristic checks pass', async () => {
  const source=gastronomicCorpus('es')[11], target=gastronomicCorpus('val')[11]; let calls=0;
  await translateSnapshot({items:[source],language:'val',sourceLanguage:'es',provider:{async translate(input){
    calls++; if(calls===2){assert.equal(input.retryIssues[0].code,'FINAL_EDITORIAL_REVIEW');assert.equal(input.retryCandidate[0].name,target.name);}
    const {type,id,name,description,welcome_text}=target;return {language:'val',items:[{type,id,name,description,welcome_text}]};
  }}});
  assert.equal(calls,2);
});
test('suspect output is bounded to two attempts; ambiguous timeout is never retried', async () => {
  const items = [gastronomicCorpus('es')[11]];
  let calls = 0;
  await assert.rejects(translateSnapshot({ items, language: 'en', sourceLanguage: 'es', provider: { async translate() { calls++; const { type,id,name,description,welcome_text } = items[0]; return { language: 'en', items: [{ type,id,name,description,welcome_text }] }; } } }), { code: 'SUSPICIOUS_TRANSLATION' });
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(translateSnapshot({ items, language: 'en', sourceLanguage: 'es', provider: { async translate() { calls++; throw Object.assign(Error(), { code: 'GROQ_TIMEOUT' }); } } }), { code: 'GROQ_TIMEOUT' });
  assert.equal(calls, 1);
});
test('Groq explicit JSON rejection gets one controlled retry without exposing failed generation', async () => {
  const source=gastronomicCorpus('es')[0];
  const {type,id,name,description,welcome_text}=gastronomicCorpus('en')[0], result={type,id,name,description,welcome_text};
  let calls=0;
  const provider=new GroqTranslationProvider({apiKey:'fixture',fetchImpl:async()=>{
    calls++;
    return calls===1 ? new Response(JSON.stringify({error:{code:'json_validate_failed',failed_generation:'untrusted rejected text'}}),{status:400})
      : new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({language:'en',items:[result]})}}]}));
  }});
  assert.equal((await translateSnapshot({items:[source],language:'en',sourceLanguage:'es',provider}))[0].name,result.name);
  assert.equal(calls,2);
});
test('all four languages use the same GPT-OSS 120B model', async () => {
  const requested=[];
  const provider=new GroqTranslationProvider({apiKey:'fixture',model:'openai/gpt-oss-120b',fetchImpl:async(_url,options)=>{
    const payload=JSON.parse(options.body); requested.push(payload);
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({language:payload.response_format.json_schema.schema.properties.language.enum[0],items:[]})}}]}));
  }});
  for(const targetLanguage of ['es','val','en','fr']) await provider.translate({sourceLanguage:'es',targetLanguage,items:[]});
  assert.deepEqual(requested.map(payload=>payload.model),Array(4).fill('openai/gpt-oss-120b'));
  assert(requested.every(payload=>payload.response_format.json_schema.strict===true));
  assert(requested.every(payload=>payload.reasoning_effort==='medium'));
});
test('old automatic drafts are candidates even when source unchanged; regeneration never selects manual drafts', () => {
  const source = gastronomicCorpus('es')[5];
  assert.equal(planTranslation([{ ...source, draft: { source_hash: source.source_hash } }]).length, 1);
  assert.equal(planTranslation([{ ...source, draft: { source_hash: source.source_hash, quality_version: TRANSLATION_QUALITY_VERSION } }]).length, 0);
  assert.equal(planTranslation([{ ...source, draft: { is_manual: true, source_hash: source.source_hash } }], true).length, 0);
  assert.equal(generateSchema.safeParse({ replaceManual: true }).success, false);
});
test('restaurant editor allows bounded About us prose; prevents private extra fields and non-restaurant welcome text', () => {
  const source = gastronomicCorpus('es')[12];
  const body = { type: source.type, id: source.id, name: source.name, description: source.description, welcome_text: 'x'.repeat(3000), sourceHash: source.source_hash, revision: 0 };
  assert(manualSchema.safeParse(body).success);
  assert(!manualSchema.safeParse({ ...body, welcome_text: 'x'.repeat(3001) }).success);
  assert(!manualSchema.safeParse({ ...body, phone: 'private' }).success);
});
