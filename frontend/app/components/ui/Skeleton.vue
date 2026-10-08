<script setup lang="ts">
withDefaults(defineProps<{ label?: string; count?: number }>(), { label: 'Cargando…', count: 2 });
</script>
<template><div role="status" :aria-label="label" class="ui-skeleton-list"><div v-for="i in count" :key="i" class="ui-panel ui-skeleton" aria-hidden="true"><div class="ui-skeleton-line" /><div class="ui-skeleton-line short" /><div class="ui-skeleton-line action" /></div><span class="sr-only">{{ label }}</span></div></template>
