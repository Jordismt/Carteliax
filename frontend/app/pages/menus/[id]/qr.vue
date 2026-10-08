<script setup lang="ts">
// Keep bookmarked private menu QR routes. Ownership/access is checked by the existing menu API.
definePageMeta({ middleware: 'auth', layout: 'dashboard' });
useHead({ title: 'Tu QR | Carteliax' });
const route = useRoute();
const { apiFetch } = useApi();
const errorMessage = ref('');
async function openRestaurantQr() {
  errorMessage.value = '';
  try {
    const { menu } = await apiFetch<{ menu: { business_id: string } }>(`/api/menus/${encodeURIComponent(String(route.params.id))}`);
    await navigateTo(`/businesses/qr/${encodeURIComponent(menu.business_id)}`, { replace: true });
  } catch { errorMessage.value = 'No hemos podido abrir el QR de tu restaurante. Vuelve a intentarlo.'; }
}
onMounted(openRestaurantQr);
watch(() => route.params.id, openRestaurantQr);
</script>
<template>
  <div class="ui-page mx-auto max-w-5xl">
    <UiNotice v-if="errorMessage" tone="danger">{{ errorMessage }}<button type="button" class="ui-quiet underline" @click="openRestaurantQr">Reintentar</button></UiNotice>
    <UiSkeleton v-else label="Abriendo el QR de tu restaurante…" />
  </div>
</template>
