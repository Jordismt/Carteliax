// One URL contract for dashboard links and QR; legacy fallback supports staged rollout.
export function publicSitePath(publicSlug: string, menuSlug?: string, language?: string) {
  const query = new URLSearchParams();
  if (menuSlug) query.set("menu", menuSlug);
  if (language) query.set("lang", language);
  return `/${encodeURIComponent(publicSlug)}${query.size ? `?${query}` : ""}${menuSlug ? "#carta" : ""}`;
}
export function publicMenuPath(businessId: string, menuSlug: string, publicSlug?: string) {
  return publicSlug ? publicSitePath(publicSlug, menuSlug) : `/c/${encodeURIComponent(businessId)}/${encodeURIComponent(menuSlug)}`;
}
