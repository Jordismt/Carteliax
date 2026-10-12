<script setup lang="ts">
import { Check, ArrowRight } from 'lucide-vue-next';
const NuxtLink = resolveComponent('NuxtLink');
const props = defineProps<{ menuId?: string; businessId?: string; step: 1 | 2 | 3 | 4 }>();
const steps = computed(() => [
  { title: 'Información', detail: 'Nombre y establecimiento', to: props.menuId ? `/menus?edit=${props.menuId}${props.businessId ? '&business=' + props.businessId : ''}` : undefined },
  { title: 'Contenido', detail: 'Categorías y platos', to: props.menuId ? `/menus/${props.menuId}` : undefined },
  { title: 'Diseño', detail: 'Personaliza y previsualiza', to: props.menuId ? `/menus/${props.menuId}/design` : undefined },
  { title: 'Publicación', detail: 'Revisa antes de compartir', to: props.menuId ? `/menus/${props.menuId}/review` : undefined },
]);
</script>
<template>
  <nav class="creation-progress" aria-label="Preparación de la carta">
    <ol><li v-for="(item, index) in steps" :key="item.title" :class="{ current: step === index + 1, completed: step > index + 1 }" :aria-current="step === index + 1 ? 'step' : undefined">
      <component :is="item.to ? NuxtLink : 'span'" :to="item.to" class="creation-step"><span class="step-number"><Check v-if="step > index + 1" :size="15" /><template v-else>{{ index + 1 }}</template></span><span><strong>{{ item.title }}</strong><small>{{ item.detail }}</small></span><ArrowRight class="step-arrow" :size="14" aria-hidden="true" /></component>
    </li></ol>
  </nav>
</template>
<style scoped>
.creation-progress{background:#fff;border:1px solid var(--ui-border,#e2e8f0);border-radius:14px;padding:18px;margin-bottom:24px}.creation-progress ol{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));list-style:none;margin:0;padding:0;gap:12px}.creation-step{display:flex;align-items:center;gap:10px;min-height:44px;text-decoration:none;color:#64748b}.step-number{display:grid;place-items:center;width:30px;height:30px;border:1px solid #e2e8f0;border-radius:50%;font-size:12px;flex-shrink:0}.creation-step strong{display:block;font-size:13px;font-weight:600}.creation-step small{display:block;font-size:11px;margin-top:3px}.step-arrow{margin-left:auto;flex-shrink:0}.current .creation-step{color:#065f46}.current .step-number{background:#065f46;color:white;border-color:#065f46}.completed .step-number{background:#ecfdf5;color:#065f46}.creation-step:focus-visible{outline:2px solid #065f46;outline-offset:4px}li:last-child .step-arrow{display:none}@media(max-width:640px){.creation-progress{padding:12px}.creation-progress ol{gap:6px}.creation-step{flex-direction:column;gap:7px;align-items:center;text-align:center}.creation-step strong{font-size:11px}.creation-step small,.step-arrow{display:none}}
</style>
