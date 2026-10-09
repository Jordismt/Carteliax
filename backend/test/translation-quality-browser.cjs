// Chrome -> Nuxt build -> Express -> Supabase SDK -> actual local PostgreSQL.
// Hosted Auth and AI are simulated in translation-quality-api.cjs.
const {chromium}=require('/tmp/carteliax-regression-tools/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try {
  for(const width of [1440,390]) {
   const context=await browser.newContext({viewport:{width,height:900},locale:'es-ES'});
   await context.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   const r=await page.goto('http://127.0.0.1:5078/restaurante-jordi?menu=quality&lang=es#carta',{waitUntil:'networkidle'});assert.equal(r.status(),200);
   const data=await(await context.request.get('http://127.0.0.1:5078/api/public/menus/11111111-1111-4111-8111-111111111111/quality')).json();
   for(const language of ['es','val','en','fr']) {
    await page.locator('#restaurant-language').selectOption(language);
    await page.waitForURL(url=>url.searchParams.get('lang')===language);
    const texts=data.languages.translations[language];
    const product=texts.find(item=>item.id==='90000000-0000-4000-8000-000000000012');
    await page.getByText(product.name,{exact:true}).first().waitFor();
    await page.getByText(product.description,{exact:true}).first().waitFor();
    const restaurant=texts.find(item=>item.type==='restaurant');
    await page.getByText(restaurant.description,{exact:true}).first().waitFor();
    await page.getByText(restaurant.welcome_text,{exact:true}).first().waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'),language==='val'?'ca-valencia':language);
    assert.equal(await page.locator('#restaurant-language').inputValue(),language);
   }
   await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#restaurant-language').inputValue(),'fr');
   const legacy=await page.goto('http://127.0.0.1:5078/c/11111111-1111-4111-8111-111111111111/quality',{waitUntil:'networkidle'});assert.equal(legacy.status(),200);
   assert.equal(await page.locator('html').getAttribute('lang'),'fr');
   const french=data.languages.translations.fr.find(item=>item.id==='90000000-0000-4000-8000-000000000012');
   await page.getByText(french.description,{exact:true}).first().waitFor();
   assert.deepEqual(errors,[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
   fs.mkdirSync('/tmp/carteliax-translation-quality/browser',{recursive:true});
   await page.screenshot({path:`/tmp/carteliax-translation-quality/browser/${width}.png`,fullPage:true});
   console.log('PASS browser',width,'four languages, full product descriptions, restaurant introduction/about, persisted language, legacy route and no errors/overflow; local DB real, AI/Auth simulated');
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1});
