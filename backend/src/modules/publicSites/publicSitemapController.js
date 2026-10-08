import { createPublicClient } from '../../infrastructure/database/createPublicClient.js';
import { publicSlugSchema } from '../businesses/publicProfileSchemas.js';
import { env } from '../../config/env.js';
export const SITEMAP_PAGE_SIZE = 500;
export async function loadPublishedSiteSlugs(db, offset = 0) {
  const { data, error } = await db.from('menus')
    .select('is_published,businesses!inner(public_slug),menu_themes!inner(published_at,published_config)')
    .eq('is_published', true).not('menu_themes.published_at', 'is', null)
    .order('business_id').order('id').range(offset, offset + SITEMAP_PAGE_SIZE - 1);
  if (error) throw error;
  const slugs = new Set();
  for (const row of data ?? []) {
    const business = Array.isArray(row.businesses) ? row.businesses[0] : row.businesses;
    const theme = Array.isArray(row.menu_themes) ? row.menu_themes[0] : row.menu_themes;
    const parsed = publicSlugSchema.safeParse(business?.public_slug);
    if (row.is_published && theme?.published_at && theme.published_config && Object.keys(theme.published_config).length && parsed.success && parsed.data === business.public_slug) slugs.add(parsed.data);
  }
  return { slugs: [...slugs], nextOffset: data?.length === SITEMAP_PAGE_SIZE ? offset + SITEMAP_PAGE_SIZE : null };
}
export async function getPublicSitemap(req, res, next) {
  if (!env.MICROSITES_ENABLED) return res.status(404).json({ message: 'Micrositios no disponibles.' });
  const value = req.query.offset ?? '0';
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) > 50000 || Object.keys(req.query).some(k => k !== 'offset')) return res.status(400).json({ message: 'Parámetros no válidos.' });
  try { return res.json(await loadPublishedSiteSlugs(createPublicClient(), Number(value))); } catch (error) { next(error); }
}
