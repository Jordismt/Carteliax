import test from 'node:test';
import assert from 'node:assert/strict';
import { safeEnv, response } from './helpers/audit-fixture.js';
safeEnv();
const { loadPublishedSiteSlugs, getPublicSitemap } = await import('../src/modules/publicSites/publicSitemapController.js');
test('sitemap returns only canonical slugs with both menu and theme published', async () => {
 const good={is_published:true,businesses:{public_slug:'restaurante-publicado',owner_id:'PRIVATE_OWNER'},menu_themes:{published_at:'2026-10-08',published_config:{template:'modern'}}};
 const records=[good,good,{...good,is_published:false,businesses:{public_slug:'draft'}},{...good,businesses:{public_slug:'theme-draft'},menu_themes:{published_at:null,published_config:{}}},{...good,businesses:{public_slug:'Bad Slug'}},{...good,businesses:{public_slug:'empty-config'},menu_themes:{published_at:'date',published_config:{}}}];
 const calls=[];const q={select(v){calls.push(['select',v]);return q},eq(k,v){calls.push(['eq',k,v]);return q},not(...v){calls.push(['not',...v]);return q},order(){return q},range(a,b){calls.push(['range',a,b]);return Promise.resolve({data:records,error:null})}};
 const result=await loadPublishedSiteSlugs({from:table=>{assert.equal(table,'menus');return q}},0);
 assert.deepEqual(result,{slugs:['restaurante-publicado'],nextOffset:null});assert(!JSON.stringify(result).includes('PRIVATE_OWNER'));assert(calls.some(c=>c[0]==='eq'&&c[1]==='is_published'&&c[2]===true));assert(calls.some(c=>c[0]==='not'&&c[1]==='menu_themes.published_at'));assert.deepEqual(calls.at(-1),['range',0,499]);assert(!calls[0][1].includes('owner_id'));
});
test('sitemap propagates database errors instead of advertising unknown resources', async()=>{
 const q={select(){return q},eq(){return q},not(){return q},order(){return q},range(){return Promise.resolve({data:null,error:Error('QA_OFFLINE')})}};
 await assert.rejects(loadPublishedSiteSlugs({from:()=>q}),/QA_OFFLINE/);
});
test('sitemap rejects malformed or client-controlled queries without touching provider',async()=>{
 for(const query of [{offset:'-1'},{offset:'50001'},{offset:['0']},{offset:'abc'},{businessId:'foreign'}]){const res=response();await getPublicSitemap({query},res,()=>assert.fail('unexpected provider'));assert.equal(res.statusCode,400);}
});
