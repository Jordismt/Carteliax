<script setup lang="ts">
defineProps<{ title: string; description?: string; eyebrow?: string }>();
</script>
<template>
  <header class="ui-heading">
    <div class="min-w-0"><p v-if="eyebrow" class="ui-eyebrow">{{ eyebrow }}</p><h1 class="ui-title">{{ title }}</h1><p v-if="description" class="ui-description">{{ description }}</p></div>
    <div v-if="$slots.default" class="ui-header-actions"><slot /></div>
  </header>
</template>
