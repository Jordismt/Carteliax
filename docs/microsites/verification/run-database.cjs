const {execFileSync,spawnSync}=require('node:child_process');const path=require('node:path');const fs=require('node:fs');
const root=path.resolve(__dirname,'../../..');
const base=['-X','-h','/tmp/carteliax-languages','-p','55432','-d','carteliax_delivery','-v','ON_ERROR_STOP=1'];
function psql(args){return execFileSync('psql',[...base,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
const guard="do $$begin if current_setting('port')<>'55432' or current_setting('data_directory') not like '/tmp/carteliax-languages/%' then raise exception 'Disposable required';end if;end$$;";
psql(['-c',guard+"delete from menu_translation_jobs; delete from menu_languages; update products set price=18;"]);
const migration=fs.readFileSync(root+'/supabase/migrations/202610070001_business_microsites.sql','utf8');
const slugFunction=migration.slice(migration.indexOf('create function public.cx_public_slug_valid'),migration.indexOf('create function public.cx_normalize_public_slug')).replace('create function','create or replace function');
psql(['-c',guard+slugFunction]);
psql(['-c',guard+"update menus set slug='principal' where id='33333333-3333-4333-8333-333333333333';"]);
// Rebuild only our fixture policies after editing the unapplied migration.
const policies=migration.slice(migration.indexOf('create policy cx_cover_owner_insert'),migration.indexOf('-- No overwrite policy'));
psql(['-c',guard+'drop policy cx_cover_owner_insert on storage.objects;drop policy cx_cover_owner_select on storage.objects;drop policy cx_cover_owner_delete on storage.objects;'+policies]);
psql(['-c',guard+"update categories set name='Arroces' where id='55555555-5555-4555-8555-555555555555';"]);
psql(['-c',guard+"update products set name='Paella para 2 personas' where id='77777777-7777-4777-8777-777777777777';"]);
for(const name of ['translations-database','translations-database-edges','translations-production-guards','translations-reuse','microsites-database']){
 const result=spawnSync('psql',[...base,'-f',`backend/test/${name}.sql`],{cwd:root,encoding:'utf8'});
 fs.writeFileSync(`/tmp/carteliax-microsites/${name}.log`,result.stdout+result.stderr);
 console.log(result.status===0?'PASS':'FAIL',name);
 if(result.status!==0){console.log(result.stderr);process.exit(1);}
}
for(const name of ['translations-concurrency','translations-api-integration','microsites-api-integration']){
 const result=spawnSync('node',[`backend/test/${name}.cjs`],{cwd:root,encoding:'utf8'});
 fs.writeFileSync(`/tmp/carteliax-microsites/${name}.log`,result.stdout+result.stderr);console.log(result.status===0?'PASS':'FAIL',name);
 if(result.status!==0){console.log(result.stdout+result.stderr);process.exit(1);}
}
