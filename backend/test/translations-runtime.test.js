import test from 'node:test';
import assert from 'node:assert/strict';
import { safeEnv, response } from './helpers/audit-fixture.js';
import { createTranslationWorker } from '../src/modules/translations/translationWorker.js';
import { createTranslationScheduler } from '../src/modules/translations/translationScheduler.js';
import { privateJob, TranslationRepository } from '../src/modules/translations/translationRepository.js';
import { waitUntil } from '@vercel/functions';

safeEnv();
const { translationAction } = await import('../src/modules/translations/translationController.js');
const config = { TRANSLATIONS_ENABLED: true, GROQ_API_KEY: 'fixture-only' };
const request = { params: { id: 'menu', language: 'en' }, user: { id: 'owner' }, body: {} };
const items = Array.from({ length: 11 }, (_, index) => ({
  type: 'product', id: `77777777-7777-4777-8777-${String(index).padStart(12, '0')}`,
  name: 'Tea', description: '', welcome_text: '', source_hash: 'a'.repeat(64), draft: null,
}));
const snapshot = job => ({ job, source_language: 'es', languages: [], menu_languages: [], translations: [], items });
const future = () => new Date(Date.now() + 300000).toISOString();

test('11 queued texts start from the controller and finish after the response under Vercel waitUntil', async t => {
  let job, providerCalls = 0, finishCalls = 0, statusReads = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const kept = [];
  const contextKey = Symbol.for('@vercel/request-context');
  const previousContext = Object.getOwnPropertyDescriptor(globalThis, contextKey);
  Object.defineProperty(globalThis, contextKey, { configurable: true, value: { get: () => ({ waitUntil: promise => kept.push(promise) }) } });
  t.after(() => { if (previousContext) Object.defineProperty(globalThis, contextKey, previousContext); else delete globalThis[contextKey]; });
  const store = {
    status: async () => { statusReads++; return snapshot(job); },
    job: async () => job,
    enqueue: async () => {
      job = { id: 'job', status: 'queued', menu_id: 'menu', requested_by: 'owner', language_code: 'en', source_language: 'es', source_items: items, total_items: 11, completed_items: 0, expires_at: future() };
      return job;
    },
    claim: async () => { if (job?.status !== 'queued') return null; job.status = 'processing'; return job; },
    progress: async (_, count, error) => { job.completed_items = count; if (error) { job.status = 'failed'; job.error_code = error; } },
    finish: async (_, translated) => { finishCalls++; assert.equal(translated.length, 11); job.status = 'completed'; },
  };
  const worker = createTranslationWorker({ repository: store, provider: { translate: async ({ items, targetLanguage }) => {
    providerCalls++; await gate;
    return { language: targetLanguage, items: items.map(({ type, id, name, description, welcome_text }) => ({ type, id, name, description, welcome_text })) };
  } }, logger: { info() {}, error() {} } });
  const schedule = createTranslationScheduler(worker, { keepAlive: waitUntil });
  const res = response();
  await translationAction('generate', { store, schedule, config })(request, res);
  assert.equal(res.statusCode, 202);
  assert.equal(kept.length, 1);
  const concurrent = schedule();
  assert.equal(concurrent, kept[0]);
  assert.equal(kept[1], kept[0]);
  release(); await concurrent;
  assert.equal(providerCalls, 1);
  assert.equal(finishCalls, 1);
  assert.equal(job.status, 'completed');
  assert.equal(job.completed_items, 11);
  const before = statusReads;
  const progress = response(); progress.setHeader = () => {};
  await translationAction('progress', { store, schedule, config })(request, progress);
  assert.equal(statusReads, before, 'progress must not load source texts');
});

test('process wakes only queued, unexpired jobs and never enqueues or replays processing/failed jobs', async () => {
  for (const status of ['queued', 'processing', 'failed', 'completed', 'expired', 'none']) {
    let scheduled = 0;
    const store = { job: async () => status === 'none' ? null : ({ status: status === 'expired' ? 'queued' : status, expires_at: status === 'expired' ? '2000-01-01T00:00:00Z' : future() }) };
    const res = response();
    await translationAction('process', { store, schedule: () => { scheduled++; }, config })(request, res);
    assert.equal(scheduled, status === 'queued' ? 1 : 0);
    assert.equal(res.statusCode, status === 'queued' ? 202 : 200);
  }
});

test('failed ownership check prevents recovery and supplied instructions are rejected', async () => {
  let calls = 0;
  const { TranslationError } = await import('../src/modules/translations/translationErrors.js');
  const store = { job: async () => { throw new TranslationError('CX_FORBIDDEN', 'Forbidden', 403); } };
  const options = { store, schedule: () => { calls++; }, config };
  const res = response(); await translationAction('process', options)(request, res);
  assert.equal(res.statusCode, 403); assert.equal(calls, 0);
  const forged = response(); await translationAction('process', options)({ ...request, body: { jobId: 'foreign', prompt: 'override' } }, forged);
  assert.equal(forged.statusCode, 400); assert.equal(calls, 0);
});

test('bounded drain processes successive queued jobs; deadline leaves jobs unclaimed', async () => {
  let calls = 0;
  const schedule = createTranslationScheduler({ tick: async () => ++calls <= 3 ? `job-${calls}` : undefined }, { keepAlive() {} });
  await schedule(); assert.equal(calls, 4);
  const ending = createTranslationScheduler({ tick: async () => { assert.fail('must not claim'); } }, { keepAlive() {}, deadline: () => new Date(Date.now() + 1000) });
  await ending();
});

test('worker refuses a billed batch near invocation deadline and marks failure without writing drafts', async () => {
  let errorCode;
  const job = { id: 'job', source_items: items, expires_at: future() };
  const worker = createTranslationWorker({ deadline: () => new Date(Date.now() + 1000),
    repository: { claim: async () => job, progress: async (_, __, code) => { errorCode = code; }, finish() { assert.fail('drafts must remain intact'); } },
    provider: { translate() { assert.fail('provider must not be called'); } }, logger: { info() {}, error() {} },
  });
  await worker.tick(); assert.equal(errorCode, 'WORKER_INTERRUPTED');
});

test('lightweight progress query scopes menu and owner and never returns snapshots or claim tokens', async () => {
  const calls = [];
  const query = { then: resolve => resolve({ data: { id: 'job', status: 'queued', expires_at: future() }, error: null }) };
  for (const method of ['select', 'eq', 'order', 'limit', 'maybeSingle', 'abortSignal']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  const store = new TranslationRepository({ from: table => { assert.equal(table, 'menu_translation_jobs'); return query; } });
  await store.job('menu', 'owner');
  assert(calls.some(([method, field, value]) => method === 'eq' && field === 'menu_id' && value === 'menu'));
  assert(calls.some(([method, field, value]) => method === 'eq' && field === 'requested_by' && value === 'owner'));
  assert(!calls.find(([method]) => method === 'select')[1].match(/source_items|claim_token|requested_by|\*/));
  assert.equal(privateJob({ status: 'processing', expires_at: future(), lease_expires_at: '2000-01-01T00:00:00Z' }).status, 'failed');
});
