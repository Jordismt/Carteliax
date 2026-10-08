// Read-only scan of both builds, including deduplicated Vercel symlinks.
// Never print secret values or matching content. No networking.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');const dotenv=require(root+'/backend/node_modules/dotenv');
const env=dotenv.parse(fs.readFileSync(root+'/backend/.env'));
const names=['SUPABASE_SECRET_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','GROQ_API_KEY'];
const visited=new Set(),leaks=new Set();let files=0;
function walk(file){const real=fs.realpathSync(file);if(visited.has(real))return;visited.add(real);const stat=fs.statSync(real);if(stat.isDirectory()){for(const name of fs.readdirSync(real))walk(path.join(real,name))}else if(stat.isFile()){files++;const bytes=fs.readFileSync(real);for(const name of names)if(env[name]?.length>12&&bytes.includes(Buffer.from(env[name])))leaks.add(name)}}
walk(root+'/frontend/.output');walk(root+'/frontend/.vercel/output');
console.log(JSON.stringify({type:'LOCAL_NODE_AND_VERCEL_BUILD_SECRET_VALUE_SCAN',filesChecked:files,privateEnvironmentValuesExposed:[...leaks],pass:leaks.size===0},null,2));if(leaks.size)process.exitCode=1;
