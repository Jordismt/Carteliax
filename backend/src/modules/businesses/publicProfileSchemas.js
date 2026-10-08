import { z } from "zod";

export const RESERVED_PUBLIC_SLUGS = Object.freeze(["login", "register", "dashboard", "businesses", "menus", "billing", "api", "c", "test-business", "_nuxt", "_ipx", "nuxt", "ipx", "assets", "public", "admin", "auth", "logout", "settings", "account", "subscriptions", "robots", "sitemap", "favicon", "health", "preview"]);
export function normalizePublicSlug(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
}
export const publicSlugSchema = z.string().trim().transform(normalizePublicSlug).pipe(z.string().min(3).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine(v => !RESERVED_PUBLIC_SLUGS.includes(v) && !/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i.test(v), "Esta dirección está reservada."));
const text = (max) => z.string().trim().max(max).refine(v => !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v), "Utiliza texto sin HTML.").default("");
export function safeHttpsUrl(value, hosts) {
  if (value === "") return true;
  try {
    const u = new URL(value);
    return /^https:\/\/[a-zA-Z0-9.-]+(?:[/?#]|$)/.test(value) && u.protocol === "https:" && !u.username && !u.password && !u.port && !/[\\\s]/.test(value) && (!hosts || hosts.includes(u.hostname));
  } catch { return false; }
}
const url = (hosts) => z.string().trim().max(2048).refine(v => safeHttpsUrl(v, hosts), "Introduce un enlace HTTPS válido.").default("");
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const interval = z.object({ open: time, close: time }).strict().refine(v => v.open !== v.close, "Las horas deben ser diferentes.");
// Empty intervals mean closed; missing days mean unspecified. Closing before
// opening represents an overnight service. Two services/day, no overlaps.
export const openingHoursSchema = z.array(z.object({ day: z.number().int().min(0).max(6), intervals: z.array(interval).max(2) }).strict()).max(7).refine(days => new Set(days.map(d => d.day)).size === days.length, "Día repetido.").refine(days => days.every(d => {
  const ranges = d.intervals.map(i => { const a = Number(i.open.slice(0,2))*60 + Number(i.open.slice(3)); let b = Number(i.close.slice(0,2))*60 + Number(i.close.slice(3)); if(b<a) b+=1440; return [a,b]; }).sort((a,b)=>a[0]-b[0]);
  return ranges.length < 2 || (ranges[0][1] <= ranges[1][0] && ranges[1][1] <= ranges[0][0]+1440);
}), "Los turnos se solapan.");
export const publicProfileSchema = z.object({
  template: z.enum(["modern", "elegant", "minimal", "classic"]).default("modern"),
  about: text(3000), phone: z.string().trim().max(30).regex(/^$|^\+?[0-9 ()-]{6,30}$/).default(""),
  whatsapp: z.string().trim().regex(/^$|^\+?[0-9]{7,15}$/).default(""),
  email: z.union([z.literal(""), z.email().max(254)]).default(""),
  address: text(240), city: text(100), postal_code: text(20),
  maps_url: url(["www.google.com", "google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"]),
  instagram: url(["instagram.com", "www.instagram.com"]),
  facebook: url(["facebook.com", "www.facebook.com"]),
  tiktok: url(["tiktok.com", "www.tiktok.com"]), website: url(),
  hours: openingHoursSchema.default([]),
  translations: z.array(z.object({ language: z.enum(["es", "en", "fr", "val"]), description: text(500), about: text(3000), source: z.string().max(22000) }).strict()).max(4).default([]).refine(rows => new Set(rows.map(r => r.language)).size === rows.length),
}).strict();
