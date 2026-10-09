<script setup lang="ts">
import { uiError } from "~/utils/uiErrors";
import { publicMenuPath } from "~/utils/publicUrls";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  X,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Store,
  RefreshCw,
  ArrowRight,
  Copy,
} from "lucide-vue-next";

definePageMeta({
  middleware: "auth",
  layout: "dashboard",
});

useHead({
  title: "Mis cartas | Carteliax",
});

interface Business {
  public_slug?: string;
  id: string;
  name: string;
  logo_url: string | null;
}

interface Menu {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_published: boolean;
  public_ready?: boolean;
  sort_order: number;
  created_at: string;
}

const route = useRoute();
const { apiFetch } = useApi();

const businesses = ref<Business[]>([]);
const menus = ref<Menu[]>([]);
const selectedBusinessId = ref("");

const loading = ref(true);
const loadingMenus = ref(false);
const saving = ref(false);
const deletingId = ref<string | null>(null);
const duplicatingId = ref<string | null>(null);
const publishingId = ref<string | null>(null);
const actionBusy = computed(() => saving.value || !!deletingId.value || !!duplicatingId.value || !!publishingId.value);

const showForm = ref(false);
const editingId = ref<string | null>(null);
const slugEdited = ref(false);

const successMessage = ref("");
const errorMessage = ref("");
const formError = ref("");

const form = reactive({
  name: "",
  slug: "",
  description: "",
  is_published: false,
});

const selectedBusiness = computed(() =>
  businesses.value.find((item) => item.id === selectedBusinessId.value),
);

const publishedCount = computed(() => menus.value.filter((menu) => menu.is_published && menu.public_ready !== false).length);

function messageFromError(error: unknown, fallback: string): string {
  return uiError(error, fallback);
}

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

watch(
  () => form.name,
  (name) => {
    if (!editingId.value && !slugEdited.value) {
      form.slug = makeSlug(name);
    }
  },
);

function clearMessages() {
  errorMessage.value = "";
  successMessage.value = "";
  formError.value = "";
}

function resetForm() {
  editingId.value = null;
  slugEdited.value = false;

  form.name = "";
  form.slug = "";
  form.description = "";
  form.is_published = false;

  formError.value = "";
}

function openCreate() {
  if (actionBusy.value || loadingMenus.value) return;
  resetForm();
  clearMessages();
  showForm.value = true;
}

function openEdit(menu: Menu) {
  if (actionBusy.value) return;
  resetForm();
  clearMessages();

  editingId.value = menu.id;
  form.name = menu.name;
  form.slug = menu.slug;
  form.description = menu.description ?? "";
  form.is_published = menu.is_published;

  showForm.value = true;
}

function closeForm() {
  if (saving.value) return;

  showForm.value = false;
  resetForm();
}

async function loadBusinesses() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const response = await apiFetch<{
      success: boolean;
      businesses: Business[];
    }>("/api/businesses");

    businesses.value = response.businesses;

    const requestedId = typeof route.query.business === "string" ? route.query.business : "";

    if (requestedId && businesses.value.some((b) => b.id === requestedId)) {
      selectedBusinessId.value = requestedId;
    } else if (!businesses.value.some((b) => b.id === selectedBusinessId.value)) {
      selectedBusinessId.value = businesses.value[0]?.id ?? "";
    }

    if (selectedBusinessId.value) {
      await loadMenus();
    } else {
      menus.value = [];
    }
  } catch (error) {
    errorMessage.value = messageFromError(error, "No se pudieron cargar los establecimientos.");
  } finally {
    loading.value = false;
  }
}

async function loadMenus() {
  if (!selectedBusinessId.value) {
    menus.value = [];
    return;
  }

  const requestedBusinessId = selectedBusinessId.value;

  loadingMenus.value = true;
  errorMessage.value = "";

  try {
    const response = await apiFetch<{
      success: boolean;
      menus: Menu[];
    }>(`/api/businesses/${requestedBusinessId}/menus`);

    // Evitar mostrar datos de otro negocio
    // si el usuario cambia rápidamente el selector.
    if (selectedBusinessId.value === requestedBusinessId) {
      menus.value = response.menus;
    }
  } catch (error) {
    if (selectedBusinessId.value === requestedBusinessId) {
      menus.value = [];
      errorMessage.value = messageFromError(error, "No se pudieron cargar las cartas.");
    }
  } finally {
    if (selectedBusinessId.value === requestedBusinessId) {
      loadingMenus.value = false;
    }
  }
}

async function changeBusiness(event: Event) {
  const target = event.target as HTMLSelectElement;

  selectedBusinessId.value = target.value;
  menus.value = [];
  showForm.value = false;
  resetForm();
  clearMessages();

  await navigateTo({
    path: "/menus",
    query: {
      business: selectedBusinessId.value,
    },
  });

  await loadMenus();
}

async function saveMenu() {
  if (!selectedBusinessId.value || saving.value) return;

  formError.value = "";
  successMessage.value = "";
  saving.value = true;

  try {
    if (editingId.value) {
      const response = await apiFetch<{
        success: boolean;
        menu: Menu;
      }>(`/api/menus/${editingId.value}`, {
        method: "PATCH",
        body: {
          name: form.name.trim(),
          description: form.description.trim() || null,
          is_published: form.is_published,
        },
      });

      menus.value = menus.value.map((menu) => (menu.id === response.menu.id ? response.menu : menu));

      successMessage.value = "Carta actualizada correctamente.";
    } else {
      const response = await apiFetch<{
        success: boolean;
        menu: Menu;
      }>(`/api/businesses/${selectedBusinessId.value}/menus`, {
        method: "POST",
        body: {
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim() || null,
        },
      });

      menus.value.push(response.menu);

      successMessage.value = "Carta creada correctamente.";
    }

    showForm.value = false;
    resetForm();
  } catch (error) {
    formError.value = messageFromError(error, "No se pudo guardar la carta.");
  } finally {
    saving.value = false;
  }
}

async function togglePublished(menu: Menu) {
  if (actionBusy.value) return;
  publishingId.value = menu.id;
  clearMessages();

  try {
    const response = await apiFetch<{
      success: boolean;
      menu: Menu;
    }>(`/api/menus/${menu.id}`, {
      method: "PATCH",
      body: {
        is_published: !menu.is_published || menu.public_ready === false,
      },
    });

    menus.value = menus.value.map((item) => (item.id === response.menu.id ? response.menu : item));

    successMessage.value = response.menu.is_published
      ? "Carta publicada y disponible para tus clientes."
      : "Carta retirada de publicación.";
  } catch (error) {
    errorMessage.value = messageFromError(error, "No se pudo cambiar el estado de la carta.");
  } finally {
    publishingId.value = null;
  }
}

async function deleteMenu(menu: Menu) {
  if (actionBusy.value) return;
  const confirmed = window.confirm(`¿Eliminar la carta "${menu.name}"? Esta acción no se puede deshacer.`);

  if (!confirmed) return;

  deletingId.value = menu.id;
  clearMessages();

  try {
    await apiFetch(`/api/menus/${menu.id}`, {
      method: "DELETE",
    });

    menus.value = menus.value.filter((item) => item.id !== menu.id);

    successMessage.value = "Carta eliminada correctamente.";
  } catch (error) {
    errorMessage.value = messageFromError(error, "No se pudo eliminar la carta.");
  } finally {
    deletingId.value = null;
  }
}
async function duplicateMenu(menu: Menu) {
  if (actionBusy.value || loadingMenus.value) {
    return;
  }

  const confirmed = window.confirm(
    `¿Quieres duplicar "${menu.name}"?\n\n` +
      "Se copiarán sus categorías, productos asociados " +
      "y diseño. La nueva carta se creará como borrador.",
  );

  if (!confirmed) return;

  const businessId = selectedBusinessId.value;

  duplicatingId.value = menu.id;
  clearMessages();

  try {
    const response = await apiFetch<{
      success: boolean;
      message: string;
      menu: Menu;
    }>(`/api/menus/${menu.id}/duplicate`, {
      method: "POST",
    });

    if (!response.success || !response.menu?.id) {
      throw new Error("El servidor no devolvió la carta duplicada.");
    }

    // Solo actualizar el listado si seguimos
    // visualizando el mismo establecimiento.
    if (selectedBusinessId.value === businessId) {
      menus.value = [...menus.value, response.menu];

      successMessage.value =
        `"${response.menu.name}" se ha creado correctamente. ` +
        "Puedes gestionar su contenido o publicarla.";
    }
  } catch (error) {
    errorMessage.value = messageFromError(error, "No se pudo duplicar la carta.");
  } finally {
    duplicatingId.value = null;
  }
}
async function copyDirectLink(menu: Menu) {
  try {
    const path = publicMenuPath(menu.business_id, menu.slug, selectedBusiness.value?.public_slug);
    await navigator.clipboard.writeText(window.location.origin + path);
    successMessage.value = 'Enlace directo copiado. Puedes compartir esta carta por WhatsApp o en tus redes.';
    errorMessage.value = '';
  } catch { errorMessage.value = 'No se pudo copiar el enlace. Abre Ver carta y copia la dirección de tu navegador.'; }
}
onMounted(loadBusinesses);
</script>

<template>
  <div class="ui-page menu-list-page">
    <section class="ui-heading">
      <div><p class="ui-eyebrow">LA CARTA DE TU NEGOCIO</p><h1 class="ui-title">Mis cartas</h1><p class="ui-description">Elige la carta que quieres actualizar.</p></div>
      <button v-if="selectedBusinessId" type="button" :disabled="actionBusy || loadingMenus" class="ui-primary" @click="openCreate"><Plus :size="18" /> Nueva carta</button>
    </section>

    <section class="ui-panel">
      <label for="business-select" class="mb-2 block text-sm font-semibold text-slate-700">Establecimiento que estás gestionando</label>
      <div class="flex items-center gap-2">
        <select id="business-select" :value="selectedBusinessId" :disabled="loading || actionBusy || businesses.length === 0" class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-3" @change="changeBusiness">
          <option v-for="item in businesses" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
        <button type="button" :disabled="loading || loadingMenus" class="ui-secondary p-3" aria-label="Actualizar cartas" @click="loadMenus"><RefreshCw :size="19" /></button>
      </div>
    </section>

    <p v-if="successMessage" role="status" class="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{{ successMessage }}</p>
    <p v-if="errorMessage" role="alert" class="rounded-lg bg-red-50 p-4 text-sm text-red-800">{{ errorMessage }}</p>
    <NuxtLink v-if="selectedBusinessId" :to="`/businesses/qr/${selectedBusinessId}`" class="ui-secondary w-fit">Tu QR del restaurante</NuxtLink>
    <UiSkeleton v-if="loading || loadingMenus" label="Cargando cartas…" />
    <section v-else-if="errorMessage && menus.length === 0" class="ui-panel">
      <h2 class="text-lg font-semibold">No hemos podido cargar el listado</h2>
      <p class="ui-description">Inténtalo de nuevo para ver tus cartas.</p>
      <button type="button" class="ui-secondary mt-4" @click="businesses.length ? loadMenus() : loadBusinesses()">Reintentar</button>
    </section>
    <section v-else-if="businesses.length === 0" class="ui-panel text-center">
      <h2 class="text-xl font-semibold">Primero crea un establecimiento</h2>
      <p class="ui-description">Las cartas pertenecen a tu restaurante, bar o cafetería.</p>
      <NuxtLink to="/businesses?create=1" class="ui-primary mt-5">Crear establecimiento <ArrowRight :size="17" /></NuxtLink>
    </section>
    <template v-else>
      <section v-if="menus.length === 0" class="ui-panel text-center">
        <h2 class="text-xl font-semibold">Todavía no tienes cartas</h2>
        <p class="ui-description">Crea la primera carta de {{ selectedBusiness?.name }}.</p>
        <button type="button" class="ui-primary mt-5" @click="openCreate">Crear primera carta</button>
      </section>
      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <p>{{ menus.length }} {{ menus.length === 1 ? 'carta' : 'cartas' }} · {{ publishedCount }} publicadas</p>
          <NuxtLink :to="`/billing/${selectedBusinessId}`" class="ui-quiet">Facturación</NuxtLink>
        </div>
        <section aria-label="Cartas del establecimiento" class="grid items-start gap-4 xl:grid-cols-2">
          <article v-for="menu in menus" :key="menu.id" class="ui-panel menu-card">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <h2 class="min-w-0 flex-1 break-words text-xl font-semibold">{{ menu.name }}</h2>
              <span class="rounded-lg px-2.5 py-1.5 text-xs font-semibold" :class="menu.is_published && menu.public_ready !== false ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'">{{ menu.is_published && menu.public_ready === false ? 'Publicación incompleta' : menu.is_published ? 'Publicada' : 'Borrador' }}</span>
            </div>
            <p v-if="menu.description" class="mt-2 text-sm leading-6 text-slate-600">{{ menu.description }}</p>
            <NuxtLink :to="`/menus/${menu.id}`" class="ui-primary mt-4 w-full"><BookOpen :size="18" /> Gestionar carta <ArrowRight :size="17" /></NuxtLink>
            <div class="menu-card-shortcuts mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <NuxtLink :to="`/menus/${menu.id}/design`" class="ui-secondary px-2">Diseño</NuxtLink>
              <NuxtLink :to="`/menus/${menu.id}/languages`" class="ui-secondary px-2">Idiomas</NuxtLink>
              <a :href="publicMenuPath(menu.business_id, menu.slug, selectedBusiness?.public_slug)" target="_blank" rel="noopener noreferrer" class="ui-secondary px-2" :aria-label="`Ver ${menu.name} en una pestaña nueva`">Ver carta</a>
            </div>
            <button type="button" :disabled="actionBusy" class="ui-quiet mt-2 w-full text-emerald-800" @click="togglePublished(menu)">{{ publishingId === menu.id ? 'Actualizando…' : menu.is_published && menu.public_ready === false ? 'Completar publicación' : menu.is_published ? 'Retirar publicación' : 'Publicar carta' }}</button>
            <details class="ui-action-disclosure mt-3"><summary>Más opciones de la carta</summary><div class="flex flex-wrap items-center justify-between gap-1 pt-2">
              <button type="button" class="ui-quiet" @click="copyDirectLink(menu)">Copiar enlace directo</button>
              <button type="button" :disabled="actionBusy" class="ui-quiet" @click="openEdit(menu)"><Pencil :size="15" /> Ajustes</button>
              <button type="button" :disabled="actionBusy || loadingMenus" class="ui-quiet" @click="duplicateMenu(menu)"><LoaderCircle v-if="duplicatingId === menu.id" :size="15" class="animate-spin" /><Copy v-else :size="15" />{{ duplicatingId === menu.id ? 'Duplicando…' : 'Duplicar' }}</button>
              <button type="button" :disabled="actionBusy" class="ui-quiet ui-danger" @click="deleteMenu(menu)">{{ deletingId === menu.id ? 'Eliminando…' : 'Eliminar' }}</button>
            </div></details>
          </article>
        </section>
        <p class="text-sm leading-6 text-slate-600">Al publicar, tu carta queda disponible con su diseño publicado o con el diseño inicial. Los cambios del editor de diseño se publican desde Personalización.</p>
      </template>
    </template>

    <!-- MODAL -->
    <div
      v-if="showForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      @click.self="closeForm">
      <section
        v-dialog-accessibility="closeForm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-form-title"
        class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-emerald-600">
              {{ editingId ? "Editar" : "Nueva carta" }}
            </p>

            <h2 id="menu-form-title" class="mt-2 text-2xl font-extrabold">
              {{ editingId ? "Configurar carta" : "Crear carta" }}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Cerrar"
            class="rounded-lg p-2 hover:bg-slate-100"
            @click="closeForm">
            <X :size="22" />
          </button>
        </div>

        <form :aria-busy="saving" class="mt-7 space-y-5" @submit.prevent="saveMenu">
          <div>
            <label for="menu-name" class="mb-2 block text-sm font-semibold"> Nombre </label>

            <input
              id="menu-name"
              v-model="form.name"
              required
              minlength="2"
              maxlength="100"
              placeholder="Ej.: Carta principal"
              class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />
          </div>

          <div>
            <label for="menu-slug" class="mb-2 block text-sm font-semibold"> Enlace de la carta </label>

            <input
              id="menu-slug"
              v-model="form.slug"
              required
              minlength="2"
              maxlength="60"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              :disabled="!!editingId"
              autocapitalize="none"
              :spellcheck="false"
              placeholder="carta-principal"
              class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500 disabled:bg-slate-50"
              @input="slugEdited = true" />

            <p class="mt-2 text-xs leading-5 text-slate-500">Forma parte del enlace del QR y no podrá modificarse después de crear la carta.</p>
          </div>

          <div>
            <label for="menu-description" class="mb-2 block text-sm font-semibold"> Descripción </label>

            <textarea
              id="menu-description"
              v-model="form.description"
              maxlength="500"
              rows="3"
              placeholder="Describe brevemente esta carta..."
              class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />
          </div>

          <label v-if="editingId" class="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
            <input v-model="form.is_published" type="checkbox" class="h-5 w-5 accent-emerald-600" />

            <span class="text-sm font-semibold"> Marcar carta como publicada </span>
          </label>

          <p v-if="formError" role="alert" class="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {{ formError }}
          </p>

          <div class="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              :disabled="saving"
              class="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600"
              @click="closeForm">
              Cancelar
            </button>

            <button
              type="submit"
              :disabled="saving"
              class="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              <LoaderCircle v-if="saving" :size="18" class="animate-spin" />

              {{ saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear carta" }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>
