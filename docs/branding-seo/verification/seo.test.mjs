import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonLd, seoOrigin, publicImageUrl, isPrivateSeoPath, seoText } from '../../../frontend/app/utils/seo.ts';
test('JSON-LD preserves original content while preventing script breakout',()=>{
 const value={description:'</script><script>alert("x")</script> & test\u2028'};const encoded=jsonLd(value);assert(!encoded.includes('<'));assert.deepEqual(JSON.parse(encoded),value);
});
test('canonical does not derive from request hostname, and assets cannot carry secrets',()=>{
 assert.equal(seoOrigin(undefined),'https://www.carteliax.com');assert.equal(seoOrigin('https://www.carteliax.com/a?x=1'),'https://www.carteliax.com');assert.equal(publicImageUrl('/images/logo.png','https://www.carteliax.com'),'https://www.carteliax.com/images/logo.png');for(const url of ['javascript:alert(1)','https://user:password@site.test/image','https://site.test/a?token=secret','https://site.test/a?apikey=secret'])assert.equal(publicImageUrl(url,'https://www.carteliax.com'),undefined);
});
test('private prefixes match only protected routes; descriptions stay readable',()=>{
 for(const path of ['/login','/register','/dashboard','/menus/a/design','/businesses/qr/a','/billing/a','/test-business'])assert(isPrivateSeoPath(path));for(const path of ['/','/restaurante-jordi','/dashboard-restaurante'])assert(!isPrivateSeoPath(path));assert.equal(seoText('<b>Hola</b>   mundo'),'Hola mundo');
});
