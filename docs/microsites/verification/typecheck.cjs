// QA dependency lives in /tmp; no runtime dependency added to Carteliax.
const {spawnSync}=require('node:child_process');const path=require('node:path');const fs=require('node:fs');
const root=path.resolve(__dirname,'../../../frontend');const tool=process.env.VUE_TSC_BIN||'/tmp/carteliax-microsites/qa/node_modules/vue-tsc/bin/vue-tsc.js';
for(const project of ['tsconfig.json','.nuxt/tsconfig.app.json','.nuxt/tsconfig.server.json','.nuxt/tsconfig.shared.json','.nuxt/tsconfig.node.json']){
 const r=spawnSync(process.execPath,[tool,'--noEmit','-p',project],{cwd:root,encoding:'utf8'});const name=project.match(/tsconfig\.(\w+)\.json/)?.[1]??'root';fs.writeFileSync(`/tmp/carteliax-microsites/typecheck-${name}.log`,r.stdout+r.stderr);console.log(name,r.status===0?'PASS':'FAIL');if(r.status!==0){console.log(r.stdout+r.stderr);process.exit(1);}
}
