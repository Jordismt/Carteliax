<script setup lang="ts">
import { COMMERCIAL_PLAN } from "~/utils/commercialPlan";
import { Store, Plus, RefreshCw, BookOpen, ArrowRight, CreditCard } from "lucide-vue-next";

definePageMeta({
  middleware: "auth",
  layout: "dashboard",
});

useHead({
  title: "Inicio | Carteliax",
});

interface Business {
  public_slug?: string;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

const { apiFetch } = useApi();

const businesses = ref<Business[]>([]);
const { subscriptions, subscriptionsLoading, loadSubscriptions } = useBusinessSubscriptions();
const loading = ref(true);
const errorMessage = ref("");

const subscribedCount = computed(() => Object.values(subscriptions.value).filter((s) => s?.status === "active").length);
const trialCount = computed(() => Object.values(subscriptions.value).filter((s) => s?.status === "trialing").length);

async function loadBusinesses() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const response = await apiFetch<{
      success: boolean;
      businesses: Business[];
    }>("/api/businesses");

    businesses.value = response.businesses;
    void loadSubscriptions(response.businesses.map((business) => business.id));
  } catch (error) {
    console.error(error);
    errorMessage.value = "No hemos podido cargar tus establecimientos.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadBusinesses);
</script>

<template>
  <div class="ui-page">
    <UiPageHeader title="Tu restaurante, al día" description="Elige un establecimiento y entra en sus cartas." eyebrow="TU ESPACIO DE TRABAJO">

      <NuxtLink to="/businesses?create=1" class="ui-secondary"><Plus :size="18" /> Añadir establecimiento</NuxtLink>
    </UiPageHeader>

    <section v-if="!loading && !errorMessage && businesses.length === 0" class="ui-panel">
      <h2 class="text-xl font-semibold">Crea tu primera carta</h2>
      <p class="ui-description">Primero añade tu restaurante, bar o cafetería. Después podrás activar su prueba y preparar la carta.</p>
      <p class="mt-4 text-sm text-slate-600">7 días gratis al activar la suscripción · Después, {{ COMMERCIAL_PLAN.monthlyLabel }} por establecimiento · {{ COMMERCIAL_PLAN.taxLabel }}.</p>
      <NuxtLink to="/businesses?create=1" class="ui-primary mt-6">Crear mi establecimiento <ArrowRight :size="17" /></NuxtLink>
    </section>

    <section v-else aria-labelledby="businesses-title">
      <div class="mb-4 flex items-center justify-between gap-4">
        <h2 id="businesses-title" class="text-base font-semibold">Mis establecimientos <span class="ml-1 font-normal text-slate-500">{{ loading ? '' : businesses.length }}</span></h2>
        <button type="button" aria-label="Actualizar establecimientos y suscripciones" :disabled="loading || subscriptionsLoading" class="ui-secondary p-3" @click="loadBusinesses"><RefreshCw :size="18" :class="{ 'animate-spin': loading || subscriptionsLoading }" /></button>
      </div>
      <div v-if="loading" role="status" aria-label="Cargando establecimientos" class="grid gap-4 md:grid-cols-2">
        <div v-for="n in 2" :key="n" aria-hidden="true" class="ui-panel space-y-4 animate-pulse"><div class="h-5 w-2/3 rounded bg-slate-100" /><div class="h-4 w-1/2 rounded bg-slate-100" /><div class="h-11 rounded bg-slate-100" /></div>
        <span class="sr-only">Cargando establecimientos…</span>
      </div>
      <div v-else-if="errorMessage" role="alert" class="ui-panel border-red-200 bg-red-50">
        <p class="text-sm text-red-800">{{ errorMessage }}</p><button type="button" class="ui-quiet ui-danger mt-2 underline" @click="loadBusinesses">Volver a intentar</button>
      </div>
      <div v-else class="grid gap-4 md:grid-cols-2">
        <article v-for="business in businesses" :key="business.id" class="ui-panel dashboard-business flex flex-col gap-4">
          <div class="business-identity flex items-center gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-50"><img v-if="business.logo_url" :src="business.logo_url" :alt="business.name" class="h-10 w-10 object-contain" /><Store v-else :size="22" class="text-emerald-700" /></div>
            <h3 class="min-w-0 break-words text-lg font-semibold">{{ business.name }}</h3>
          </div>
          <div><SubscriptionBadge :subscription="subscriptions[business.id]" :loading="subscriptionsLoading" /></div>
          <p v-if="business.description" class="line-clamp-2 text-sm leading-6 text-slate-600">{{ business.description }}</p>
          <div class="mt-auto">
            <NuxtLink v-if="subscriptions[business.id]?.status === 'active' || subscriptions[business.id]?.status === 'trialing'" :to="{ path: '/menus', query: { business: business.id } }" class="ui-primary w-full"><BookOpen :size="17" /> Gestionar cartas <ArrowRight :size="17" /></NuxtLink>
            <NuxtLink v-else :to="`/billing/${business.id}`" class="ui-primary w-full"><CreditCard :size="17" /> {{ subscriptions[business.id] === null ? 'Activar establecimiento' : 'Ver suscripción' }}</NuxtLink>
            <div class="mt-2 flex flex-wrap justify-between gap-2">
              <a v-if="business.public_slug" :href="`/${business.public_slug}`" target="_blank" rel="noopener noreferrer" class="ui-quiet">Ver mi web</a>
              <NuxtLink :to="`/businesses/${business.id}`" class="ui-quiet">Configuración</NuxtLink>
              <NuxtLink :to="`/billing/${business.id}`" class="ui-quiet">Facturación</NuxtLink>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
