import { createError, setResponseHeader, type H3Event } from 'h3';
import { useRuntimeConfig } from 'nitropack/runtime';
import { $fetch } from 'ofetch';
import { resolvePublicApiBase } from './publicApiConfig';

export async function fetchPublicApi<T>(event: H3Event, path: string, query?: Record<string, string>): Promise<T> {
  setResponseHeader(event, 'Cache-Control', 'no-store');
  const base = resolvePublicApiBase(useRuntimeConfig(event));
  try {
    return await $fetch<T>(base + path, { query, timeout: 15000, retry: 0 });
  } catch (error: unknown) {
    const upstream = error as { response?: { status?: number }; statusCode?: number; cause?: { code?: string } };
    const status = upstream.response?.status ?? upstream.statusCode;
    if (status === 404) throw createError({ statusCode: 404, message: 'Este contenido no está disponible.' });
    const code = upstream.cause?.code;
    console.error('[PUBLIC_API_PROXY]', {
      statusCode: status ?? 502,
      code: typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'UPSTREAM_UNAVAILABLE',
    });
    throw createError({ statusCode: 502, message: 'No se pudo cargar el contenido público.' });
  }
}
