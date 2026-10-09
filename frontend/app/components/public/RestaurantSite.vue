<script setup lang="ts">
import { ArrowDown, MapPin, Phone, Mail, ArrowUpRight, UtensilsCrossed } from 'lucide-vue-next';
import type { PublicSiteResponse } from '~/types/publicSite';
import { SITE_COPY } from '~/utils/publicSiteCopy';
import { localizePublicMenu, localizeRestaurant } from '~/utils/publicMenuLanguages';
import '~/assets/css/restaurant.css';
import { publicSitePath } from '~/utils/publicUrls';
const props = defineProps<{ site: PublicSiteResponse; language: string; preview?: boolean }>();
const emit = defineEmits<{ language: [code: string] }>();
const business = computed(() => props.site.business);
const profile = computed(() => business.value.profile);
const coverUrl = computed(() => business.value.cover_url || props.site.currentMenu?.theme.branding.coverUrl);
const copy = computed(() => SITE_COPY[props.language === 'ca' ? 'val' : props.language] ?? SITE_COPY.es!);
const translated = computed(() => localizeRestaurant(props.site, props.language));
const description = computed(() => translated.value.description);
const about = computed(() => translated.value.about);
const address = computed(() => [profile.value.address, profile.value.postal_code, profile.value.city].filter(Boolean).join(', '));
const directions = computed(() => profile.value.maps_url || (address.value ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.value)}` : ''));
const mapVisible = ref(false);
const mapUrl = computed(() => `https://www.google.com/maps?q=${encodeURIComponent([business.value.name, address.value].join(', '))}&output=embed`);
const phoneUrl = computed(() => `tel:${profile.value.phone.replace(/[^+\d]/g, '')}`);
const socialLinks = computed(() => [['Instagram',profile.value.instagram], ['Facebook',profile.value.facebook], ['TikTok',profile.value.tiktok]].filter(([,url])=>url));
const hours = computed(() => [...profile.value.hours].sort((a,b)=>a.day-b.day));
const languages = computed(() => props.site.currentMenu?.languages?.available ?? []);
const menuTitle = computed(() => {
  const m = props.site.currentMenu;
  return m ? localizePublicMenu(m.categories, m.theme, m.languages, props.language, m.menu.id).menuText?.name || m.menu.name : copy.value.menu;
});
const style = computed(() => {
  const hex = business.value.primary_color || '#16a34a';
  const channels = [0,2,4].map(i => parseInt(hex.slice(i+1,i+3),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const luminance = .2126*(channels[0] ?? 0)+.7152*(channels[1] ?? 0)+.0722*(channels[2] ?? 0);
  return { '--site-primary': hex, '--site-on-primary': luminance>.179?'#000':'#fff' };
});
</script>

<template>
  <div class="restaurant-site" :data-preview="preview || undefined" :class="`site-${profile.template}`" :style="style">
    <a class="skip-link" href="#carta">{{ copy.menu }}</a>
    <nav class="site-nav" :aria-label="business.name">
      <a class="brand" href="#inicio"><PublicRestaurantImage v-if="business.logo_url" class="brand-logo" :src="business.logo_url" :alt="business.name" :width="36" :height="36" eager /><span>{{ business.name }}</span></a>
      <div class="nav-actions"><nav v-if="languages.length > 1" class="restaurant-languages" :aria-label="language === 'fr' ? 'Langue' : language === 'en' ? 'Language' : 'Idioma'"><label class="sr-only" for="restaurant-language">{{ language === 'en' ? 'Language' : language === 'fr' ? 'Langue' : 'Idioma' }}</label><select id="restaurant-language" :value="language" @change="emit('language', ($event.target as HTMLSelectElement).value)"><option v-for="option in languages" :key="option.code" :value="option.code">{{ option.native_name }}</option></select></nav><a class="menu-cta" href="#carta">{{ copy.menu }} <ArrowDown :size="16" /></a></div>
    </nav>
    <main>
      <header id="inicio" class="site-hero" :class="{ 'has-photo': coverUrl }">
        <div class="hero-content">
          <PublicRestaurantImage v-if="business.logo_url" class="hero-logo" :src="business.logo_url" :alt="business.name" :width="64" :height="64" eager />
          <span v-else class="hero-mark" aria-hidden="true"><UtensilsCrossed :size="24" /></span>
          <p v-if="profile.city" class="eyebrow">{{ profile.city }}</p>
          <h1>{{ business.name }}</h1>
          <p v-if="description" class="hero-description">{{ description }}</p>
          <div class="hero-actions"><a class="menu-cta" href="#carta">{{ copy.menu }} <ArrowDown :size="18" /></a><a v-if="directions" class="secondary" :href="directions" target="_blank" rel="noopener noreferrer"><MapPin :size="18" /> {{ copy.directions }}</a></div>
        </div>
        <PublicRestaurantImage v-if="coverUrl" class="hero-photo" :src="coverUrl" :alt="business.name" :width="1200" :height="900" priority />
      </header>
      <!-- Menu first: restaurant information never delays access to dishes. -->
      <section id="carta" class="site-menu" :aria-label="copy.menu">
        <div class="menu-heading"><div><p class="eyebrow">{{ copy.information }}</p><h2>{{ menuTitle }}</h2></div>
          <nav v-if="site.menus.length > 1" class="menu-tabs" :aria-label="copy.menu">
            <NuxtLink v-for="menu in site.menus" :key="menu.slug" :to="publicSitePath(business.public_slug, menu.slug, language)" :aria-current="site.currentMenu?.menu.slug === menu.slug ? 'page' : undefined">{{ menu.translated_names?.[language] || menu.name }}</NuxtLink>
          </nav>
        </div>
        <PublicRestaurantMenu v-if="site.currentMenu" :data="site.currentMenu" :language="language" :preview="preview" />
        <p v-else class="empty-menu">{{ language === 'en' ? 'Our menu will be available soon.' : language === 'fr' ? 'Notre carte sera bientôt disponible.' : language === 'val' ? 'La nostra carta estarà disponible prompte.' : 'Nuestra carta estará disponible pronto.' }}</p>
      </section>
      <section v-if="about" id="nosotros" class="site-section about-section"><p class="eyebrow">{{ business.name }}</p><h2>{{ copy.about }}</h2><p class="prose">{{ about }}</p></section>
      <section v-if="hours.length || profile.phone || profile.whatsapp || profile.email || socialLinks.length || profile.website" class="site-section info-section">
        <div v-if="hours.length"><h2>{{ copy.hours }}</h2><dl class="hours"><div v-for="day in hours" :key="day.day"><dt>{{ copy.days[day.day] }}</dt><dd>{{ day.intervals.length ? day.intervals.map(i => `${i.open} – ${i.close}`).join(' / ') : copy.closed }}</dd></div></dl></div>
        <div v-if="profile.phone || profile.whatsapp || profile.email || socialLinks.length || profile.website"><h2>{{ copy.contact }}</h2><div class="contact-links">
          <a v-if="profile.phone" :href="phoneUrl"><Phone :size="18" /> {{ profile.phone }}</a>
          <a v-if="profile.whatsapp" :href="`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`" target="_blank" rel="noopener noreferrer">WhatsApp <ArrowUpRight :size="16" /></a>
          <a v-if="profile.email" :href="`mailto:${profile.email}`"><Mail :size="18" /> {{ profile.email }}</a>
          <a v-for="[name, url] in socialLinks" :key="name" :href="url" target="_blank" rel="noopener noreferrer">{{ name }} <ArrowUpRight :size="16" /></a>
          <a v-if="profile.website" :href="profile.website" target="_blank" rel="noopener noreferrer">{{ copy.external }} <ArrowUpRight :size="16" /></a>
        </div></div>
      </section>
      <section v-if="address || directions" id="ubicacion" class="site-section location-section"><div><p class="eyebrow">{{ profile.city }}</p><h2>{{ copy.location }}</h2><address v-if="address">{{ address }}</address><a v-if="directions" class="secondary" :href="directions" target="_blank" rel="noopener noreferrer"><MapPin :size="18" />{{ copy.directions }}</a></div>
        <div v-if="profile.address" class="map-area"><iframe v-if="mapVisible" :src="mapUrl" :title="`${copy.location}: ${business.name}`" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen /><button v-else type="button" class="map-placeholder" @click="mapVisible = true"><MapPin :size="28" /><span>{{ copy.map }}</span><small>Google Maps</small></button></div>
      </section>
    </main>
    <footer class="site-footer"><span>{{ business.name }}</span><a href="https://www.carteliax.com" target="_blank" rel="noopener noreferrer">Powered by Carteliax</a></footer>
  </div>
</template>
