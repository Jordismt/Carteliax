// Local built Nuxt + real Supabase SDK; Auth HTTP responses intercepted, no real email.
const {spawn}=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict');
const profile=fs.mkdtempSync('/tmp/carteliax-recovery-browser-');
const debugPort=9500+Math.floor(Math.random()*300);
const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--remote-debugging-port='+debugPort,'--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws,seq=0,pending=new Map(),userUnavailable=false,updates=[],requests=[],used=false;
const user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',aud:'authenticated',role:'authenticated',email:'qa@example.invalid',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-10-01T00:00:00Z'};
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,aud:'authenticated',role:'authenticated'})).toString('base64url')+'.qa';
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
async function waitFor(expression){for(let n=0;n<80;n++){if(await evaluate(expression))return;await sleep(100);}throw Error('UI condition timed out: '+await evaluate('document.body.innerText.slice(0,350)'));}
async function navigate(path){await send('Page.navigate',{url:'about:blank'});await sleep(100);await send('Page.navigate',{url:'http://127.0.0.1:3008'+path});await waitFor("!!document.querySelector('h1')");await sleep(300);}
async function fill(id,value){await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
async function submit(){await evaluate("document.querySelector('form button[type=submit]').click()");}
(async()=>{
 let page;for(let n=0;n<80;n++){try{page=(await(await fetch('http://127.0.0.1:'+debugPort+'/json')).json()).find(x=>x.type==='page');if(page)break;}catch{}await sleep(100);}if(!page)throw Error('Chrome unavailable');
 ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',async e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(Error(m.error.message));else p?.resolve(m.result);return;}
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params;const url=new URL(request.url);
  if(url.origin==='http://127.0.0.1:3008')return send('Fetch.continueRequest',{requestId});
  let code=200,body={};requests.push({path:url.pathname,method:request.method});
  if(url.hostname==='qa-auth.invalid'){
   if(request.method==='OPTIONS')body={};
   else if(url.pathname.endsWith('/user')){if(userUnavailable){code=401;body={msg:'invalid',code:'bad_jwt'};}else{body=user;if(request.method==='PUT')updates.push(JSON.parse(request.postData));}}
   else if(url.pathname.endsWith('/token'))body={access_token:token,refresh_token:'qa-refresh',expires_in:3600,token_type:'bearer',user};
   else if(url.pathname.endsWith('/signup'))body={user};
   else if(url.pathname.endsWith('/verify')){const p=JSON.parse(request.postData);if(p.token_hash==='valid-fixture'&&!used){used=true;body={access_token:token,refresh_token:'qa-refresh',expires_in:3600,token_type:'bearer',user};}else{code=403;body={msg:'expired',code:'otp_expired'};}}
   else if(url.pathname.endsWith('/logout'))code=204;
  }else if(url.origin==='http://127.0.0.1:3010'){
   if(url.pathname.startsWith('/api/subscriptions/'))body={success:true,subscription:{status:'trialing',billing_compatibility:'current',billing_access:false,stripe_livemode:false,stripe_customer_id:'cus_qa',stripe_subscription_id:'sub_qa',trial_ends_at:'2020-01-01',current_period_end:'2020-01-01',trial_used_at:'2020-01-01',cancel_at_period_end:false}};
   else if(url.pathname==='/api/businesses')body={success:true,businesses:[]};
   else body={success:true,business:{id:user.id,name:'QA Restaurant',slug:'qa-restaurant',public_slug:'qa-restaurant',primary_color:'#047857',public_profile:{}}};
  }else{code=503;body={message:'External network blocked by QA'};}
  await send('Fetch.fulfillRequest',{requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'http://127.0.0.1:3008'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET, POST, PUT, DELETE, OPTIONS'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 }
 });
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 for(const width of [390,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
  for(const route of ['/','/login','/register','/terms','/privacy','/forgot-password']){await navigate(route);assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);}
  await navigate('/forgot-password');await fill('recovery-email','qa@example.invalid');await submit();await waitFor("document.body.innerText.includes('Si existe una cuenta')");console.log('PASS request confirmation and public responsive routes',width);
 }
 await navigate('/reset-password');await waitFor("document.body.innerText.includes('El enlace no es válido')");assert.equal(await evaluate("!!document.querySelector('#new-password')"),false);console.log('PASS direct URL cannot update a password');
 await navigate('/reset-password?token_hash=expired-fixture&type=recovery');await waitFor("document.body.innerText.includes('El enlace no es válido')");console.log('PASS expired/invalid verification');
 await navigate('/reset-password?token_hash=valid-fixture&type=recovery');await waitFor("!!document.querySelector('#new-password')");await fill('new-password','new-password-qa');await fill('confirm-password','different-password');await submit();await waitFor("document.body.innerText.includes('Las contraseñas no coinciden')");assert.equal(updates.length,0);
 await fill('confirm-password','new-password-qa');await submit();await waitFor("document.body.innerText.includes('Tu contraseña se ha cambiado')");assert.equal(updates.length,1);assert.equal(updates[0].password,'new-password-qa');assert.equal(updates[0].email,undefined);assert(requests.some(x=>x.path.endsWith('/logout')));assert.equal(await evaluate('location.search+location.hash'),'');console.log('PASS verified recovery, confirmation, update and sign-out');
 await navigate('/reset-password?token_hash=valid-fixture&type=recovery');await waitFor("document.body.innerText.includes('El enlace no es válido')");console.log('PASS reused link rejected by mocked Auth');
 await navigate('/reset-password#access_token='+token+'&refresh_token=qa-refresh&expires_in=3600&token_type=bearer&type=recovery');await waitFor("!!document.querySelector('#new-password')");console.log('PASS standard implicit Supabase recovery callback');
 userUnavailable=true;await fill('new-password','new-password-qa');await fill('confirm-password','new-password-qa');await submit();await waitFor("document.body.innerText.includes('El enlace no es válido')");assert.equal(updates.length,1);console.log('PASS expired session blocks update');
 userUnavailable=false;await evaluate('localStorage.clear()');
 await navigate('/register');await fill('fullName','QA User');await fill('email','qa@example.invalid');await fill('password','new-password-qa');await fill('confirmPassword','new-password-qa');await evaluate("document.querySelector('input[type=checkbox]').click()");await submit();await waitFor("document.body.innerText.includes('¡Revisa tu correo!')");console.log('PASS registration form and confirmation (Auth mocked)');
 await navigate('/login');await fill('email','qa@example.invalid');await fill('password','new-password-qa');await submit();await waitFor("location.pathname==='/dashboard'");console.log('PASS login navigates to dashboard (Auth mocked)');
 await navigate('/billing/'+user.id);await waitFor("document.body.innerText.includes('Prueba gratuita finalizada')");assert.equal(await evaluate("document.body.innerText.includes('Prueba gratuita activa')"),false);console.log('PASS expired trial billing headline');
 await navigate('/businesses/qr/'+user.id);await waitFor("!!document.querySelector('canvas') && document.querySelector('canvas').width>0");
 const qr=await evaluate("(()=>{const c=document.querySelector('canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {width:c.width,hasDark:Array.from(d).some((x,i)=>i%4!==3&&x<50),url:Array.from(document.querySelectorAll('a')).some(a=>a.href==='http://127.0.0.1:3008/qa-restaurant')};})()");assert(qr.hasDark);assert(qr.url);console.log('PASS QR canvas and restaurant URL (data mocked; no physical scan)');
 console.log('PASS browser + Supabase SDK; Auth MOCKED, no email delivered or remote mutation');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{ws?.close();chrome.kill();setTimeout(()=>fs.rmSync(profile,{recursive:true,force:true}),1000);});
