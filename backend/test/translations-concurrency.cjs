// PostgreSQL integration test. Refuses any database outside the disposable fixture.
const {execFile}=require('node:child_process');const {promisify}=require('node:util');const assert=require('node:assert/strict');
const run=promisify(execFile);
const guard="DO $$BEGIN IF current_setting('port')<>'55432' OR current_setting('data_directory') NOT LIKE '/tmp/carteliax-languages/%' THEN RAISE EXCEPTION 'Disposable fixture required';END IF;END$$;";
async function sql(query){const r=await run('psql',['-XAt','-h','/tmp/carteliax-languages','-p','55432','-d','carteliax_delivery','-v','ON_ERROR_STOP=1','-c',guard+query]);return r.stdout.trim();}
async function main(){await sql("UPDATE menu_translation_jobs SET status='failed' WHERE status IN ('queued','processing');");
 const request=l=>sql(`BEGIN; SELECT cx_translation_enqueue('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${l}'); SELECT pg_sleep(0.35); COMMIT;`);
 const result=await Promise.allSettled([request('en'),request('fr')]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);const rejected=result.find(r=>r.status==='rejected');assert(rejected.reason.stderr.includes('CX_BUSY'));console.log('PASS Two simultaneous owner tabs create exactly one business job');
 const active=await sql("SELECT count(*) FROM menu_translation_jobs WHERE status IN ('queued','processing');");assert(active.endsWith('1'));
 const claims=await Promise.all([sql("SELECT cx_translation_claim();"),sql("SELECT cx_translation_claim();")]);assert.equal(claims.filter(s=>s.includes('claim_token')).length,1);console.log('PASS Two simultaneous workers cannot claim the same job');
 await sql("UPDATE menu_translation_jobs SET expires_at=now()-interval '1 second' WHERE status='processing'; SELECT cx_translation_claim();");
 const remaining=await sql("SELECT count(*) FROM menu_translation_jobs WHERE status IN ('queued','processing');");assert(remaining.endsWith('0'));console.log('PASS Expired worker is fenced; interrupted job is not replayed');
}
main().catch(e=>{console.error('Concurrency test failed',e.message);process.exitCode=1});
