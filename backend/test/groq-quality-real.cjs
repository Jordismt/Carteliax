// Explicit real-provider evaluation. Synthetic data; never touches Supabase.
// Reads only GROQ_API_KEY/model from the local env file; never logs credentials.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const settings = require('dotenv').parse(fs.readFileSync(root + '/.env'));
  const model = 'openai/gpt-oss-120b';
  assert(settings.GROQ_API_KEY, 'Local provider key missing; evaluation NOT run');
  const { GroqTranslationProvider } = await import('../src/modules/translations/groqTranslationProvider.js');
  const { translateSnapshot } = await import('../src/modules/translations/translationService.js');
  const { gastronomicCorpus } = await import('./fixtures/gastronomic-corpus.js');
  let calls = 0;
  const candidates = [];
  const client = new GroqTranslationProvider({ apiKey: settings.GROQ_API_KEY, model, fetchImpl: async (...args) => {
    calls++; const response = await fetch(...args);
    if (!response.ok && process.env.QA_PROVIDER_DIAGNOSTICS === '1') {
      const body = await response.clone().json().catch(()=>({}));
      console.log('SYNTHETIC_PROVIDER_ERROR',JSON.stringify({ status:response.status, code:body.error?.code, message:String(body.error?.message??'').replaceAll(settings.GROQ_API_KEY,'[redacted]').slice(0,300) }));
    }
    return response;
  } });
  const provider = { translate: async input => { const output = await client.translate(input); candidates.push({ target: input.targetLanguage, feedback: input.retryIssues, output }); return output; } };
  const results = [];
  const targets = (process.env.QA_GROQ_TARGETS || 'es,val,en,fr').split(',');
  assert(targets.every(language => ['es','val','en','fr'].includes(language)));
  let index = 0;
  for (const [target, source] of [['es','val'],['val','es'],['en','fr'],['fr','en']].filter(([target]) => targets.includes(target))) {
    if (index++) await new Promise(resolve => setTimeout(resolve, 35000));
    const started = Date.now();
    const items = gastronomicCorpus(source);
    // Mixed input is deliberate: the configured source is only a hint.
    items[8].description = 'Tomates frescos amb formatge de cabra, walnuts and olive oil. No lleva salsa.';
    let translated;
    try {
      translated = await translateSnapshot({ items, language: target, sourceLanguage: source, provider });
      assert.equal(translated.length, items.length);
      assert.equal(translated.find(item => item.type === 'restaurant').name, 'Restaurant dels Sants');
      const drink = translated.find(item => item.id === items[9].id);
      assert(drink.name.replace(/[‐‑–—]/g,'-').includes('Coca-Cola')); assert(drink.name.includes('330'));
      if (target === 'es') { assert(/limón/iu.test(drink.description)); assert(/judías verdes/iu.test(translated[5].description)); }
      if (target === 'val') { assert(/gambes/iu.test(translated[6].description)); assert(/al·lèrgens/iu.test(translated[12].welcome_text)); }
      if (target === 'en') assert(/cuttlefish/iu.test(translated[6].description));
      if (target === 'fr') { assert(/seiche/iu.test(translated[6].description)); assert(/haricots de Lima/iu.test(translated[5].description)); }
      results.push({ source, target, status: 'validated', elapsedMs: Date.now()-started, items: translated });
      console.log('REAL_PROVIDER_VALIDATED', JSON.stringify({ model, source, target, items: translated.length, elapsedMs: Date.now()-started }));
    } catch (error) {
      results.push({ source, target, status: 'failed', code: error.code || 'EVALUATION_FAILED', providerStatus: error.providerStatus, elapsedMs: Date.now()-started, ...(translated ? { items: translated } : {}) });
      console.log('REAL_PROVIDER_FAILED', JSON.stringify({ model, source, target, code: error.code || 'EVALUATION_FAILED', providerStatus: error.providerStatus }));
    }
  }
  fs.mkdirSync('/tmp/carteliax-translation-quality', { recursive: true });
  const artifact = `/tmp/carteliax-translation-quality/${model.split('/').at(-1)}.json`;
  fs.writeFileSync(artifact, JSON.stringify({ model, calls, results, candidates }, null, 2));
  console.log('EVALUATION_ARTIFACT', artifact, 'providerCalls', calls);
  if (results.some(result => result.status !== 'validated')) process.exitCode = 1;
})().catch(error => { console.error(error.code || 'EVALUATION_SETUP_FAILED'); process.exitCode = 1; });
