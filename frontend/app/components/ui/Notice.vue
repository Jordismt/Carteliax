<script setup lang="ts">
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-vue-next';
const props = withDefaults(defineProps<{ tone?: 'success'|'danger'|'info'|'warning'; dismissible?: boolean }>(), { tone: 'info', dismissible: false });
defineEmits<{ dismiss: [] }>();
const icon = computed(() => props.tone === 'success' ? CheckCircle2 : props.tone === 'info' ? Info : AlertCircle);
</script>
<template><div class="ui-notice" :class="`ui-notice-${tone}`" :role="tone === 'danger' ? 'alert' : 'status'"><component :is="icon" :size="19" class="shrink-0" aria-hidden="true" /><div class="min-w-0 flex-1"><slot /></div><button v-if="dismissible" type="button" class="ui-quiet p-2" aria-label="Cerrar mensaje" @click="$emit('dismiss')"><X :size="17" /></button></div></template>
