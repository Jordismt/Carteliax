import { createError } from 'h3';

type ApiRuntimeConfig = { apiBaseUrl?: unknown; public?: { apiUrl?: unknown } };

export function resolvePublicApiBase(config: ApiRuntimeConfig): string {
  const privateBase = typeof config.apiBaseUrl === 'string' ? config.apiBaseUrl.trim() : '';
  const publicBase = typeof config.public?.apiUrl === 'string' ? config.public.apiUrl.trim() : '';
  try {
    const base = new URL(privateBase || publicBase);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Invalid API base');
    return base.toString().replace(/\/$/, '');
  } catch {
    // No URL, credentials or environment values in the response/log.
    console.error('[PUBLIC_API_PROXY]', { code: 'PUBLIC_API_CONFIGURATION' });
    throw createError({ statusCode: 503, message: 'La API pública no está configurada correctamente.' });
  }
}
