// Actual migrated PostgreSQL in the guarded disposable cluster; AI is a fixture.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'), assert = require('node:assert/strict');
const args = ['-XAt','-h','/tmp/carteliax-hardening-pg/socket','-p','55439','-U','jordi','-v','ON_ERROR_STOP=1'];
const guard = "DO $$BEGIN IF current_setting('port')<>'55439' OR current_setting('data_directory')<>'/tmp/carteliax-hardening-pg/data' THEN RAISE EXCEPTION 'Disposable QA required';END IF;END$$;";
const database = execFileSync('psql',[...args,'-d','postgres','-c',guard+"SELECT datname FROM pg_database WHERE datname ~ '^carteliax_launch_[0-9]+$' ORDER BY datname DESC LIMIT 1"],{encoding:'utf8'}).trim().split('\n').at(-1);
assert(/^carteliax_launch_\d+$/.test(database));
const quote = value => "'"+String(typeof value==='object'?JSON.stringify(value):value).replaceAll("'","''")+"'";
function sql(statement, role='jordi', actor='') {
  const out = execFileSync('psql',[...args,'-d',database,'-f','-'],{input:guard+`BEGIN;SET LOCAL ROLE ${role};SELECT set_config('request.jwt.claim.sub',${quote(actor)},true);`+statement+';COMMIT;',encoding:'utf8',stdio:['pipe','pipe','pipe']});
  return out.trim().split('\n').filter(line=>!['DO','BEGIN','SET','COMMIT',actor,''].includes(line)).at(-1);
}
const json = query => JSON.parse(sql(query));
(async()=>{
 const { gastronomicCorpus } = await import('./fixtures/gastronomic-corpus.js');
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', business='11111111-1111-4111-8111-111111111111';
 const corpus=gastronomicCorpus('es'), menu=corpus[0].id;
 const { DEFAULT_THEME }=await import('../src/modules/menuThemes/menuThemeSchemas.js');
 const theme={...DEFAULT_THEME,branding:{...DEFAULT_THEME.branding,welcomeText:corpus[0].welcome_text}};
 // This runner is repeatable only after launch-database creates a fresh DB.
 sql(`UPDATE subscriptions SET status='trialing',stripe_livemode=false,trial_ends_at=now()+interval '1 day',current_period_end=now()+interval '1 day' WHERE business_id=${quote(business)};UPDATE businesses SET name=${quote(corpus[12].name)},description=${quote(corpus[12].description)},public_profile=${quote({about:corpus[12].welcome_text})} WHERE id=${quote(business)}`);
 sql(`INSERT INTO menus(id,business_id,name,description,slug,is_published) VALUES(${quote(menu)},${quote(business)},${quote(corpus[0].name)},${quote(corpus[0].description)},'quality',true);INSERT INTO menu_themes(menu_id,draft_config,published_config,published_at) VALUES(${quote(menu)},${quote(theme)},${quote(theme)},now())`);
 for(const category of corpus.filter(item=>item.type==='category')) sql(`INSERT INTO categories(id,menu_id,name) VALUES(${quote(category.id)},${quote(menu)},${quote(category.name)})`);
 for(const product of corpus.filter(item=>item.type==='product')) {
  sql(`INSERT INTO products(id,business_id,name,description,price) VALUES(${quote(product.id)},${quote(business)},${quote(product.name)},${quote(product.description)},17.49);INSERT INTO category_products(category_id,product_id) VALUES(${quote(corpus[1].id)},${quote(product.id)})`);
 }
 const original=json(`SELECT to_jsonb(t) FROM (SELECT name,description,price FROM products WHERE id=${quote(corpus[5].id)}) t`);
 for(const language of ['es','val','en','fr']) {
  const publicBefore=json(`SELECT cx_public_translations(${quote(menu)})`).translations;
  const enqueued=json(`SELECT cx_translation_enqueue_v2(${quote(menu)},${quote(owner)},${quote(language)},false)`);
  assert.equal(enqueued.total_items,13);
  const job=json('SELECT cx_translation_claim()');assert.equal(job.id,enqueued.id);
  const translated=gastronomicCorpus(language).map(({type,id,name,description,welcome_text})=>({type,id:type==='restaurant'?business:id,name,description,welcome_text,quality_version:'gastronomy-v2'}));
  sql(`SELECT cx_translation_finish(${quote(job.id)},${quote(job.claim_token)},${quote(translated)})`);
  assert.deepEqual(json(`SELECT cx_public_translations(${quote(menu)})`).translations,publicBefore);
  sql(`SELECT cx_translation_mutate(${quote(menu)},${quote(owner)},${quote(language)},'publish')`);
  const published=json(`SELECT cx_public_translations(${quote(menu)})`);
  assert.equal(published.translations[language].length,13);
  assert.equal(published.translations[language].find(item=>item.type==='restaurant').welcome_text,translated[12].welcome_text);
  const unchanged=json(`SELECT cx_translation_enqueue_v2(${quote(menu)},${quote(owner)},${quote(language)},false)`);assert.equal(unchanged.unchanged,true);
  const items=json(`SELECT cx_translation_sources(${quote(menu)},${quote(language)})`);
  const product=items.find(item=>item.id===corpus[5].id);
  const manual={type:'product',id:product.id,name:product.draft.name,description:product.draft.description+' · reviewed',welcome_text:'',sourceHash:product.source_hash,revision:product.draft.revision};
  sql(`SELECT cx_translation_mutate(${quote(menu)},${quote(owner)},${quote(language)},'manual',${quote(manual)})`);
  const before=json(`SELECT to_jsonb(t) FROM product_translations t WHERE menu_id=${quote(menu)} AND product_id=${quote(product.id)} AND language_code=${quote(language)}`);
  const forced=json(`SELECT cx_translation_enqueue_v2(${quote(menu)},${quote(owner)},${quote(language)},true)`);assert.equal(forced.total_items,12);
  const regenerate=json('SELECT cx_translation_claim()');assert(!regenerate.source_items.some(item=>item.id===product.id));
  sql(`SELECT cx_translation_finish(${quote(regenerate.id)},${quote(regenerate.claim_token)},${quote(translated.filter(item=>item.id!==product.id))})`);
  const after=json(`SELECT to_jsonb(t) FROM product_translations t WHERE menu_id=${quote(menu)} AND product_id=${quote(product.id)} AND language_code=${quote(language)}`);
  assert.deepEqual(after,before);
  console.log('PASS PostgreSQL',language,'13 fields/resources; publish; exact cache reuse; regenerate 12 automatic resources without touching manual row');
 }
 assert.deepEqual(json(`SELECT to_jsonb(t) FROM (SELECT name,description,price FROM products WHERE id=${quote(corpus[5].id)}) t`),original);
 assert.throws(()=>sql(`SELECT cx_translation_enqueue(${quote(menu)},${quote(owner)},'en',true)`),/CX_MANUAL_PROTECTED/);
 assert.throws(()=>sql(`SELECT cx_translation_enqueue_v2(${quote(menu)},'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','en',true)`),/CX_FORBIDDEN/);
 assert.throws(()=>sql(`SELECT cx_translation_enqueue_v2(${quote(menu)},${quote(owner)},'en',true)`,'authenticated',owner),/permission denied/);
 assert.throws(()=>sql('SELECT * FROM restaurant_translations','anon'),/permission denied/);
 const titles=json(`SELECT cx_public_menu_titles(${quote(business)})`);
 for(const language of ['es','val','en','fr']) assert.equal(titles.quality[language],gastronomicCorpus(language)[0].name);
 console.log('PASS originals/prices untouched; owner isolation; service-only RPC/table; four translated navigation titles');
 // Concurrent manual change is fenced at final commit, not just in JS.
 const retry=json(`SELECT cx_translation_enqueue_v2(${quote(menu)},${quote(owner)},'en',true)`),job=json('SELECT cx_translation_claim()');
 const category=job.source_items.find(item=>item.type==='category');
 sql(`UPDATE category_translations SET is_manual=true,revision=revision+1 WHERE menu_id=${quote(menu)} AND category_id=${quote(category.id)} AND language_code='en'`);
 const output=job.source_items.map(({type,id,name,description,welcome_text})=>({type,id,name,description,welcome_text,quality_version:'gastronomy-v2'}));
 assert.throws(()=>sql(`SELECT cx_translation_finish(${quote(job.id)},${quote(job.claim_token)},${quote(output)})`),/CX_CHANGED/);
 sql(`UPDATE menu_translation_jobs SET status='failed' WHERE id=${quote(retry.id)}`);
 console.log('PASS concurrent manual edit prevents atomic automatic commit; no production service or real AI used');
 // Roll back this additional fixture: it must not affect the HTTP/browser suite.
 execFileSync('psql',[...args,'-d',database,'-f','-'],{input:guard+`BEGIN;
 UPDATE menu_translations SET quality_version=NULL WHERE menu_id=${quote(menu)} AND language_code='fr';
 DO $$BEGIN
  BEGIN PERFORM cx_translation_mutate(${quote(menu)},${quote(owner)},'fr','publish');
   RAISE EXCEPTION 'Old automatic quality unexpectedly published';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CX_INCOMPLETE' THEN RAISE;END IF;END;
 END$$;
 INSERT INTO menus(id,business_id,name,slug) VALUES('90000000-0000-4000-8000-000000000099',${quote(business)},'Legacy','legacy-quality-test');
 INSERT INTO menu_languages(menu_id,language_code) VALUES('90000000-0000-4000-8000-000000000099','fr');
 INSERT INTO restaurant_translations(menu_id,business_id,language_code,name,description,welcome_text,source_hash,quality_version)
 SELECT '90000000-0000-4000-8000-000000000099',id,'fr',name,'Previous automatic introduction','Previous automatic about',repeat('a',64),'gastronomy-v2' FROM businesses WHERE id=${quote(business)};
 UPDATE businesses SET public_profile=public_profile||jsonb_build_object('translations',jsonb_build_array(jsonb_build_object(
 'language','fr','description','Texte relu manuellement','about','Présentation manuelle',
 'source',jsonb_build_array(description,public_profile->>'about',default_language)::text))) WHERE id=${quote(business)};
 DO $$DECLARE item jsonb;BEGIN
 SELECT value INTO item FROM jsonb_array_elements(cx_translation_sources('90000000-0000-4000-8000-000000000099','fr')) WHERE value->>'type'='restaurant';
 IF NOT (item->'draft'->>'is_manual')::boolean OR item->'draft'->>'source_hash'<>item->>'source_hash' THEN RAISE EXCEPTION 'Legacy manual protection failed';END IF;
 IF item->'draft'->>'description'<>'Texte relu manuellement' THEN RAISE EXCEPTION 'Automatic restaurant row displaced legacy manual text';END IF;
 UPDATE businesses SET description=description||' changed' WHERE id=${quote(business)};
 SELECT value INTO item FROM jsonb_array_elements(cx_translation_sources('90000000-0000-4000-8000-000000000099','fr')) WHERE value->>'type'='restaurant';
 IF NOT (item->'draft'->>'is_manual')::boolean OR item->'draft'->>'source_hash'=item->>'source_hash' THEN RAISE EXCEPTION 'Changed legacy text did not become protected/stale';END IF;
 END$$;ROLLBACK;`,encoding:'utf8',stdio:['pipe','pipe','pipe']});
 console.log('PASS old-quality publish rejected; existing restaurant profile translations remain manual and become stale after source edits');
})().catch(error=>{console.error(error.stderr?.toString()??error.stack);process.exitCode=1});
