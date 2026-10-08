// Existing browser suites; APIs/auth/storage mocked. No live service data.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
for(const dir of ['/tmp/carteliax-redesign','/tmp/carteliax-languages','/tmp/carteliax-microsites'])fs.mkdirSync(dir,{recursive:true});
const results=[];
for(const suite of ['regression-flows','regression-extended','regression-additional','regression-states','regression-public-matrix','regression-languages','new-business-browser']){
 const run=spawnSync(process.execPath,[path.resolve(__dirname,'../../microsites/verification/'+suite+'.cjs'),'after'],{env:{...process.env,PLAYWRIGHT_MODULE:'/tmp/carteliax-public-qa/node_modules/playwright',QA_SUPABASE_AUTH_STORAGE_KEY:'sb-127-auth-token'},encoding:'utf8',timeout:300000});
 fs.writeFileSync(__dirname+'/'+suite+'.log',run.stdout+run.stderr);results.push({suite,status:run.status===0?'PASS':'FAIL',assertedScenarios:(run.stdout.match(/^PASS /gm)||[]).length});console.log(suite,results.at(-1).status);
 if(run.status!==0){console.log((run.stdout+run.stderr).slice(-4000));process.exitCode=1;break;}
}
fs.writeFileSync(__dirname+'/functional-browser.json',JSON.stringify({type:'REAL_CHROME_MOCKED_AUTH_STORAGE_API',results},null,2));
