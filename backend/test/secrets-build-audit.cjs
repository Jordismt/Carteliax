// Do not print secret values or matching content. Reads local env only; no networking.
const fs=require('node:fs'),path=require('node:path');const dotenv=require('dotenv');
const root=path.resolve(__dirname,'../..'),env=dotenv.parse(fs.readFileSync(root+'/backend/.env'));
const names=['SUPABASE_SECRET_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','GROQ_API_KEY'];let files=0;const leaks=new Set();
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else{files++;const bytes=fs.readFileSync(p);for(const name of names)if(env[name]?.length>12&&bytes.includes(Buffer.from(env[name])))leaks.add(name)}}}
walk(root+'/frontend/.output');const result={type:'LOCAL_BUILD_SECRET_VALUE_SCAN',filesChecked:files,privateEnvironmentValuesExposed:[...leaks],pass:leaks.size===0};console.log(JSON.stringify(result,null,2));if(leaks.size)process.exitCode=1;
