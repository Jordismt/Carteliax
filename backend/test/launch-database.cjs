// Real PostgreSQL, disposable cluster ONLY. No remote credentials are read.
const {execFileSync,execFile}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),db='carteliax_launch_'+Date.now();
const args=['-X','-h','/tmp/carteliax-hardening-pg/socket','-p','55439','-U','jordi','-d',db,'-v','ON_ERROR_STOP=1'];
const guard="DO $$BEGIN IF current_setting('port')<>'55439' OR current_setting('data_directory')<>'/tmp/carteliax-hardening-pg/data' THEN RAISE EXCEPTION 'Disposable launch QA required';END IF;END$$;";
function sql(s){return execFileSync('psql',[...args,'-At','-c',guard+s],{encoding:'utf8'}).trim();}
function file(s){const f='/tmp/carteliax-hardening-pg/statement.sql';fs.writeFileSync(f,guard+'\n'+s);return execFileSync('psql',[...args,'-f',f],{encoding:'utf8'});}
const parallel=s=>new Promise((resolve,reject)=>execFile('psql',[...args,'-At','-c',guard+s],(e,out)=>e?reject(e):resolve(out.trim().split('\n').at(-1))));
(async()=>{
 execFileSync('createdb',['-h','/tmp/carteliax-hardening-pg/socket','-p','55439','-U','jordi',db]);
 let fixture=fs.readFileSync(root+'/docs/microsites/verification/schema-fixture.sql','utf8').replaceAll('55432','55439').replaceAll('/tmp/carteliax-languages/%','/tmp/carteliax-hardening-pg/%');
 file(fixture);sql("ALTER TABLE subscriptions ADD COLUMN stripe_customer_id text,ADD COLUMN stripe_subscription_id text,ADD COLUMN trial_used_at timestamptz,ADD COLUMN cancel_at_period_end boolean default false,ADD COLUMN checkout_attempt_id uuid,ADD COLUMN checkout_expires_at timestamptz,ADD COLUMN checkout_session_id text;CREATE TABLE stripe_webhook_events(id text primary key,event_type text);");
 for(const name of fs.readdirSync(root+'/supabase/migrations').sort()){
  if(name.includes('launch_billing_and_permissions')){
   // Existing broad grants/policies are installed BEFORE the hardening migration.
   // The assertions exercise its real revocations, not fixture replacements.
   sql("GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;CREATE POLICY fixture_product_storage ON storage.objects FOR ALL TO authenticated USING (bucket_id='product-images') WITH CHECK (bucket_id='product-images');INSERT INTO storage.buckets(id,name,public) VALUES('product-images','product-images',true);");
   for(const table of ['menus','products','categories','category_products','product_allergens','menu_themes'])sql(`CREATE POLICY fixture_permissive ON ${table} FOR ALL TO authenticated USING (true) WITH CHECK (true);`);
  }
  file(fs.readFileSync(root+'/supabase/migrations/'+name,'utf8'));console.log('APPLIED LOCAL',name);
 }
 sql("UPDATE private.cx_billing_environment SET stripe_livemode=false;UPDATE subscriptions SET stripe_livemode=false,stripe_subscription_id='sub_'||business_id,stripe_customer_id='cus_'||business_id,current_period_end=now()+interval '1 day';");
 file(fs.readFileSync(root+'/backend/test/launch-database.sql','utf8'));
 const business='11111111-1111-4111-8111-111111111111',owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const lease=`select cx_acquire_billing_sync('${business}','${owner}');`;
 sql(`update subscriptions set billing_sync_token=null,billing_sync_expires_at=null where business_id='${business}';`);
 const results=await Promise.all([parallel(lease),parallel(lease)]);assert.equal(results.filter(Boolean).length,1);console.log('PASS concurrent lease: exactly one owner');
 const obsolete=results.find(Boolean);sql(`update subscriptions set billing_sync_expires_at=now()-interval '1 second' where business_id='${business}';`);const fresh=sql(lease).split('\n').at(-1);assert.notEqual(fresh,obsolete);
 const payload={business_id:business,owner_id:owner,stripe_subscription_id:'sub_'+business,stripe_customer_id:'cus_'+business,stripe_livemode:false,status:'past_due',current_period_end:new Date(Date.now()+86400000).toISOString(),cancel_at_period_end:false};
 const call=(id,created,token,status)=>`select cx_sync_billing_event('${id}','customer.subscription.updated',${created},'${JSON.stringify({...payload,sync_token:token,status})}');`;
 try{sql(call('evt_fenced',500,obsolete,'active'));assert.fail('expired worker committed');}catch(e){assert.match(String(e.stderr),/CX_BILLING_FENCE/);}console.log('PASS expired lease fenced');
 assert.equal(sql(call('evt_equal_1',500,fresh,'active')).split('\n').at(-1),'synced');
 const next=sql(lease).split('\n').at(-1);assert.equal(sql(call('evt_equal_2',500,next,'past_due')).split('\n').at(-1),'synced');
 assert.equal(sql(`select status from subscriptions where business_id='${business}';`).split('\n').at(-1),'past_due');console.log('PASS equal timestamps: serialized current snapshots');
 const third=sql(lease).split('\n').at(-1);assert.equal(sql(call('evt_older',499,third,'past_due')).split('\n').at(-1),'synced');assert.equal(sql(`select stripe_event_created from subscriptions where business_id='${business}';`).split('\n').at(-1),'500');sql(`select cx_release_billing_sync('${business}','${third}');`);
 const fourth=sql(lease).split('\n').at(-1);assert.equal(sql(call('evt_equal_2',500,fourth,'active')).split('\n').at(-1),'duplicate');sql(`select cx_release_billing_sync('${business}','${fourth}');`);
 assert.equal(sql("select count(*) from stripe_webhook_events where id='evt_fenced';").split('\n').at(-1),'0');console.log('PASS delayed/duplicate events and failed transaction rollback');
 console.log('PASS local PostgreSQL migration, RLS, RPC, Storage and concurrency. Hosted Supabase NOT tested.');
})().catch(e=>{console.error(e.stderr?.toString()??e.stack);process.exitCode=1});
