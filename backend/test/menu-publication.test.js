import test from 'node:test';
import assert from 'node:assert/strict';
import { ensurePublishedTheme, hasPublishedTheme } from '../src/modules/menuThemes/menuPublication.js';
import { DEFAULT_THEME } from '../src/modules/menuThemes/menuThemeSchemas.js';

// Unit adapter only. PostgreSQL integration lives in public-publication-database.cjs.
function adapter(initial, { beforeWrite, failure } = {}) {
  let record = initial ? structuredClone(initial) : null;
  let writes = 0;
  const db = { from() {
    let operation, payload;
    const filters = [];
    const query = {
      select() { return query; }, maybeSingle() { return query; },
      eq(key, value) { if (key !== 'menu_id') filters.push(row => key === 'published_config' ? JSON.stringify(row[key]) === value : row[key] === value); return query; },
      is(key, value) { filters.push(row => (row[key] ?? null) === value); return query; },
      update(value) { operation = 'update'; payload = value; return query; },
      upsert(value, options) { assert.equal(options.ignoreDuplicates, true); operation = 'insert'; payload = value; return query; },
      async then(resolve, reject) {
        try {
          if (operation) {
            writes++;
            if (beforeWrite) record = beforeWrite(record);
            if (failure) return resolve({ error: failure });
            if (operation === 'insert' && !record) record = structuredClone(payload);
            else if (operation === 'update' && filters.every(check => check(record))) Object.assign(record, structuredClone(payload));
          }
          return resolve({ data: record && structuredClone(record), error: null });
        } catch (error) { return reject(error); }
      },
    };
    return query;
  } };
  return { db, state: () => record, writes: () => writes };
}
test('publication initializes a default public design and is idempotent', async () => {
  const fixture = adapter(null);
  await ensurePublishedTheme(fixture.db, 'menu');
  assert.deepEqual(fixture.state().published_config, DEFAULT_THEME);
  assert(hasPublishedTheme(fixture.state()));
  const snapshot = structuredClone(fixture.state());
  await ensurePublishedTheme(fixture.db, 'menu');
  assert.deepEqual(fixture.state(), snapshot);
  assert.equal(fixture.writes(), 1);
});
test('publication never exposes unpublished editor draft or replaces valid public design', async () => {
  const draft = { branding: { welcomeText: 'Private draft' } };
  const fixture = adapter({ draft_config: draft, published_config: {}, published_at: null });
  await ensurePublishedTheme(fixture.db, 'menu');
  assert.deepEqual(fixture.state().draft_config, draft);
  assert.deepEqual(fixture.state().published_config, DEFAULT_THEME);
  const published = adapter({ draft_config: draft, published_config: { branding: { welcomeText: 'Reviewed' } }, published_at: '2026-10-01' });
  await ensurePublishedTheme(published.db, 'menu');
  assert.equal(published.writes(), 0);
});
test('concurrent designer wins without being overwritten', async () => {
  const design = { branding: { welcomeText: 'Concurrent public design' } };
  const fixture = adapter({ published_config: {}, published_at: null }, { beforeWrite: record => ({ ...record, published_config: design, published_at: '2026-10-09' }) });
  await ensurePublishedTheme(fixture.db, 'menu');
  assert.deepEqual(fixture.state().published_config, design);
});
test('database denial and unresolved concurrent writes prevent publication', async () => {
  const denied = adapter(null, { failure: { code: '42501' } });
  await assert.rejects(ensurePublishedTheme(denied.db, 'menu'), error => error.code === '42501');
  const conflict = adapter({ published_config: {}, published_at: null }, { beforeWrite: record => ({ ...record, published_config: { pending: true } }) });
  await assert.rejects(ensurePublishedTheme(conflict.db, 'menu'), error => error.code === 'MENU_PUBLICATION_CONFLICT');
});
