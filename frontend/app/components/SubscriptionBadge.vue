<script setup lang="ts">
import type { BusinessSubscription } from "~/composables/useSubscription";

const props = defineProps<{ subscription?: BusinessSubscription | null; loading?: boolean }>();
const presentation = computed(() => {
  if (props.loading) return { label: "Consultando suscripción…", tone: "bg-slate-100 text-slate-600" };
  if (props.subscription === undefined) return { label: "Estado no disponible", tone: "bg-slate-100 text-slate-600" };
  switch (props.subscription?.status) {
    case "active": return { label: props.subscription.cancel_at_period_end ? "Activa · cancelación programada" : "Suscripción activa", tone: "bg-emerald-50 text-emerald-800" };
    case "trialing": return { label: props.subscription.cancel_at_period_end ? "Prueba · cancelación programada" : "Prueba gratuita", tone: "bg-emerald-50 text-emerald-800" };
    case "checkout_pending": return { label: "Contratación pendiente", tone: "bg-amber-50 text-amber-800" };
    case "past_due": case "unpaid": return { label: "Revisar pago", tone: "bg-red-50 text-red-800" };
    case "incomplete": return { label: "Contratación incompleta", tone: "bg-amber-50 text-amber-800" };
    case "canceled": return { label: "Suscripción cancelada", tone: "bg-slate-100 text-slate-700" };
    case "paused": return { label: "Suscripción pausada", tone: "bg-amber-50 text-amber-800" };
    default: return { label: "Pendiente de activación", tone: "bg-slate-100 text-slate-700" };
  }
});
</script>

<template>
  <span class="subscription-badge inline-flex max-w-full items-center rounded-lg px-3 py-1.5 text-xs font-semibold" :class="presentation.tone">
    {{ presentation.label }}
  </span>
</template>

<style scoped>
.subscription-badge{font-size:11px;line-height:1.5;border-radius:7px;padding:6px 10px;font-weight:650;letter-spacing:.01em}
</style>
