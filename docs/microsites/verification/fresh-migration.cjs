const {execFileSync}=require('node:child_process');const path=require('node:path');const fs=require('node:fs');const root=path.resolve(__dirname,'../../..');
const args=['-X','-h','/tmp/carteliax-languages','-p','55432','-v','ON_ERROR_STOP=1'];
const database='carteliax_microsites_'+Date.now();
const guard="do $$begin if current_setting('port')<>'55432' or current_setting('data_directory') not like '/tmp/carteliax-languages/%' then raise exception 'Disposable fixture required';end if;end$$;";
execFileSync('psql',[...args,'-d','postgres','-c',guard]);
execFileSync('psql',[...args,'-d','postgres','-c','create database '+database]);
let output=execFileSync('psql',[...args,'-d',database,'-f','docs/microsites/verification/schema-fixture.sql','-f','supabase/migrations/202610060001_menu_translations.sql','-f','supabase/migrations/202610070001_business_microsites.sql','-f','backend/test/microsites-database.sql'],{cwd:root,encoding:'utf8'});
fs.writeFileSync('/tmp/carteliax-microsites/fresh-migration.log',output);console.log('PASS Final migration from scratch + SQL security/profile tests on isolated database');
