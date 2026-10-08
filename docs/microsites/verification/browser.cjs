const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
const fixture=require('./fixtures.cjs');
const root=require('node:path').resolve(__dirname,'../../..');
const env=fs.readFileSync(root+'/frontend/.env','utf8');
const supabaseUrl=env.match(/^NUXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
if(!supabaseUrl)throw Error('Supabase URL absent; no secrets printed');
const storageKey=process.env.QA_SUPABASE_AUTH_STORAGE_KEY || 'sb-'+new URL(supabaseUrl).hostname.split('.')[0]+'-auth-token';
const user={id:'99999999-9999-4999-8999-999999999999',aud:'authenticated',role:'authenticated',email:'ui-test@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{full_name:'UI Test'},created_at:'2026-10-01T12:00:00Z'};
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+86400,aud:'authenticated',role:'authenticated'})).toString('base64url')+'.mock';
const session={access_token:token,refresh_token:'mock-refresh',token_type:'bearer',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,user};
async function setup(browser,{authenticated=true,width=390}={}){
 const context=await browser.newContext({viewport:{width,height:844},acceptDownloads:true});const state=fixture.createState();const errors=[];
 if(authenticated)await context.addInitScript(({storageKey,session})=>{try{localStorage.setItem(storageKey,JSON.stringify(session));}catch{}},{storageKey,session});
 await context.route('**/auth/v1/**',async route=>{const path=new URL(route.request().url()).pathname;let data=path.endsWith('/user')?user:path.endsWith('/logout')?{}:session;await route.fulfill({status:200,json:data});});
 await context.route('**/storage/v1/**',route=>route.fulfill({status:200,json:{Key:'mock',Id:'mock'}}));
 await context.route('**/api/**',async route=>{
  const request=route.request();const url=new URL(request.url());let body={};try{body=request.postDataJSON()||{};}catch{}
  const r=fixture.response(state,url.pathname + url.search,request.method(),body);if(state.delay)await new Promise(r=>setTimeout(r,state.delay));await route.fulfill({status:r.status,json:r.data});
 });
 await context.route('**/mock-checkout',r=>r.fulfill({status:200,contentType:'text/html',body:'<h1>Pago simulado</h1>'}));
 await context.route('**/mock-portal',r=>r.fulfill({status:200,contentType:'text/html',body:'<h1>Facturación simulada</h1>'}));
 await context.route('**/mock-image.png',r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT2cAAAAASUVORK5CYII=','base64')}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page,state,errors};
}
async function goto(page,path){await page.goto('http://127.0.0.1:3001'+path,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!document.querySelector('#__nuxt')?.__vue_app__);await page.waitForTimeout(550);}
async function geometry(page){return page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&getComputedStyle(e).position!=='fixed';}).slice(0,5).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,70)}))}));}
async function baseline(browser){const results=[];const {context,page,state,errors}=await setup(browser);for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:844});for(const path of ['/', '/login','/register','/dashboard','/businesses',`/businesses/${fixture.b1}`,`/menus?business=${fixture.b1}`,`/menus/${fixture.m1}`,`/menus/${fixture.m1}/design`,`/menus/${fixture.m1}/qr`,`/billing/${fixture.b1}`,`/c/${fixture.b1}/carta-principal`]){await goto(page,path);console.log('Checked',width,path);const g=await geometry(page);results.push({width,path,...g});if(width===390&&/dashboard|menus/.test(path))await page.screenshot({path:`/tmp/carteliax-redesign/${process.argv[2]}-${path.includes('design')?'design':path.includes('qr')?'qr':path==='/dashboard'?'dashboard':path.includes(fixture.m1)?'editor':'menus'}.png`,fullPage:true});}}
 fs.writeFileSync(`/tmp/carteliax-redesign/${process.argv[2]}-responsive.json`,JSON.stringify({results,errors,counts:{businesses:state.businesses.length,menus:state.menus.length,categories:state.categories.length,products:state.products.length}},null,2));console.log(JSON.stringify({checks:results.length,overflow:results.filter(r=>r.scroll>r.width),errors,counts:{businesses:state.businesses.length,menus:state.menus.length,categories:state.categories.length,products:state.products.length}}));await context.close();}
async function main(){const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{await baseline(browser);}finally{await browser.close();}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={setup,goto,geometry,fixture,assert,fs,chromium};
