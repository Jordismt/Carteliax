<script setup lang="ts">
import type { NuxtError } from '#app';
const props = defineProps<{ error: NuxtError }>();
const missing = computed(() => props.error.statusCode === 404);
useSeoMeta({ title: () => missing.value ? 'Página no encontrada | Carteliax' : 'Página no disponible | Carteliax', description: 'Vuelve al inicio de Carteliax o comprueba la dirección de la página.', robots: 'noindex, nofollow' });
</script>
<template>
  <main class="error-screen">
    <a href="/" class="error-brand"><UiBrandMark /> <span>Carteliax</span></a>
    <p class="ui-eyebrow">{{ error.statusCode }}</p>
    <h1 class="ui-title">{{ missing ? 'No encontramos esta página' : 'Esta página no está disponible ahora' }}</h1>
    <p class="ui-description">{{ missing ? 'Comprueba la dirección o vuelve al inicio.' : 'Inténtalo de nuevo en unos momentos.' }}</p>
    <a href="/" class="ui-primary">Volver al inicio</a>
  </main>
</template>
<style scoped>
.error-screen{min-height:100dvh;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:20px;max-width:720px;margin:auto;padding:32px 24px}.error-brand{display:flex;align-items:center;gap:10px;font-size:24px;font-weight:700;margin-bottom:30px}
</style>
