// Real Chrome + Nuxt/Supabase client, simulated authentication/API transports. No real signup or JWT validation.
process.env.PLAYWRIGHT_MODULE='/tmp/carteliax-public-qa/node_modules/playwright';
const {setup,goto,fixture:f,assert,chromium,fs}=require('../../microsites/verification/browser.cjs');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});const results=[];try{
 const {context,page,errors}=await setup(browser,{width:1280});
 await context.addInitScript(()=>{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('sb-')&&k.endsWith('-auth-token'))localStorage.setItem('sb-127-auth-token',localStorage.getItem(k));}});
 await goto(page,'/dashboard');assert.match(page.url(),/dashboard/);
 const second=await context.newPage();await goto(second,'/businesses');assert.match(second.url(),/businesses/);
 const publicPage=await context.newPage();await goto(publicPage,'/restaurante-jordi');
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.waitForURL('**/login');await second.waitForURL('**/login');assert.match(publicPage.url(),/restaurante-jordi/);
 results.push({name:'logout unmounts private data in both tabs, public URL retained',status:'PASS'});assert.equal(await second.locator('.app-account').count(),0);assert.deepEqual(errors,[]);await context.close();
 const anonymous=await setup(browser,{authenticated:false});await goto(anonymous.page,'/dashboard');await anonymous.page.waitForURL('**/login');results.push({name:'direct private route without session redirects login',status:'PASS'});assert.deepEqual(anonymous.errors,[]);await anonymous.context.close();
 const expired=await setup(browser);await expired.context.addInitScript(()=>{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('sb-')&&k.endsWith('-auth-token'))localStorage.setItem('sb-127-auth-token',localStorage.getItem(k));}});await expired.context.route('**/api/businesses',r=>r.fulfill({status:401,json:{success:false,message:'Sesión caducada'}}));await goto(expired.page,'/dashboard');await expired.page.waitForURL('**/login');results.push({name:'backend 401 during private load redirects login',status:'PASS'});await expired.context.close();
 console.log(JSON.stringify({type:'REAL_CHROME_MOCKED_AUTH_API',results},null,2));fs.writeFileSync(__dirname+'/sessions-browser.json',JSON.stringify({type:'REAL_CHROME_MOCKED_AUTH_API',results},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
