import { createPublicClient } from "../../infrastructure/database/createPublicClient.js";
import { env } from "../../config/env.js";
import { publicSlugSchema, publicProfileSchema } from "../businesses/publicProfileSchemas.js";
import { loadPublicMenu } from "../publicMenus/publicMenuController.js";

export async function loadPublicSite(db, slug, requestedMenu) {
  const { data: business, error } = await db.from("businesses")
    .select("id, name, public_slug, description, logo_url, cover_url, primary_color, default_language, public_profile")
    .eq("public_slug", slug).maybeSingle();
  if (error) throw error;
  if (!business) return null;
  const { data: records, error: menuError } = await db.from("menus").select("id, name, slug, sort_order, menu_themes(published_at, published_config)")
    .eq("business_id", business.id).eq("is_published", true).order("sort_order").order("created_at");
  if (menuError) throw menuError;
  const menus = (records ?? []).filter(m => {
    const t = Array.isArray(m.menu_themes) ? m.menu_themes[0] : m.menu_themes;
    return t?.published_at && t.published_config && Object.keys(t.published_config).length;
  }).map(({ name, slug }) => ({ name, slug }));
  if (requestedMenu && !menus.some(m => m.slug === requestedMenu)) return null;
  const selected = requestedMenu || menus[0]?.slug;
  const currentMenu = selected ? await loadPublicMenu(db, business.id, selected) : null;
  // A publication withdrawn during the request must not leak or silently select another menu.
  if (selected && !currentMenu) return null;
  if (env.TRANSLATIONS_ENABLED && menus.length) {
    const { data: titles, error: titlesError } = await db.rpc('cx_public_menu_titles', { p_business: business.id });
    // Staged rollout: the older database may not have this optional projection.
    // Never fall back to drafts or expose extra fields to get a translated title.
    if (!titlesError && titles) for (const menu of menus) if (titles[menu.slug]) menu.translated_names = titles[menu.slug];
  }
  const parsed = publicProfileSchema.safeParse(business.public_profile ?? {});
  const profile = parsed.success ? parsed.data : publicProfileSchema.parse({});
  const source = JSON.stringify([business.description ?? "", profile.about, business.default_language]);
  profile.translations = profile.translations.filter(t => t.source === source);
  return { success: true, business: { name: business.name, public_slug: business.public_slug, description: business.description, logo_url: business.logo_url, cover_url: business.cover_url, primary_color: business.primary_color, default_language: business.default_language, profile }, menus, currentMenu };
}

export async function getPublicSite(req, res, next) {
  try {
    const parsed = publicSlugSchema.safeParse(req.params.slug);
    const menu = req.query.menu;
    if (!env.MICROSITES_ENABLED || !parsed.success || parsed.data !== req.params.slug || (menu !== undefined && (typeof menu !== "string" || menu.length > 150 || !menu.length))) return res.status(404).json({ message: "Esta web no está disponible." });
    const result = await loadPublicSite(createPublicClient(), parsed.data, menu);
    return result ? res.json(result) : res.status(404).json({ message: "Esta web o carta no está disponible." });
  } catch (error) { next(error); }
}
