<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';

definePageMeta({ middleware: 'auth', layout: 'dashboard' });
useHead({ title: 'Tu QR | Carteliax' });
const route = useRoute();
const { apiFetch } = useApi();
interface QrBusiness { id: string; name: string; public_slug?: string; logo_url: string | null }
const business = ref<QrBusiness | null>(null);
const loading = ref(true);
const errorMessage = ref('');
async function loadBusiness() {
  loading.value = true;
  errorMessage.value = '';
  business.value = null;
  try {
    const response = await apiFetch<{ business: QrBusiness }>(`/api/businesses/${encodeURIComponent(String(route.params.id))}`);
    business.value = response.business;
  } catch {
    errorMessage.value = 'No hemos podido cargar el QR de tu restaurante. Vuelve a intentarlo.';
  } finally { loading.value = false; }
}
watch(() => route.params.id, loadBusiness);
onMounted(loadBusiness);
</script>
<template>
  <div class="ui-page mx-auto max-w-5xl">
    <NuxtLink :to="`/businesses/${route.params.id}`" class="ui-quiet w-fit"><ArrowLeft :size="17" /> Volver al establecimiento</NuxtLink>
    <UiPageHeader title="Tu QR" description="Un restaurante, una web y un QR para todas tus cartas." />
    <UiSkeleton v-if="loading" label="Cargando tu QR…" />
    <UiNotice v-else-if="errorMessage" tone="danger">{{ errorMessage }}<button type="button" class="ui-quiet underline" @click="loadBusiness">Reintentar</button></UiNotice>
    <MenusMenuQrGenerator v-else-if="business" :business-id="business.id" :public-slug="business.public_slug" slug="" :restaurant-name="business.name" menu-name="" :logo-url="business.logo_url" general-only />
    <p v-if="business" class="text-sm leading-6 text-slate-600">Puedes imprimirlo antes de publicar tus cartas. Mientras tanto, tu web indicará que la carta estará disponible pronto. La dirección se mantiene aunque cambies el nombre del restaurante.</p>
  </div>
</template>
