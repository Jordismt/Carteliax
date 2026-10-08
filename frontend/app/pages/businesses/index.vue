<script setup lang="ts">
import { COMMERCIAL_PLAN } from "~/utils/commercialPlan";
import { uiError } from "~/utils/uiErrors";
import { emptyPublicProfile } from "~/types/publicSite";
import { Store, Plus, Pencil, RefreshCw, X, ArrowUpRight, CreditCard } from "lucide-vue-next";

definePageMeta({
  middleware: "auth",
  layout: "dashboard",
});

useHead({ title: "Establecimientos | Carteliax" });

interface Business {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  primary_color: string;
  is_active: boolean;
}

const route = useRoute();
const { apiFetch } = useApi();

const businesses = ref<Business[]>([]);
const micrositesEnabled = ref(false);
const { subscriptions, subscriptionsLoading, loadSubscriptions } = useBusinessSubscriptions();
const loading = ref(true);
const saving = ref(false);
const showForm = ref(route.query.create === "1");
const listError = ref("");
const formError = ref("");

const form = reactive({
  name: "",
  slug: "",
  description: "",
  default_language: "es",
  phone: "", address: "", city: "",
});

function generateSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

const slugManuallyEdited = ref(false);

watch(
  () => form.name,
  (name) => {
    if (!slugManuallyEdited.value) {
      form.slug = generateSlug(name);
    }
  },
);

function resetForm() {
  form.name = "";
  form.slug = "";
  form.description = "";
  form.default_language = "es";
  form.phone = ""; form.address = ""; form.city = "";
  slugManuallyEdited.value = false;
  formError.value = "";
}

function openForm() {
  if (saving.value) return;
  resetForm();
  showForm.value = true;
}

function closeForm() {
  if (saving.value) return;
  showForm.value = false;
  resetForm();
}

async function loadBusinesses() {
  loading.value = true;
  listError.value = "";

  try {
    const response = await apiFetch<{
      success: boolean;
      businesses: Business[];
      microsites_enabled?: boolean;
    }>("/api/businesses");

    businesses.value = response.businesses;
    micrositesEnabled.value = Boolean(response.microsites_enabled);
    void loadSubscriptions(response.businesses.map((business) => business.id));
  } catch {
    listError.value = "No se pudieron cargar los establecimientos.";
  } finally {
    loading.value = false;
  }
}

async function createBusiness() {
  if (saving.value) return;
  saving.value = true;
  formError.value = "";

  try {
    const created = await apiFetch<{ success: boolean; business: Business }>("/api/businesses", {
      method: "POST",
      body: {
        name: form.name,
        slug: form.slug,
        description: form.description,
        default_language: form.default_language,
        ...(micrositesEnabled.value ? { public_slug: form.slug, public_profile: { ...emptyPublicProfile(), phone: form.phone, address: form.address, city: form.city } } : {}),
      },
    });

    showForm.value = false;
    resetForm();
    if (created.business?.id) {
      await navigateTo(`/billing/${created.business.id}`);
      return;
    }
    await loadBusinesses();
  } catch (error: unknown) {
    const failure = error as { statusCode?: number; status?: number; data?: { message?: string } };
    const status = failure?.statusCode ?? failure?.status;

    formError.value =
      status === 409
        ? "Esta dirección ya está en uso. Prueba con otra."
        : uiError(error, "No se pudo crear el establecimiento. Revisa los datos e inténtalo de nuevo.");
  } finally {
    saving.value = false;
  }
}

onMounted(loadBusinesses);
</script>

<template>
  <div class="ui-page">
    <!-- CABECERA -->
    <UiPageHeader title="Mis establecimientos" description="La identidad, la web y las cartas de cada negocio." eyebrow="TUS RESTAURANTES">


      <button
        type="button"
        class="ui-primary"
        :disabled="saving"
        :aria-expanded="showForm"
        aria-controls="create-business-panel"
        @click="showForm ? closeForm() : openForm()">
        <X v-if="showForm" :size="19" />
        <Plus v-else :size="19" />

        {{ showForm ? "Cerrar formulario" : "Nuevo establecimiento" }}
      </button>
    </UiPageHeader>

    <!-- FORMULARIO -->
    <section id="create-business-panel" v-if="showForm" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 class="text-xl font-bold text-slate-950">Añadir establecimiento</h2>

      <p class="mt-2 text-sm text-slate-500">Paso 1 de 2 · Introduce los datos de tu negocio. Después activarás su suscripción.</p>

      <div class="mt-5 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">Crear el establecimiento no inicia ningún cobro. En el siguiente paso podrás activar <strong>7 días gratis</strong> con tarjeta; después, <strong>{{ COMMERCIAL_PLAN.monthlyLabel }} por establecimiento</strong> · {{ COMMERCIAL_PLAN.taxLabel }}.</div>

      <form :aria-busy="saving" class="mt-7 grid gap-5 sm:grid-cols-2" @submit.prevent="createBusiness">
        <div>
          <label for="business-name" class="mb-2 block text-sm font-semibold"> Nombre del negocio </label>

          <input
            id="business-name"
            autocomplete="organization"
            v-model="form.name"
            required
            minlength="2"
            maxlength="100"
            placeholder="Restaurante La Plaza"
            class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />
        </div>

        <div>
          <label for="business-slug" class="mb-2 block text-sm font-semibold"> Dirección de tu web </label>

          <input
            id="business-slug"
            autocapitalize="none"
            :spellcheck="false"
            v-model="form.slug"
            required
            minlength="3"
            maxlength="60"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="restaurante-la-plaza"
            class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            @input="slugManuallyEdited = true" />

          <p class="mt-2 text-xs text-slate-500">Se genera a partir del nombre. Será permanente para proteger tus QR impresos.</p>
        </div>

        <details class="create-business-extra sm:col-span-2"><summary>Completar más datos ahora <span>(opcional)</span></summary><p class="ui-description mb-4">También puedes hacerlo después, desde Configuración.</p><div class="grid gap-5 sm:grid-cols-2">        <div class="sm:col-span-2">
          <label for="business-description" class="mb-2 block text-sm font-semibold"> Descripción </label>

          <textarea
            id="business-description"
            v-model="form.description"
            rows="3"
            maxlength="500"
            placeholder="Describe tu establecimiento..."
            class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />
        </div>

        <template v-if="micrositesEnabled"><div v-for="field in [{key:'phone',label:'Teléfono',type:'tel'},{key:'address',label:'Dirección',type:'text'},{key:'city',label:'Localidad',type:'text'}] as const" :key="field.key"><label :for="`create-${field.key}`" class="mb-2 block text-sm font-semibold">{{ field.label }} (opcional)</label><input :id="`create-${field.key}`" v-model="form[field.key]" :type="field.type" :maxlength="field.key === 'phone' ? 30 : field.key === 'city' ? 100 : 240" class="w-full rounded-xl border border-slate-200 px-4 py-3" /></div><p class="text-sm text-slate-500 sm:col-span-2">Después podrás añadir portada, horario, redes y Sobre nosotros desde Configuración.</p></template>
        <div>
          <label for="business-language" class="mb-2 block text-sm font-semibold"> Idioma principal </label>

          <select
            id="business-language"
            v-model="form.default_language"
            class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3">
            <option value="es">Español</option>
            <option value="ca">Valencià / Català</option>
            <option value="en">English</option>
          </select>
        </div>

        </div></details>
        <p v-if="formError" role="alert" class="text-sm text-red-600 sm:col-span-2">
          {{ formError }}
        </p>

        <div class="sm:col-span-2">
          <button
            type="submit"
            :disabled="saving"
            class="rounded-xl bg-emerald-600 px-7 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {{ saving ? "Creando establecimiento..." : "Crear y continuar" }}
          </button>
        </div>
      </form>
    </section>

    <!-- LISTADO -->
    <section>
      <div class="mb-5 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-slate-950">Tus negocios</h2>

          <p class="mt-1 text-sm text-slate-500">{{ businesses.length }} registrados</p>
        </div>

        <button
          type="button"
          aria-label="Actualizar"
          :disabled="loading"
          class="rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-100"
          @click="loadBusinesses">
          <RefreshCw :size="19" :class="{ 'animate-spin': loading }" />
        </button>
      </div>

      <UiSkeleton v-if="loading" label="Cargando establecimientos…" />

      <div v-else-if="listError" role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-8">
        <p class="text-red-700">
          {{ listError }}
        </p>

        <button type="button" class="mt-3 font-semibold text-red-700 underline" @click="loadBusinesses">
          Reintentar
        </button>
      </div>

      <div v-else-if="businesses.length" class="grid gap-4 md:grid-cols-2">
        <article
          v-for="business in businesses"
          :key="business.id"
          class="ui-panel">
          <div class="flex items-start justify-between gap-4">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-xl"
              :style="{
                backgroundColor: 'var(--ui-accent-soft)',
              }">
              <Store :size="24" class="text-emerald-800" />
            </div>

            <span
              class="rounded-full px-3 py-1 text-xs font-semibold"
              :class="business.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'">
              {{ business.is_active ? "Habilitado" : "Deshabilitado" }}
            </span>
          </div>

          <div class="mt-4"><SubscriptionBadge :subscription="subscriptions[business.id]" :loading="subscriptionsLoading" /></div>

          <h3 class="mt-5 text-xl font-bold text-slate-950">
            {{ business.name }}
          </h3>


          <p v-if="business.description" class="mt-3 line-clamp-2 text-sm text-slate-500">
            {{ business.description }}
          </p>

          <NuxtLink :to="{ path: '/menus', query: { business: business.id } }" class="ui-primary mt-4 w-full">Gestionar cartas <ArrowUpRight :size="16" /></NuxtLink>
          <div class="mt-2 flex flex-wrap justify-between gap-2">
            <NuxtLink :to="`/businesses/${business.id}`" class="ui-quiet"><Pencil :size="16" /> Configuración</NuxtLink>
            <NuxtLink :to="`/businesses/qr/${business.id}`" class="ui-quiet">Tu QR</NuxtLink>
            <NuxtLink :to="`/billing/${business.id}`" class="ui-quiet">Facturación</NuxtLink>
          </div>
        </article>
      </div>

      <div v-else class="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
        <Store :size="36" class="mx-auto text-emerald-600" />

        <h3 class="mt-4 text-lg font-bold text-slate-950">Aún no tienes establecimientos</h3>

        <button type="button" class="mt-5 font-semibold text-emerald-700" @click="openForm">
          Crear mi primer establecimiento
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.create-business-extra{border-top:1px solid var(--ui-border);padding-top:12px}.create-business-extra summary{min-height:44px;line-height:44px;font-size:13px;font-weight:600;color:var(--ui-text)}.create-business-extra summary span{font-weight:400;color:var(--ui-muted)}
</style>
