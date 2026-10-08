<script setup lang="ts">
import { isPrivateSeoPath, seoOrigin } from '~/utils/seo';
const route = useRoute();
const origin = seoOrigin(useRuntimeConfig().public.siteUrl);
const preview = useRequestURL().hostname !== new URL(origin).hostname && useRequestURL().hostname !== 'carteliax.com';
useSeoMeta({ robots: () => isPrivateSeoPath(route.path) || preview ? 'noindex, nofollow' : undefined });
useHead(() => ({ link: isPrivateSeoPath(route.path) ? [{ rel: 'canonical', href: origin + route.path }] : [] }));
</script>
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
