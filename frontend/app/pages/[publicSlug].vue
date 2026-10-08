<script setup lang="ts">
import type { PublicSiteResponse } from '~/types/publicSite';
import { publicSitePath } from '~/utils/publicUrls';
import { jsonLd, seoOrigin, seoText, publicImageUrl } from '~/utils/seo';
definePageMeta({ layout: false });
const route = useRoute();
const publicSlug = computed(() => String(route.params.publicSlug));
const endpoint = computed(() => `/api/public/sites/${encodeURIComponent(publicSlug.value)}`);
const { data, error } = await useFetch<PublicSiteResponse>(endpoint, { query: computed(() => typeof route.query.menu === 'string' ? { menu: route.query.menu } : {}) });
if (error.value || !data.value) throw createError({ statusCode: error.value?.statusCode === 404 ? 404 : error.value?.statusCode === 503 ? 503 : 502, message: 'Esta web no está disponible.' });
const menu = computed(() => data.value?.currentMenu);
const { selectedLanguage, chooseLanguage } = usePublicMenuLanguage(menu);
const siteLanguage = computed(() => menu.value ? selectedLanguage.value : (data.value?.business.default_language === 'ca' ? 'val' : data.value?.business.default_language ?? 'es'));
const business = computed(() => data.value!.business);
const translated = computed(() => business.value.profile.translations.find(t => t.language === siteLanguage.value));
const description = computed(() => seoText(translated.value?.description || business.value.description || `Consulta la carta digital de ${business.value.name} y la información del restaurante.`));
const origin = seoOrigin(useRuntimeConfig().public.siteUrl);
const canonicalHost = [new URL(origin).hostname, 'carteliax.com'].includes(useRequestURL().hostname);
const indexable = computed(() => !!data.value?.currentMenu && data.value.menus.length > 0 && canonicalHost);
const coverUrl = computed(() => publicImageUrl(business.value.cover_url || menu.value?.theme.branding.coverUrl || business.value.logo_url, origin));
const canonical = computed(() => origin + publicSitePath(business.value.public_slug));
const schema = computed(() => {
  const p = business.value.profile;
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  return { '@context': 'https://schema.org', '@type': 'Restaurant', name: business.value.name, url: canonical.value, description: description.value,
    ...(business.value.cover_url ? { image: publicImageUrl(business.value.cover_url, origin) } : {}), ...(business.value.logo_url ? { logo: publicImageUrl(business.value.logo_url, origin) } : {}),
    ...(p.phone ? { telephone: p.phone } : {}), ...(p.email ? { email: p.email } : {}),
    ...(p.address || p.city ? { address: { '@type': 'PostalAddress', streetAddress: p.address || undefined, addressLocality: p.city || undefined, postalCode: p.postal_code || undefined } } : {}),
    ...(p.maps_url ? { hasMap: p.maps_url } : {}),
    ...(p.hours.some(d=>d.intervals.length) ? { openingHoursSpecification: p.hours.flatMap(d=>d.intervals.map(i=>({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${days[d.day]}`, opens: i.open, closes: i.close }))) } : {}),
    sameAs: [p.instagram,p.facebook,p.tiktok,p.website].filter(Boolean),
    ...(menu.value ? { hasMenu: origin + publicSitePath(business.value.public_slug, menu.value.menu.slug) } : {}),
  };
});
useSeoMeta({ title: () => `${business.value.name} | Carta digital y restaurante`, description: () => description.value,
  ogTitle: () => business.value.name, ogDescription: () => description.value, ogType: 'website', ogUrl: () => canonical.value, ogSiteName: () => business.value.name, ogLocale: () => ({ es: 'es_ES', en: 'en_GB', fr: 'fr_FR', val: 'ca_ES' }[siteLanguage.value] ?? 'es_ES'),
  ogImage: () => coverUrl.value || undefined, twitterTitle: () => business.value.name, twitterDescription: () => description.value, twitterImage: () => coverUrl.value || undefined, twitterCard: 'summary_large_image', robots: () => indexable.value ? 'index, follow' : 'noindex, follow' });
useHead(() => ({ htmlAttrs: { lang: siteLanguage.value === 'val' ? 'ca-valencia' : siteLanguage.value }, link: [{ rel: 'canonical', href: canonical.value }], script: [{ type: 'application/ld+json', innerHTML: jsonLd(schema.value) }] }));
// Browser-native fragment navigation handles QR. Also honor menu-only links.
onMounted(() => { if (route.query.menu) nextTick(() => document.getElementById('carta')?.scrollIntoView()); });
watch(() => route.query.menu, () => nextTick(() => document.getElementById('carta')?.scrollIntoView()));
</script>
<template><PublicRestaurantSite v-if="data" :site="data" :language="siteLanguage" @language="chooseLanguage" /></template>
