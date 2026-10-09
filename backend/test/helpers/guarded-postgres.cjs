const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const args = ['-XAt','-h','/tmp/carteliax-hardening-pg/socket','-p','55439','-U','jordi','-v','ON_ERROR_STOP=1'];
const guard = "DO $$BEGIN IF current_setting('port')<>'55439' OR current_setting('data_directory')<>'/tmp/carteliax-hardening-pg/data' THEN RAISE EXCEPTION 'Disposable QA required';END IF;END$$;";
const database = execFileSync('psql',[...args,'-d','postgres','-c',guard+"SELECT datname FROM pg_database WHERE datname ~ '^carteliax_launch_[0-9]+$' ORDER BY datname DESC LIMIT 1"],{encoding:'utf8'}).trim().split('\n').at(-1);
assert(/^carteliax_launch_\d+$/.test(database));
const quote = value => value==null?'NULL':"'"+String(typeof value==='object'?JSON.stringify(value):value).replaceAll("'","''")+"'";
function sql(statement, role='jordi', actor='') {
 assert(['jordi','authenticated','service_role','anon'].includes(role));
 const out = execFileSync('psql',[...args,'-d',database,'-f','-'],{input:guard+`BEGIN;SET LOCAL ROLE ${role};SELECT set_config('request.jwt.claim.sub',${quote(actor)},true);`+statement+';COMMIT;',encoding:'utf8',stdio:['pipe','pipe','pipe']});
 return out.trim().split('\n').filter(line=>!['DO','BEGIN','SET','COMMIT',actor,''].includes(line)).at(-1);
}
module.exports={sql,quote,database};
