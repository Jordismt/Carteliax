<script setup lang="ts">
import { AlertCircle, RefreshCw, UtensilsCrossed } from "lucide-vue-next";

import { DEFAULT_MENU_THEME } from "~/types/menuTheme";


// ======================================
// TIPOS
// ======================================

import type { PublicMenuResponse } from "~/types/publicSite";
import { seoOrigin, seoText, publicImageUrl } from "~/utils/seo";
import { setResponseStatus } from "h3";

// ======================================
// RUTA
// ======================================

definePageMeta({
  layout: false,
});

const route = useRoute();

const businessId = computed(() => String(route.params.businessId));

const slug = computed(() => String(route.params.slug));

// ======================================
// OBTENER CARTA PÚBLICA
// ======================================

const endpoint = computed(
  () =>
    `/api/public/menus/` + `${encodeURIComponent(businessId.value)}/` + `${encodeURIComponent(slug.value)}`,
);

const { data, pending, error, refresh } = await useFetch<PublicMenuResponse>(endpoint);
if (import.meta.server && error.value) {
  const event = useRequestEvent();
  if (event) setResponseStatus(event, error.value.statusCode === 404 ? 404 : 502);
}

// ======================================
// DATOS DE LA CARTA
// ======================================

const restaurantName = computed(() => data.value?.business.name ?? "Restaurante");

const logoUrl = computed(() => data.value?.business.logo_url ?? null);

const theme = computed(() => data.value?.theme ?? DEFAULT_MENU_THEME);

const categories = computed(() => data.value?.categories ?? []);

const { availableLanguages, selectedLanguage, localized, copy, chooseLanguage } = usePublicMenuLanguage(data);

// ======================================
// SEO
// ======================================

const origin = seoOrigin(useRuntimeConfig().public.siteUrl);
const canonical = origin + `/c/${encodeURIComponent(businessId.value)}/${encodeURIComponent(slug.value)}`;
const seoDescription = computed(() => seoText(localized.value.menuText?.description || data.value?.menu.description || `Consulta la carta digital de ${restaurantName.value}.`));
const seoImage = computed(() => publicImageUrl(theme.value.branding.coverUrl || logoUrl.value, origin));
useHead({ link: [{ rel: 'canonical', href: canonical }] });
useSeoMeta({
  title: () =>
    data.value ? `${localized.value.menuText?.name || data.value.menu.name} | ${restaurantName.value}` : "Carta digital | Carteliax",

  description: () => seoDescription.value,
  ogTitle: () => `${data.value?.menu.name || 'Carta digital'} | ${restaurantName.value}`,
  ogDescription: () => seoDescription.value,
  ogUrl: canonical,
  ogType: 'website',
  ogSiteName: () => restaurantName.value,
  ogImage: () => seoImage.value,
  twitterCard: 'summary_large_image',
  twitterImage: () => seoImage.value,

  robots: () => (data.value ? "index, follow" : "noindex, nofollow"),
});

// ======================================
// FUENTES
// ======================================

useHead({
  htmlAttrs: { lang: () => availableLanguages.value.find((l) => l.code === selectedLanguage.value)?.html_lang ?? "es" },
  link: [
    {
      rel: "stylesheet",
      href:
        "https://fonts.googleapis.com/css2?" +
        "family=Inter:wght@400;500;600;700;800&" +
        "family=Poppins:wght@400;500;600;700&" +
        "family=Montserrat:wght@400;500;600;700&" +
        "family=Playfair+Display:wght@400;600;700&" +
        "family=Lora:wght@400;500;600;700&" +
        "display=swap",
    },
  ],
});
</script>

<template>
  <main class="min-h-screen bg-white">
    <!-- CARGANDO -->

    <div v-if="pending" role="status" class="flex min-h-screen flex-col items-center justify-center gap-5">
      <UtensilsCrossed :size="42" class="animate-pulse text-emerald-600" />

      <p class="text-sm text-slate-500">Cargando carta...</p>
    </div>

    <!-- ERROR -->

    <div
      v-else-if="error || !data"
      role="alert"
      class="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <AlertCircle :size="46" class="text-red-500" />

      <h1 class="mt-5 text-2xl font-bold text-slate-900">Carta no disponible</h1>

      <p class="mt-3 max-w-sm text-sm text-slate-500">
        Esta carta todavía no está publicada o el enlace no es correcto.
      </p>

      <button
        type="button"
        class="mt-6 flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white"
        @click="refresh()">
        <RefreshCw :size="17" />

        Reintentar
      </button>
    </div>

    <!-- CARTA PÚBLICA -->

    <div v-else class="mx-auto min-h-screen w-full">
      <PublicMenuContent :data="data" :language="selectedLanguage" @language="chooseLanguage" />
    </div>
  </main>
</template>

<style scoped>
.language-selector { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; padding: 8px 12px 18px; }
.language-selector button { min-height: 44px; padding: 8px 12px; border: 1px solid transparent; border-radius: 8px; color: var(--menu-text); background: transparent; font: inherit; }
.language-selector button[aria-pressed="true"] { border-color: var(--menu-primary); font-weight: 600; }
</style>
