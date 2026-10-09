import type { PreviewCategory, MenuTheme } from "~/types/menuTheme";
import type { PublicLanguages } from "~/types/menuTranslations";
import type { PublicSiteResponse } from '~/types/publicSite';

const allergenNames: Record<string, Record<string, string>> = {
  es: { gluten: 'Cereales que contienen gluten', crustaceans: 'Crustáceos', eggs: 'Huevos', fish: 'Pescado', peanuts: 'Cacahuetes', soybeans: 'Soja', milk: 'Leche', nuts: 'Frutos de cáscara', celery: 'Apio', mustard: 'Mostaza', sesame: 'Sésamo', sulphites: 'Dióxido de azufre y sulfitos', lupin: 'Altramuces', molluscs: 'Moluscos' },
  en: { gluten: "Cereals containing gluten", crustaceans: "Crustaceans", eggs: "Eggs", fish: "Fish", peanuts: "Peanuts", soybeans: "Soybeans", milk: "Milk", nuts: "Nuts", celery: "Celery", mustard: "Mustard", sesame: "Sesame", sulphites: "Sulphur dioxide and sulphites", lupin: "Lupin", molluscs: "Molluscs" },
  fr: { gluten: "Céréales contenant du gluten", crustaceans: "Crustacés", eggs: "Œufs", fish: "Poisson", peanuts: "Arachides", soybeans: "Soja", milk: "Lait", nuts: "Fruits à coque", celery: "Céleri", mustard: "Moutarde", sesame: "Sésame", sulphites: "Anhydride sulfureux et sulfites", lupin: "Lupin", molluscs: "Mollusques" },
  val: { gluten: "Cereals amb gluten", crustaceans: "Crustacis", eggs: "Ous", fish: "Peix", peanuts: "Cacauets", soybeans: "Soja", milk: "Llet", nuts: "Fruits de closca", celery: "Api", mustard: "Mostassa", sesame: "Sèsam", sulphites: "Diòxid de sofre i sulfits", lupin: "Tramussos", molluscs: "Mol·luscs" },
};

export const PUBLIC_MENU_COPY: Record<string, Record<string, string>> = {
  es: { welcome: "Bienvenidos", menu: "Nuestra carta", categories: "Categorías de la carta", discover: "Descubre nuestros platos", dish: "plato", dishes: "platos", preparing: "Estamos preparando nuestra carta", empty: "Todavía no hay platos disponibles. Consulta con el equipo del restaurante.", soon: "Próximamente", emptyCategory: "Todavía no hay platos disponibles en esta categoría.", explore: "Explora nuestra carta", thanks: "Gracias por visitarnos. ¡Buen provecho!", created: "Carta digital creada con", allergens: "Alérgenos", logo: "Logotipo del restaurante", cover: "Imagen de portada del restaurante", language: "Idioma de la carta" },
  en: { welcome: "Welcome", menu: "Our menu", categories: "Menu categories", discover: "Discover our dishes", dish: "dish", dishes: "dishes", preparing: "We are preparing our menu", empty: "No dishes are available yet. Please ask our restaurant team.", soon: "Coming soon", emptyCategory: "No dishes are available in this category yet.", explore: "Explore our menu", thanks: "Thank you for visiting. Enjoy your meal!", created: "Digital menu created with", allergens: "Allergens", logo: "Restaurant logo", cover: "Restaurant cover image", language: "Menu language" },
  fr: { welcome: "Bienvenue", menu: "Notre carte", categories: "Catégories de la carte", discover: "Découvrez nos plats", dish: "plat", dishes: "plats", preparing: "Nous préparons notre carte", empty: "Aucun plat n’est encore disponible. Renseignez-vous auprès de notre équipe.", soon: "Prochainement", emptyCategory: "Aucun plat n’est encore disponible dans cette catégorie.", explore: "Explorez notre carte", thanks: "Merci de votre visite. Bon appétit !", created: "Carte numérique créée avec", allergens: "Allergènes", logo: "Logo du restaurant", cover: "Image de couverture du restaurant", language: "Langue de la carte" },
  val: { welcome: "Benvinguts", menu: "La nostra carta", categories: "Categories de la carta", discover: "Descobrix els nostres plats", dish: "plat", dishes: "plats", preparing: "Estem preparant la nostra carta", empty: "Encara no hi ha plats disponibles. Consulta amb l’equip del restaurant.", soon: "Pròximament", emptyCategory: "Encara no hi ha plats disponibles en esta categoria.", explore: "Explora la nostra carta", thanks: "Gràcies per visitar-nos. Bon profit!", created: "Carta digital creada amb", allergens: "Al·lèrgens", logo: "Logotip del restaurant", cover: "Imatge de portada del restaurant", language: "Idioma de la carta" },
};

export function matchMenuLanguage(value: string | undefined, available: string[]): string | undefined {
  if (!value) return undefined;
  const code = value.toLowerCase();
  if (available.includes(code)) return code;
  const base = code.split("-")[0] ?? "";
  const mapped = base === "ca" ? "val" : base;
  return available.includes(mapped) ? mapped : undefined;
}

// Pure projection. No requests, AI or mutation of the original public response.
export function localizePublicMenu(categories: PreviewCategory[], theme: MenuTheme, languages: PublicLanguages | undefined, language: string, menuId: string) {
  const texts = languages?.translations[language] ?? [];
  const byKey = new Map(texts.map((t) => [`${t.type}:${t.id}`, t]));
  const text = (translated: string | undefined, original: string) => translated?.trim() ? translated : original;
  const menuText = byKey.get(`menu:${menuId}`);
  return {
    menuText,
    theme: { ...theme, branding: { ...theme.branding, welcomeText: text(menuText?.welcome_text, theme.branding.welcomeText) } },
    categories: categories.map((c) => {
      const translatedCategory = byKey.get(`category:${c.id}`);
      return { ...c, name: text(translatedCategory?.name, c.name), products: c.products.map((p) => {
        const candidate = byKey.get(`product:${p.id}`);
        // A missing/stale or incomplete translation falls back as one whole
        // product, rather than combining a translated title with source prose.
        const t = candidate?.name.trim() && (!p.description.trim() || candidate.description.trim()) ? candidate : undefined;
        return { ...p, name: text(t?.name, p.name), description: text(t?.description, p.description), allergens: p.allergens.map((original, index) => allergenNames[language]?.[p.allergen_codes?.[index] ?? ""] ?? original) };
      }) };
    }),
  };
}

export function localizeRestaurant(site: PublicSiteResponse, language: string) {
  const business = site.business;
  const automatic = site.currentMenu?.languages?.translations[language]?.find(item => item.type === 'restaurant' && item.id === site.currentMenu?.business.id);
  if (automatic) return { description: automatic.description, about: automatic.welcome_text };
  const source = JSON.stringify([business.description ?? '', business.profile.about, business.default_language]);
  const manual = business.profile.translations.find(item => item.language === language && item.source === source);
  if (manual && (!(business.description ?? '').trim() || manual.description.trim()) && (!business.profile.about.trim() || manual.about.trim())) return { description: manual.description, about: manual.about };
  return { description: business.description, about: business.profile.about };
}
