import type { MenuTheme, PreviewCategory } from "~/types/menuTheme";
import type { PublicLanguages } from "~/types/menuTranslations";
export interface PublicMenuResponse {
  success: boolean;
  business: { id: string; name: string; logo_url: string | null; public_slug?: string };
  menu: { id: string; name: string; slug: string; description: string | null };
  theme: MenuTheme; categories: PreviewCategory[]; languages?: PublicLanguages;
}
export interface OpeningDay { day: number; intervals: { open: string; close: string }[] }
export interface ProfileTranslation { language: string; description: string; about: string; source: string }
export interface PublicProfile {
  template: "modern" | "elegant" | "minimal" | "classic";
  about: string; phone: string; whatsapp: string; email: string;
  address: string; city: string; postal_code: string; maps_url: string;
  instagram: string; facebook: string; tiktok: string; website: string;
  hours: OpeningDay[]; translations: ProfileTranslation[];
}
export const emptyPublicProfile = (): PublicProfile => ({ template: "modern", about: "", phone: "", whatsapp: "", email: "", address: "", city: "", postal_code: "", maps_url: "", instagram: "", facebook: "", tiktok: "", website: "", hours: [], translations: [] });
export interface PublicSiteResponse {
  success: boolean;
  business: { name: string; public_slug: string; description: string | null; logo_url: string | null; cover_url: string | null; primary_color: string; default_language: string; profile: PublicProfile };
  menus: { name: string; slug: string }[];
  currentMenu: PublicMenuResponse | null;
}
