// Real QR pixels, actual shared URL module. This is NOT browser download testing.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const frontendRequire = createRequire(root + '/frontend/package.json');
(async () => {
  const ts = frontendRequire('typescript'), qr = frontendRequire('qrcode');
  const source = fs.readFileSync(root + '/frontend/app/utils/publicUrls.ts', 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { publicMenuPath, publicSitePath } = await import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64'));
  const business = 'c630dd10-4ea8-4763-a130-c0213e7aff51';
  const paths = [publicMenuPath(business, 'menu-del-dia', 'restaurant-de-prova'), publicMenuPath(business, 'menu-del-dia'), publicSitePath('restaurant-de-prova')];
  assert.deepEqual(paths, ['/restaurant-de-prova?menu=menu-del-dia#carta', `/c/${business}/menu-del-dia`, '/restaurant-de-prova']);
  fs.mkdirSync('/tmp/carteliax-hardening-pg/qr', { recursive: true });
  for (const [index, value] of paths.entries()) {
    const target = 'https://www.carteliax.com' + value;
    const png = `/tmp/carteliax-hardening-pg/qr/${index}.png`;
    await qr.toFile(png, target, { width: 1024, margin: 4, errorCorrectionLevel: 'H' });
    const decoded = JSON.parse(execFileSync('python3', [root + '/docs/landing-qr-pricing/verification/decode-qr.py', png], { encoding: 'utf8' }));
    assert.deepEqual(decoded, [target]);
  }
  console.log('PASS menu-specific, stable legacy and restaurant URLs: actual PNG QR pixels independently decoded');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
