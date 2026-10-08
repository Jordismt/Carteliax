<script setup lang="ts">
const props = defineProps<{ src: string; alt: string; width: number; height: number; priority?: boolean }>();
const failed = ref(false);
const element = ref<HTMLImageElement>();
onMounted(() => { if (element.value?.complete && !element.value.naturalWidth) failed.value = true; });
watch(() => props.src, () => { failed.value = false; });
</script>
<template>
  <span class="restaurant-image" :class="{ 'image-failed': failed }">
    <img ref="element" v-if="!failed" :src="src" :alt="alt" :width="width" :height="height" :loading="priority ? 'eager' : 'lazy'" :fetchpriority="priority ? 'high' : 'auto'" decoding="async" @error="failed = true" />
    <span v-else class="image-fallback" role="img" :aria-label="alt">{{ alt.charAt(0) }}</span>
  </span>
</template>
<style scoped>
.restaurant-image{display:block;overflow:hidden;background:var(--site-soft,#edf0e9)}img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .45s ease}.image-fallback{display:grid;place-items:center;width:100%;height:100%;font-family:var(--site-heading,serif);font-size:2rem;color:var(--site-muted,#52605e)}@media(hover:hover){.restaurant-image:hover img{transform:scale(1.025)}}@media(prefers-reduced-motion:reduce){img{transition:none}}
</style>
