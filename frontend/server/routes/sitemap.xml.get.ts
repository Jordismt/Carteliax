import { createError, defineEventHandler, setResponseHeader } from 'h3';
import { useRuntimeConfig } from 'nitropack/runtime';
import { fetchPublicApi } from '../utils/publicApiProxy';
import { seoOrigin } from '../../app/utils/seo';
export default defineEventHandler(async event => {
  const origin = seoOrigin(useRuntimeConfig(event).public.siteUrl);
  const urls = new Set([origin + '/']);
  let offset = 0;
  for (let page = 0; page < 100; page++) {
    let catalog: { slugs: string[]; nextOffset: number | null };
    try { catalog = await fetchPublicApi(event, '/api/public/sitemap', { offset: String(offset) }); }
    catch (error: unknown) {
      // Feature disabled/older API: no unknown restaurant is advertised.
      if ((error as { statusCode?: number }).statusCode === 404 && offset === 0) break;
      throw createError({ statusCode: 503, message: 'Sitemap no disponible temporalmente.' });
    }
    if (!Array.isArray(catalog.slugs)) throw createError({ statusCode: 503 });
    for (const slug of catalog.slugs) if (typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 60) urls.add(origin + '/' + slug);
    if (urls.size > 50000) throw createError({ statusCode: 503 });
    if (catalog.nextOffset === null) break;
    if (!Number.isInteger(catalog.nextOffset) || catalog.nextOffset <= offset || page === 99 || urls.size > 50000) throw createError({ statusCode: 503 });
    offset = catalog.nextOffset;
  }
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300');
  return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + [...urls].map(url => `<url><loc>${escape(url)}</loc></url>`).join('') + '</urlset>';
});
