import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicApiBase } from '../../../frontend/server/utils/publicApiConfig.ts';

test('SSR uses explicit private API, falling back to configured public URL only when private is absent', () => {
  assert.equal(resolvePublicApiBase({apiBaseUrl:'https://carteliax-api.vercel.app/',public:{apiUrl:'https://other.example'}}),'https://carteliax-api.vercel.app');
  assert.equal(resolvePublicApiBase({apiBaseUrl:'',public:{apiUrl:'https://carteliax-api.vercel.app/'}}),'https://carteliax-api.vercel.app');
  assert.equal(resolvePublicApiBase({public:{apiUrl:'http://127.0.0.1:5099'}}),'http://127.0.0.1:5099');
});
test('invalid or absent deployment URLs fail closed without exposing their values', () => {
  for(const config of [{},{public:{apiUrl:''}},{apiBaseUrl:'relative'},{apiBaseUrl:'file:///etc/passwd'}, {apiBaseUrl:'https://secret:credential@api.example'}, {apiBaseUrl:'https://api.example?token=secret'}, {apiBaseUrl:'https://api.example#secret'}]) {
    assert.throws(()=>resolvePublicApiBase(config),error=>error.statusCode===503&&!error.message.includes('secret')&&!error.message.includes('credential'));
  }
});
