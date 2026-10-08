export const CARTELIAX_ORIGIN = 'https://www.carteliax.com';
export function seoOrigin(value: unknown): string {
  try { const url = new URL(String(value)); if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.origin; } catch { /* Canonical default. */ }
  return CARTELIAX_ORIGIN;
}
export function isPrivateSeoPath(path: string): boolean {
  return /^\/(?:dashboard|login|register|businesses|menus|billing|test-business)(?:\/|$)/.test(path);
}
export function seoText(value: string, max = 180): string {
  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : text;
}
export function publicImageUrl(value: string | null | undefined, origin: string): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value, origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || [...url.searchParams.keys()].some(k => /token|signature|api.?key|secret/i.test(k))) return;
    return url.href;
  } catch { return; }
}
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
