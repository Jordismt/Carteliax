<script setup lang="ts">
import { BookOpen, QrCode, Languages, ArrowLeft } from 'lucide-vue-next';
</script>
<template>
  <main class="auth-screen auth-layout">
    <aside class="auth-story" aria-label="Carteliax para tu restaurante"><NuxtLink to="/" class="auth-brand">Carteliax<span>.</span></NuxtLink><div class="auth-story-content"><p class="ui-eyebrow">HECHO PARA TU RESTAURANTE</p><h2>Tu carta.<br />Tu identidad.<br /><span>Todo a mano.</span></h2><p>Prepara la carta, comparte tu web y atiende a tus clientes. Desde un único lugar.</p><ul><li><BookOpen :size="20" /> Tu carta, siempre al día</li><li><QrCode :size="20" /> Un enlace para compartir</li><li><Languages :size="20" /> Idiomas para tus clientes</li></ul></div><p class="auth-story-footer">Carteliax · Mini web y carta digital</p></aside>
    <section class="auth-form-area"><NuxtLink to="/" class="auth-mobile-brand">Carteliax<span>.</span></NuxtLink><NuxtLink to="/" class="auth-back"><ArrowLeft :size="16" /> Volver al inicio</NuxtLink><div class="auth-form-card"><slot /></div></section>
  </main>
</template>
