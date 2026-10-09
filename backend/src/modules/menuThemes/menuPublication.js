import { DEFAULT_THEME } from './menuThemeSchemas.js';

export function hasPublishedTheme(record) {
  const config = record?.published_config;
  return Boolean(record?.published_at && config && typeof config === 'object' && !Array.isArray(config) && Object.keys(config).length);
}

// Publishing a menu must produce a working public URL. Use the default design
// only when there is no published design; never publish an unsaved draft.
export async function ensurePublishedTheme(db, menuId) {
  const { data: existing, error } = await db.from('menu_themes')
    .select('id,published_config,published_at').eq('menu_id', menuId).maybeSingle();
  if (error) throw error;
  if (hasPublishedTheme(existing)) return;
  const now = new Date().toISOString();
  let write;
  if (existing) {
    write = db.from('menu_themes').update({ published_config: DEFAULT_THEME, published_at: now })
      .eq('menu_id', menuId);
    write = existing.published_config == null ? write.is('published_config', null) : write.eq('published_config', JSON.stringify(existing.published_config));
    write = existing.published_at == null ? write.is('published_at', null) : write.eq('published_at', existing.published_at);
  } else {
    write = db.from('menu_themes').upsert({ menu_id: menuId, draft_config: DEFAULT_THEME, published_config: DEFAULT_THEME, published_at: now }, { onConflict: 'menu_id', ignoreDuplicates: true });
  }
  const { error: writeError } = await write;
  if (writeError) throw writeError;
  // A concurrent designer may have won the compare-and-set. Verify its public
  // design rather than overwriting it or marking an incomplete menu published.
  const { data: published, error: readError } = await db.from('menu_themes')
    .select('published_config,published_at').eq('menu_id', menuId).maybeSingle();
  if (readError) throw readError;
  if (!hasPublishedTheme(published)) throw Object.assign(new Error('MENU_PUBLICATION_CONFLICT'), { code: 'MENU_PUBLICATION_CONFLICT', status: 409 });
}
