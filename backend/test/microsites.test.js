import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publicSlugSchema, publicProfileSchema, openingHoursSchema, RESERVED_PUBLIC_SLUGS } from '../src/modules/businesses/publicProfileSchemas.js';
import { createBusinessSchema, updateBusinessSchema } from '../src/modules/businesses/businessSchemas.js';

test('public address normalizes accents safely, rejects reserved routes and empty results', () => {
 assert.equal(publicSlugSchema.parse(' Restaurante Jórdì '),'restaurante-jordi');
 for(const slug of RESERVED_PUBLIC_SLUGS) assert.equal(publicSlugSchema.safeParse(slug).success,false,slug);
 for(const slug of ['@@@','a','12','登录','11111111-1111-4111-8111-111111111111'])assert.equal(publicSlugSchema.safeParse(slug).success,false);
 assert(createBusinessSchema.safeParse({name:'Test',slug:'test',public_slug:'Restaurante Jordi'}).success);
 assert.equal(updateBusinessSchema.safeParse({public_slug:'another'}).success,false);
});
test('strict profile accepts empty optional data and prevents arbitrary HTML, unsafe URLs and arbitrary keys', () => {
 assert.deepEqual(publicProfileSchema.parse({}).hours,[]);
 for(const value of ['javascript:alert(1)','data:text/html,test','http://instagram.com/a','https://instagram.com.evil.test/a','https://user:pass@instagram.com/a','https://instagram.com:443/a','https://instagram.com\\@evil.test/'])assert.equal(publicProfileSchema.safeParse({instagram:value}).success,false,value);
 for(const data of [{about:'<script>alert(1)</script>'},{maps_url:'https://evil.test'},{template:'builder'},{unknown:'yes'},{whatsapp:'invalid'},{email:'invalid'}])assert.equal(publicProfileSchema.safeParse(data).success,false);
 assert(publicProfileSchema.safeParse({instagram:'https://www.instagram.com/restaurant',maps_url:'https://maps.app.goo.gl/place',website:'https://restaurante.example/menu'}).success);
});
test('hours distinguish unspecified, closed, two services and overnight, reject duplicates and overlap',()=>{
 for(const hours of [[],[{day:0,intervals:[]}],[{day:6,intervals:[{open:'20:00',close:'02:00'}]}],[{day:0,intervals:[{open:'13:00',close:'16:00'},{open:'20:00',close:'23:00'}]}]])assert(openingHoursSchema.safeParse(hours).success);
 for(const hours of [[{day:7,intervals:[]}],[{day:0,intervals:[]},{day:0,intervals:[]}],[{day:0,intervals:[{open:'25:00',close:'02:00'}]}],[{day:0,intervals:[{open:'13:00',close:'13:00'}]}],[{day:0,intervals:[{open:'13:00',close:'16:00'},{open:'15:00',close:'20:00'}]}],[{day:0,intervals:[{open:'01:00',close:'03:00'},{open:'20:00',close:'02:00'}]}]])assert.equal(openingHoursSchema.safeParse(hours).success,false);
});
test('public reader and route graph never import provider, worker or translation generation',async()=>{
 for(const name of ['publicSites/publicSiteController.js','publicSites/publicSiteRoutes.js','publicMenus/publicMenuController.js','publicMenus/publicMenuTranslations.js']){
  const source=await readFile(new URL('../src/modules/'+name,import.meta.url),'utf8');
  assert(!/import.*(?:groq|translationService|translationWorker|translationRepository)/i.test(source));
 }
});
