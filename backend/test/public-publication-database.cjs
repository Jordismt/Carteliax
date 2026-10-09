// Local PostgreSQL integration. Auth, hosted PostgREST and Stripe are NOT tested.
// Run launch-database.cjs first to prepare the disposable, migrated database.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const args = ['-XAt', '-h', '/tmp/carteliax-hardening-pg/socket', '-p', '55439', '-U', 'jordi', '-v', 'ON_ERROR_STOP=1'];
const guard = "DO $$BEGIN IF current_setting('port')<>'55439' OR current_setting('data_directory')<>'/tmp/carteliax-hardening-pg/data' THEN RAISE EXCEPTION 'Disposable QA required'; END IF; END$$;";
const database = execFileSync('psql', [...args, '-d', 'postgres', '-c', guard + "SELECT datname FROM pg_database WHERE datname ~ '^carteliax_launch_[0-9]+$' ORDER BY datname DESC LIMIT 1;"], { encoding: 'utf8' }).trim().split('\n').at(-1);
assert(/^carteliax_launch_[0-9]+$/.test(database));
const literal = value => value == null ? 'NULL' : "'" + String(typeof value === 'object' ? JSON.stringify(value) : value).replaceAll("'", "''") + "'";
function sql(statement, role = 'jordi', actor = '') {
  const out = execFileSync('psql', [...args, '-d', database, '-f', '-'], { input: guard + `BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('request.jwt.claim.sub',${literal(actor)},true);` + statement + '; COMMIT;', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = out.trim().split('\n').filter(line => !['DO', 'BEGIN', 'SET', 'COMMIT', actor, ''].includes(line));
  if (!lines.length && statement.startsWith('SELECT coalesce')) throw Error('Missing local SQL result: ' + JSON.stringify({ out, statement }));
  return lines.at(-1) ?? 'null';
}
function db(role, actor) { return { from(table) {
  assert(/^[a-z_]+$/.test(table));
  let columns = '*', single = false, operation, payload;
  const conditions = [], orders = [];
  const q = {
    select(value = '*') { columns = value.replace(/\s/g, ''); assert(/^[a-z_,*]+$/.test(columns)); return q; },
    eq(key, value) { conditions.push(`${key}=${literal(value)}`); return q; },
    is(key, value) { assert.equal(value, null); conditions.push(`${key} IS NULL`); return q; },
    in(key, values) { conditions.push(`${key} IN (${values.map(literal).join(',')})`); return q; },
    order(key) { orders.push(key); return q; },
    maybeSingle() { single = true; return q; },
    update(value) { operation = 'update'; payload = value; return q; },
    upsert(value, options) { assert.equal(options.ignoreDuplicates, true); operation = 'insert'; payload = value; return q; },
    async then(resolve, reject) {
      try {
        const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
        if (operation) {
          const statement = operation === 'update' ? `UPDATE ${table} SET ${Object.entries(payload).map(([key, value]) => `${key}=${literal(value)}`).join(',')}${where}` : `INSERT INTO ${table}(${Object.keys(payload)}) VALUES(${Object.values(payload).map(literal)}) ON CONFLICT(menu_id) DO NOTHING`;
          sql(statement, role, actor); return resolve({ data: null, error: null });
        }
        const rows = JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM (SELECT ${columns} FROM ${table}${where}${orders.length ? ' ORDER BY ' + orders.join(',') : ''}) t`, role, actor));
        return resolve({ data: single ? rows[0] ?? null : rows, error: null });
      } catch (error) { return reject(error); }
    },
  }; return q;
} }; }
(async () => {
  const { safeEnv } = await import('./helpers/audit-fixture.js'); safeEnv();
  const { ensurePublishedTheme } = await import('../src/modules/menuThemes/menuPublication.js');
  const { loadPublicMenu } = await import('../src/modules/publicMenus/publicMenuController.js');
  // Replace approximate permissive fixture policies with production ownership.
  sql("DO $$DECLARE p record; BEGIN FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND policyname IN ('fixture_permissive','fixture_owner') LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename); END LOOP; END$$");
  sql(fs.readFileSync(__dirname + '/fixtures/production-ownership.sql', 'utf8'));
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', business = '11111111-1111-4111-8111-111111111111', menu = '33333333-3333-4333-8333-333333333333';
  sql(`UPDATE subscriptions SET status='trialing',trial_ends_at=now()+interval '1 day',current_period_end=now()+interval '1 day' WHERE business_id=${literal(business)}; UPDATE menu_themes SET published_config='{}',published_at=NULL,draft_config='{"private":"DRAFT"}' WHERE menu_id=${literal(menu)}`);
  sql(`UPDATE menus SET is_published=true WHERE id=${literal(menu)}; UPDATE products SET name='Paella para 2 personas' WHERE id='77777777-7777-4777-8777-777777777777'`);
  const user = db('authenticated', owner), publicReader = db('service_role');
  assert.equal(await loadPublicMenu(publicReader, business, 'principal'), null);
  await ensurePublishedTheme(user, menu);
  const first = await loadPublicMenu(publicReader, business, 'principal');
  assert(first?.success); assert.equal(first.categories[0].products[0].name, 'Paella para 2 personas');
  assert.equal(JSON.stringify(first).includes('DRAFT'), false);
  const published = sql(`SELECT published_at FROM menu_themes WHERE menu_id=${literal(menu)}`);
  await ensurePublishedTheme(user, menu);
  assert.equal(sql(`SELECT published_at FROM menu_themes WHERE menu_id=${literal(menu)}`), published);
  console.log('PASS valid trial -> publication -> service public reader; private draft excluded; repeated publication unchanged');
  sql("UPDATE products SET name='Actualización real' WHERE id='77777777-7777-4777-8777-777777777777'", 'authenticated', owner);
  assert.equal((await loadPublicMenu(publicReader, business, 'principal')).categories[0].products[0].name, 'Actualización real');
  sql(`UPDATE menus SET is_published=false WHERE id=${literal(menu)}`, 'authenticated', owner);
  assert.equal(await loadPublicMenu(publicReader, business, 'principal'), null);
  console.log('PASS product update visible immediately; unpublished menu unavailable');
  assert.equal(sql(`SELECT count(*) FROM menus WHERE business_id=${literal(business)}`, 'authenticated', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), '0');
  sql(`UPDATE subscriptions SET status='past_due' WHERE business_id=${literal(business)}`);
  assert.equal(sql('SELECT count(*) FROM menus', 'authenticated', owner), '0');
  assert.throws(() => sql(`INSERT INTO products(business_id,name,price) VALUES(${literal(business)},'Denied',1)`, 'authenticated', owner), /row-level security|CX_SUBSCRIPTION/);
  assert.throws(() => sql('SELECT * FROM menus', 'anon'), /permission denied/);
  console.log('PASS actual ownership predicates + restrictive premium RLS deny foreign reads, non-premium writes and anonymous direct table reads');
  console.log('PASS local database integration. Browser, hosted Supabase Auth/Storage and LIVE Stripe remain separate checks.');
})().catch(error => { console.error(error.stderr?.toString() ?? error.stack); process.exitCode = 1; });
