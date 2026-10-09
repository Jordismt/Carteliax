// Actual frontend projection module. Published texts are synthetic fixtures,
// not provider responses and not hosted Supabase integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { gastronomicCorpus } from './fixtures/gastronomic-corpus.js';
import { DEFAULT_THEME } from '../src/modules/menuThemes/menuThemeSchemas.js';
const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const ts = require('typescript');
const code = await readFile(new URL('../../frontend/app/utils/publicMenuLanguages.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { localizePublicMenu, localizeRestaurant, PUBLIC_MENU_COPY, matchMenuLanguage } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const original = gastronomicCorpus('es');
const codes = ['gluten','crustaceans','eggs','fish','peanuts','soybeans','milk','nuts','celery','mustard','sesame','sulphites','lupin','molluscs'];
const categories = [{ id: original[1].id, name: original[1].name, products: original.filter(item => item.type === 'product').map(item => ({ id: item.id, name: item.name, description: item.description, price: 17.49, image_url: '/original.webp', is_available: true, allergens: codes.map(code => 'source '+code), allergen_codes: codes })) }];
const languages = { source_language: 'es', available: [], translations: Object.fromEntries(['es','val','en','fr'].map(language => [language,gastronomicCorpus(language)])) };
for (const language of ['es','val','en','fr']) test(`frontend ${language}: names, full prose, welcome, 14 allergens, original prices and restaurant prose`, () => {
  const before = JSON.stringify({categories,languages});
  const result = localizePublicMenu(categories, DEFAULT_THEME, languages, language, original[0].id);
  const texts = gastronomicCorpus(language);
  assert.equal(result.menuText.name,texts[0].name);
  assert.equal(result.categories[0].name,texts[1].name);
  assert.equal(result.categories[0].products[0].description,texts[5].description);
  assert.equal(result.categories[0].products[0].price,17.49);
  assert.equal(result.categories[0].products[0].image_url,'/original.webp');
  assert.equal(result.categories[0].products[0].allergens.length,14);
  assert(!result.categories[0].products[0].allergens.some(name=>name.startsWith('source ')));
  assert.equal(result.theme.branding.welcomeText,texts[0].welcome_text);
  assert(PUBLIC_MENU_COPY[language].allergens);
  const site={ business:{name:original[12].name,description:original[12].description,default_language:'es',profile:{about:original[12].welcome_text,translations:[]}},currentMenu:{business:{id:original[12].id},languages} };
  assert.deepEqual(localizeRestaurant(site,language),{description:texts[12].description,about:texts[12].welcome_text});
  assert.equal(JSON.stringify({categories,languages}),before);
});
test('switching languages cannot mutate cached response or reuse a different language',()=>{
  for(const language of ['en','fr','val','es','en']) {
    const result=localizePublicMenu(categories,DEFAULT_THEME,languages,language,original[0].id);
    assert.equal(result.categories[0].products[2].name,gastronomicCorpus(language)[7].name);
  }
  assert.equal(matchMenuLanguage('ca-ES',['es','val','en','fr']),'val');
  assert.equal(matchMenuLanguage('fr-FR',['es','val','en','fr']),'fr');
});
test('incomplete product translation falls back as a whole product; missing language never borrows another language',()=>{
  const partial={...languages,translations:{en:[{...gastronomicCorpus('en')[5],description:''}]}};
  const result=localizePublicMenu(categories,DEFAULT_THEME,partial,'en',original[0].id);
  assert.equal(result.categories[0].products[0].name,original[5].name);
  assert.equal(result.categories[0].products[0].description,original[5].description);
  assert.equal(localizePublicMenu(categories,DEFAULT_THEME,partial,'fr',original[0].id).categories[0].products[0].name,original[5].name);
});
