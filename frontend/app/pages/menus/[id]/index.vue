<script setup lang="ts">
import { uiError } from "~/utils/uiErrors";
import { publicMenuPath } from "~/utils/publicUrls";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  X,
  LoaderCircle,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Palette,
  QrCode,
  MoreHorizontal,
  UtensilsCrossed,
} from "lucide-vue-next";

definePageMeta({
  middleware: "auth",
  layout: "dashboard",
});

useHead({
  title: "Gestionar carta | Carteliax",
});

interface Menu {
  public_slug?: string;
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_published: boolean;
  public_ready?: boolean;
}

interface Category {
  id: string;
  menu_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
}

const route = useRoute();
const { apiFetch } = useApi();

const menuId = computed(() => String(route.params.id));
const menu = ref<Menu | null>(null);
const categories = ref<Category[]>([]);
const categoryCounts = ref<Record<string, number>>({});
const loading = ref(true);
const saving = ref(false);
const reordering = ref(false);
const busyCategoryId = ref<string | null>(null);
const selectedCategoryId = ref("");
const openOptionsId = ref<string | null>(null);
const showModal = ref(false);
const categoryNavigationOpen = ref(false);
let categoryMedia: MediaQueryList | undefined;
function adaptCategoryNavigation() { categoryNavigationOpen.value = categoryMedia?.matches ?? false; }
onMounted(() => { categoryMedia = window.matchMedia('(min-width: 1280px)'); adaptCategoryNavigation(); categoryMedia.addEventListener('change', adaptCategoryNavigation); });
onBeforeUnmount(() => categoryMedia?.removeEventListener('change', adaptCategoryNavigation));
const editingId = ref<string | null>(null);
const errorMessage = ref("");
const successMessage = ref("");
const formError = ref("");

const form = reactive({
  name: "",
  description: "",
});

const sortedCategories = computed(() =>
  [...categories.value].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
  ),
);

const selectedCategory = computed(
  () => sortedCategories.value.find((c) => c.id === selectedCategoryId.value) ?? null,
);

const busy = computed(() => saving.value || reordering.value || Boolean(busyCategoryId.value));

function getError(error: unknown, fallback: string): string {
  return uiError(error, fallback);
}

function clearMessages() {
  errorMessage.value = "";
  successMessage.value = "";
  formError.value = "";
}

function selectCategory(id: string) {
  if (busy.value) return;
  selectedCategoryId.value = id;
  openOptionsId.value = null;
}

async function loadEditor() {
  const requestedId = menuId.value;
  loading.value = true;
  clearMessages();

  try {
    const [menuResponse, categoryResponse] = await Promise.all([
      apiFetch<{ menu: Menu }>(`/api/menus/${requestedId}`),
      apiFetch<{ categories: Category[] }>(`/api/menus/${requestedId}/categories`),
    ]);

    if (menuId.value !== requestedId) return;

    menu.value = menuResponse.menu;
    categories.value = categoryResponse.categories ?? [];

    if (!categories.value.some((c) => c.id === selectedCategoryId.value)) {
      selectedCategoryId.value = sortedCategories.value[0]?.id ?? "";
    }
  } catch (error) {
    if (menuId.value !== requestedId) return;

    errorMessage.value = getError(error, "No se pudo cargar la carta.");
  } finally {
    if (menuId.value === requestedId) {
      loading.value = false;
    }
  }
}

function openCreate() {
  if (busy.value) return;

  clearMessages();
  editingId.value = null;
  form.name = "";
  form.description = "";
  openOptionsId.value = null;
  showModal.value = true;
}

function openEdit(category: Category) {
  if (busy.value) return;

  clearMessages();
  editingId.value = category.id;
  form.name = category.name;
  form.description = category.description ?? "";
  openOptionsId.value = null;
  showModal.value = true;
}

function closeModal() {
  if (saving.value) return;
  showModal.value = false;
  editingId.value = null;
}

async function saveCategory() {
  if (busy.value) return;

  const name = form.name.trim();

  if (name.length < 2) {
    formError.value = "Introduce un nombre de al menos 2 caracteres.";
    return;
  }

  saving.value = true;
  formError.value = "";

  try {
    const body = {
      name,
      description: form.description.trim() || null,
    };

    if (editingId.value) {
      const response = await apiFetch<{
        category: Category;
      }>(`/api/categories/${editingId.value}`, {
        method: "PATCH",
        body,
      });

      categories.value = categories.value.map((c) => (c.id === response.category.id ? response.category : c));

      successMessage.value = "Categoría actualizada correctamente.";
    } else {
      const response = await apiFetch<{
        category: Category;
      }>(`/api/menus/${menuId.value}/categories`, {
        method: "POST",
        body,
      });

      categories.value.push(response.category);
      selectedCategoryId.value = response.category.id;

      successMessage.value = "Categoría creada. Ya puedes añadir platos.";
    }

    showModal.value = false;
    editingId.value = null;
  } catch (error) {
    formError.value = getError(error, "No se pudo guardar la categoría.");
  } finally {
    saving.value = false;
  }
}

async function toggleVisibility(category: Category) {
  if (busy.value) return;

  busyCategoryId.value = category.id;
  clearMessages();

  try {
    const response = await apiFetch<{
      category: Category;
    }>(`/api/categories/${category.id}`, {
      method: "PATCH",
      body: {
        is_visible: !category.is_visible,
      },
    });

    categories.value = categories.value.map((c) => (c.id === response.category.id ? response.category : c));

    successMessage.value = response.category.is_visible ? "Categoría visible." : "Categoría oculta.";
  } catch (error) {
    errorMessage.value = getError(error, "No se pudo cambiar la visibilidad.");
  } finally {
    busyCategoryId.value = null;
    openOptionsId.value = null;
  }
}

async function deleteCategory(category: Category) {
  if (busy.value) return;

  const confirmed = window.confirm(
    `¿Eliminar la categoría "${category.name}"?\n\n` +
      "Esta acción eliminará la categoría. " +
      "Comprueba antes que no necesitas conservarla.",
  );

  if (!confirmed) return;

  busyCategoryId.value = category.id;
  clearMessages();

  try {
    await apiFetch(`/api/categories/${category.id}`, {
      method: "DELETE",
    });

    categories.value = categories.value.filter((c) => c.id !== category.id);

    const counts = { ...categoryCounts.value };
    delete counts[category.id];
    categoryCounts.value = counts;

    if (selectedCategoryId.value === category.id) {
      selectedCategoryId.value = sortedCategories.value[0]?.id ?? "";
    }

    successMessage.value = "Categoría eliminada correctamente.";
  } catch (error) {
    errorMessage.value = getError(error, "No se pudo eliminar la categoría.");
  } finally {
    busyCategoryId.value = null;
    openOptionsId.value = null;
  }
}

async function moveCategory(category: Category, direction: -1 | 1) {
  if (busy.value) return;

  const current = sortedCategories.value;
  const index = current.findIndex((c) => c.id === category.id);
  const target = index + direction;

  if (index < 0 || target < 0 || target >= current.length) return;

  const reordered = [...current];

  [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];

  reordering.value = true;
  clearMessages();

  try {
    await apiFetch(`/api/menus/${menuId.value}/categories/order`, {
      method: "PATCH",
      body: {
        categoryIds: reordered.map((c) => c.id),
      },
    });

    categories.value = reordered.map((c, position) => ({
      ...c,
      sort_order: position,
    }));

    successMessage.value = "Orden de las categorías actualizado.";
  } catch (error) {
    errorMessage.value = getError(error, "No se pudo actualizar el orden.");

    try {
      const response = await apiFetch<{
        categories: Category[];
      }>(`/api/menus/${menuId.value}/categories`);

      categories.value = response.categories;
    } catch {
      errorMessage.value += " Recarga la página para recuperar el orden.";
    }
  } finally {
    reordering.value = false;
    openOptionsId.value = null;
  }
}

watch(menuId, () => {
  menu.value = null;
  categories.value = [];
  categoryCounts.value = {};
  selectedCategoryId.value = "";
  openOptionsId.value = null;
  void loadEditor();
});

onMounted(loadEditor);
</script>

<template>
  <div class="ui-page mx-auto max-w-7xl">
    <UiSkeleton v-if="loading" label="Cargando carta…" :count="3" />

    <template v-else>
      <section v-if="menu" class="ui-heading">
        <div class="min-w-0">
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <NuxtLink :to="`/menus?business=${menu.business_id}`" class="ui-quiet -ml-2">
              <ArrowLeft :size="17" />
              Mis cartas
            </NuxtLink>
            <span class="rounded-lg px-2.5 py-1 text-xs font-semibold" :class="menu.is_published ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'">{{ menu.is_published ? 'Publicada' : 'Borrador' }}</span>
          </div>
          <h1 class="ui-title break-words">{{ menu.name }}</h1>
        </div>
        <a :href="publicMenuPath(menu.business_id, menu.slug, menu.public_slug)" target="_blank" rel="noopener noreferrer" class="ui-secondary"><Eye :size="17" /> Ver carta</a>
      </section>

      <UiMenuNavigation v-if="menu" :menu-id="menuId" />
      <UiNotice v-if="menu" tone="info"><strong>{{ menu.is_published && menu.public_ready === false ? 'La publicación está incompleta. Pulsa Completar publicación en Mis cartas o publica el diseño desde Personalización.' : menu.is_published ? 'Esta carta está publicada.' : 'Esta carta todavía es un borrador.' }}</strong> Los productos, precios y disponibilidad se actualizan al guardar. Los cambios de diseño y los idiomas se publican desde sus secciones.</UiNotice>
      <!-- Notificaciones -->
      <div
        v-if="successMessage"
        role="status"
        class="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
        <CheckCircle2 :size="19" class="shrink-0" />
        <span class="flex-1">
          {{ successMessage }}
        </span>
        <button type="button" aria-label="Cerrar" @click="successMessage = ''">
          <X :size="16" />
        </button>
      </div>

      <div
        v-if="errorMessage"
        role="alert"
        class="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle :size="19" class="shrink-0" />
        <span class="flex-1">
          {{ errorMessage }}
        </span>
        <button type="button" aria-label="Cerrar" @click="errorMessage = ''">
          <X :size="16" />
        </button>
      </div>

      <template v-if="menu">
        <div class="grid items-start gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
          <!-- Categorías -->
          <aside id="editor-categories" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <details class="category-management" :open="categoryNavigationOpen" @toggle="categoryNavigationOpen = ($event.target as HTMLDetailsElement).open">
              <summary class="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700">
                Organizar categorías <span class="text-slate-500">{{ categories.length }} · <span class="category-closed">Abrir</span><span class="category-open">Cerrar</span></span>
              </summary>
            <header class="border-b border-slate-100 p-5">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-lg font-black text-slate-950">Categorías</h2>
                  <p class="mt-1 text-xs text-slate-500">
                    {{ categories.length }}
                    {{ categories.length === 1 ? "categoría" : "categorías" }}
                  </p>
                </div>

                <button
                  type="button"
                  :disabled="busy"
                  aria-label="Nueva categoría"
                  title="Nueva categoría"
                  class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  @click="openCreate">
                  <Plus :size="20" />
                </button>
              </div>
            </header>

            <!-- Sin categorías -->
            <div v-if="!categories.length" class="p-6 text-center">
              <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
                <BookOpen :size="28" class="text-emerald-600" />
              </div>

              <h3 class="mt-4 font-extrabold text-slate-900">Crea tu primera categoría</h3>

              <p class="mt-2 text-sm leading-relaxed text-slate-500">
                Por ejemplo: entrantes, principales, bebidas o postres.
              </p>

              <button
                type="button"
                :disabled="busy"
                class="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                @click="openCreate">
                Crear categoría
              </button>
            </div>

            <!-- Lista de categorías -->
            <div v-else class="space-y-2 p-3">
              <article
                v-for="(category, index) in sortedCategories"
                :key="category.id"
                class="overflow-hidden rounded-xl border transition"
                :class="
                  selectedCategoryId === category.id
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                ">
                <div class="flex items-center gap-1 p-1">
                  <button
                    type="button"
                    :disabled="busy"
                    :aria-current="selectedCategoryId === category.id ? 'true' : undefined"
                    class="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-3 text-left disabled:opacity-50"
                    @click="selectCategory(category.id)">
                    <span
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      :class="
                        selectedCategoryId === category.id
                          ? 'bg-white text-emerald-600'
                          : 'bg-slate-100 text-slate-400'
                      ">
                      <UtensilsCrossed :size="17" />
                    </span>

                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-extrabold text-slate-900">
                        {{ category.name }}
                      </span>

                      <span
                        class="mt-0.5 block text-xs"
                        :class="category.is_visible ? 'text-emerald-700' : 'text-amber-700'">
                        {{ category.is_visible ? "Visible" : "Oculta" }}
                        <template v-if="categoryCounts[category.id] !== undefined">
                          · {{ categoryCounts[category.id] }}
                          {{ categoryCounts[category.id] === 1 ? "plato" : "platos" }}
                        </template>
                      </span>
                    </span>

                    <ChevronRight
                      v-if="selectedCategoryId === category.id"
                      :size="16"
                      class="shrink-0 text-emerald-600" />
                  </button>

                  <button
                    type="button"
                    :disabled="busy"
                    :aria-label="`Opciones de ${category.name}`"
                    :aria-expanded="openOptionsId === category.id"
                    class="rounded-lg p-2 text-slate-500 hover:bg-white disabled:opacity-50"
                    @click="openOptionsId = openOptionsId === category.id ? null : category.id">
                    <MoreHorizontal :size="19" />
                  </button>
                </div>

                <!-- Acciones de categoría -->
                <div v-if="openOptionsId === category.id" class="space-y-1 border-t border-slate-200 p-2">
                  <button type="button" :disabled="busy" class="category-action" @click="openEdit(category)">
                    <Pencil :size="15" />
                    Editar categoría
                  </button>

                  <button
                    type="button"
                    :disabled="busy"
                    class="category-action"
                    @click="toggleVisibility(category)">
                    <EyeOff v-if="category.is_visible" :size="15" />
                    <Eye v-else :size="15" />
                    {{ category.is_visible ? "Ocultar categoría" : "Mostrar categoría" }}
                  </button>

                  <div class="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      :disabled="busy || index === 0"
                      class="category-action justify-center"
                      @click="moveCategory(category, -1)">
                      <ChevronUp :size="15" />
                      Subir
                    </button>

                    <button
                      type="button"
                      :disabled="busy || index === sortedCategories.length - 1"
                      class="category-action justify-center"
                      @click="moveCategory(category, 1)">
                      <ChevronDown :size="15" />
                      Bajar
                    </button>
                  </div>

                  <button
                    type="button"
                    :disabled="busy"
                    class="category-action text-red-600 hover:bg-red-50"
                    @click="deleteCategory(category)">
                    <Trash2 :size="15" />
                    Eliminar categoría
                  </button>
                </div>
              </article>

              <button
                type="button"
                :disabled="busy"
                class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-3 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                @click="openCreate">
                <Plus :size="17" />
                Añadir categoría
              </button>
            </div>
            </details>
          </aside>

          <!-- Gestor de platos -->
          <section class="min-w-0 space-y-4">
            <ProductManager
              v-if="categories.length"
              :business-id="menu.business_id"
              :categories="categories"
              :initial-category-id="selectedCategoryId"
              @category-change="selectedCategoryId = $event"
              @category-counts="categoryCounts = $event" />

            <div
              v-else
              class="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <BookOpen :size="38" class="mx-auto text-emerald-500" />

              <h3 class="mt-5 text-xl font-extrabold text-slate-900">Empieza por una categoría</h3>

              <p class="mt-2 text-sm text-slate-500">Después podrás crear tus platos y añadirlos a ella.</p>

              <button
                type="button"
                class="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                @click="openCreate">
                Crear categoría
              </button>
            </div>
          </section>
        </div>
      </template>
    </template>

    <!-- Modal de categoría -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      @click.self="closeModal">
      <section
        v-dialog-accessibility="closeModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-form-title"
        class="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-emerald-600">
              Organización de la carta
            </p>

            <h2 id="category-form-title" class="mt-2 text-2xl font-black text-slate-950">
              {{ editingId ? "Editar categoría" : "Nueva categoría" }}
            </h2>
          </div>

          <button
            type="button"
            :disabled="saving"
            aria-label="Cerrar"
            class="rounded-xl p-2 hover:bg-slate-100 disabled:opacity-50"
            @click="closeModal">
            <X :size="21" />
          </button>
        </div>

        <form class="mt-7 space-y-5" @submit.prevent="saveCategory">
          <div>
            <label for="category-name" class="mb-2 block text-sm font-bold text-slate-700">
              Nombre de la categoría *
            </label>

            <input
              id="category-name"
              v-model="form.name"
              required
              minlength="2"
              maxlength="100"
              placeholder="Ej.: Entrantes"
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" />
          </div>

          <div>
            <label for="category-description" class="mb-2 block text-sm font-bold text-slate-700">
              Descripción
              <span class="font-normal text-slate-400"> (opcional) </span>
            </label>

            <textarea
              id="category-description"
              v-model="form.description"
              rows="3"
              maxlength="500"
              placeholder="Ej.: Para empezar y compartir..."
              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" />
          </div>

          <p v-if="formError" role="alert" class="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {{ formError }}
          </p>

          <div class="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              :disabled="saving"
              class="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 disabled:opacity-50"
              @click="closeModal">
              Cancelar
            </button>

            <button
              type="submit"
              :disabled="saving"
              class="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              <LoaderCircle v-if="saving" :size="18" class="animate-spin" />

              {{ saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear categoría" }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.category-action {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 10px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  transition: background-color 150ms ease;
}

.category-action:hover:not(:disabled) {
  background-color: #f1f5f9;
}

.category-action:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
@media(min-width:1280px){#editor-categories{position:sticky;top:100px}.category-management summary{font-size:12px}.category-management header{padding:16px}.category-management article .font-extrabold{font-size:13px}}
</style>

<style scoped>
.category-management .category-open { display: none; }
.category-management[open] .category-open { display: inline; }
.category-management[open] .category-closed { display: none; }
</style>
