import { defineEventHandler, getRequestURL, sendRedirect, setResponseHeader } from 'h3';
import { useRuntimeConfig } from 'nitropack/runtime';
import { isPrivateSeoPath, seoOrigin } from '../../app/utils/seo';
export default defineEventHandler(event => {
  const url = getRequestURL(event);
  const origin = seoOrigin(useRuntimeConfig(event).public.siteUrl);
  if (url.hostname === 'carteliax.com' && origin === 'https://www.carteliax.com' && ['GET','HEAD'].includes(event.method)) {
    return sendRedirect(event, origin + url.pathname + url.search, 308);
  }
  if (isPrivateSeoPath(url.pathname) || url.pathname.startsWith('/api/') || ![new URL(origin).hostname, 'carteliax.com'].includes(url.hostname)) setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow');
});
