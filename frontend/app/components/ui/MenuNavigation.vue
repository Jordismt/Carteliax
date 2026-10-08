<script setup lang="ts">
import { UtensilsCrossed, Palette, Languages, QrCode } from 'lucide-vue-next';
defineProps<{ menuId: string }>();
const route = useRoute();
const items = [{label:'Productos',suffix:'',icon:UtensilsCrossed},{label:'Diseño',suffix:'/design',icon:Palette},{label:'Idiomas',suffix:'/languages',icon:Languages},{label:'QR',suffix:'/qr',icon:QrCode}];
</script>
<template><nav class="ui-menu-navigation" aria-label="Secciones de la carta"><NuxtLink v-for="item in items" :key="item.label" :to="`/menus/${menuId}${item.suffix}`" :aria-current="route.path === `/menus/${menuId}${item.suffix}` ? 'page' : undefined"><component :is="item.icon" :size="17" aria-hidden="true" />{{ item.label }}</NuxtLink></nav></template>
