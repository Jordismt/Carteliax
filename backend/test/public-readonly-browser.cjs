// Browser -> local production Nuxt build -> deployed public API -> real data.
// Read-only: no login, Checkout, charges, or writes. Dependencies live in /tmp.
const { chromium } = require(process.env.QA_PLAYWRIGHT_PATH || '/tmp/carteliax-regression-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = process.env.QA_BROWSER_ORIGIN || 'http://127.0.0.1:5077';
assert(['http://127.0.0.1:5077', 'https://www.carteliax.com'].includes(origin));
const business = 'c630dd10-4ea8-4763-a130-c0213e7aff51';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, locale: 'es-ES' });
      await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(origin + '/restaurant-de-prova?menu=menu-del-dia#carta', { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      const payload = await (await context.request.get(origin + `/api/public/menus/${business}/menu-del-dia`)).json();
      for (const language of ['fr', 'val', 'en']) {
        await page.locator('#restaurant-language').selectOption(language);
        await page.waitForURL(url => url.searchParams.get('lang') === language);
        const text = payload.languages.translations[language].find(item => item.type === 'product' && item.name);
        assert(text, `Published ${language} product translation must exist`);
        await page.getByText(text.name, { exact: true }).first().waitFor();
        assert.equal(await page.locator('html').getAttribute('lang'), language === 'val' ? 'ca-valencia' : language);
      }
      await page.locator('#restaurant-language').selectOption('en');
      await page.waitForURL(url => url.searchParams.get('lang') === 'en');
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      // Compare text against the actual published translation from the API.
      const translated = payload.languages.translations.en.find(item => item.type === 'product' && item.name);
      assert(translated, 'A published real product translation must exist');
      await page.getByText(translated.name, { exact: true }).first().waitFor();
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('#restaurant-language').inputValue(), 'en');
      // Stable legacy QR URL renders directly on the corrected local build.
      const legacy = await page.goto(origin + `/c/${business}/menu-del-dia`, { waitUntil: 'networkidle' });
      assert.equal(legacy.status(), 200);
      if (origin.startsWith('http:')) assert(page.url().includes(`/c/${business}/menu-del-dia`));
      await page.getByText(translated.name, { exact: true }).first().waitFor();
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
      assert.deepEqual(errors, []);
      fs.mkdirSync('/tmp/carteliax-hardening-pg/browser', { recursive: true });
      await page.screenshot({ path: `/tmp/carteliax-hardening-pg/browser/public-${viewport.width}.png`, fullPage: true });
      console.log(`PASS ${viewport.width}px: anonymous site, exact published en/fr/val texts, reload, legacy URL, persisted language, no overflow/page errors`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
