<script setup lang="ts">
// Public assets keep stable URLs and are shared across all application routes.
const sources = '/images/brand/carteliax-mark-64.webp 1x, /images/brand/carteliax-mark-96.webp 2x';
const fallback = '/images/brand/carteliax-mark-96.png';
</script>
<template>
  <picture class="carteliax-mark" aria-hidden="true">
    <source type="image/webp" :srcset="sources" />
    <img :src="fallback" alt="" width="32" height="32" decoding="async" />
  </picture>
</template>
<style scoped>
.carteliax-mark{display:inline-flex;width:32px;height:32px;max-width:100%;max-height:100%}.carteliax-mark img{display:block;object-fit:contain;width:100%;height:100%}
</style>
