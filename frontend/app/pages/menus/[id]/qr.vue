<script setup lang="ts">
// Keep bookmarked private menu QR routes. Ownership/access is checked by the existing menu API.
definePageMeta({ middleware: 'auth', layout: 'dashboard' });
useHead({ title: 'Tu QR | Carteliax' });
const route = useRoute();
const { apiFetch } = useApi();
const errorMessage = ref('');
const menu = ref<{ name: string; business_id: string; slug: string; public_slug?: string } | null>(null);
const business = ref<{ name: string; logo_url: string | null } | null>(null);
const loading = ref(true);
async function openRestaurantQr() {
  const id = String(route.params.id);
  loading.value = true;
  errorMessage.value = '';
  try {
    const response = await apiFetch<{ menu: NonNullable<typeof menu.value> }>(`/api/menus/${encodeURIComponent(id)}`);
    const owner = await apiFetch<{ business: NonNullable<typeof business.value> }>(`/api/businesses/${encodeURIComponent(response.menu.business_id)}`);
    if (id !== String(route.params.id)) return;
    menu.value = response.menu;
    business.value = owner.business;
  } catch { if (id === String(route.params.id)) errorMessage.value = 'No hemos podido abrir el QR de esta carta. Vuelve a intentarlo.'; }
  finally { if (id === String(route.params.id)) loading.value = false; }
}
onMounted(openRestaurantQr);
watch(() => route.params.id, openRestaurantQr);
</script>
<template>
  <div class="ui-page mx-auto max-w-5xl">
    <UiNotice v-if="errorMessage" tone="danger">{{ errorMessage }}<button type="button" class="ui-quiet underline" @click="openRestaurantQr">Reintentar</button></UiNotice>
    <UiSkeleton v-else-if="loading" label="Cargando el QR de la carta…" />
    <template v-else-if="menu && business">
      <NuxtLink :to="`/menus/${route.params.id}`" class="ui-quiet w-fit">Volver a la carta</NuxtLink>
      <UiPageHeader title="QR de esta carta" :description="menu.name" />
      <MenusMenuQrGenerator :business-id="menu.business_id" :slug="menu.slug" :public-slug="menu.public_slug" :restaurant-name="business.name" :menu-name="menu.name" :logo-url="business.logo_url" />
    </template>
  </div>
</template>
