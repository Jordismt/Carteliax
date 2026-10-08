<script setup lang="ts">
import { uiError } from "~/utils/uiErrors";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import {
  ArrowLeft,
  Save,
  Send,
  RotateCcw,
  RefreshCw,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Monitor,
  ChevronDown,
  Eye,
  Sparkles,
  Info,
  X,
} from "lucide-vue-next";

import { DEFAULT_MENU_THEME, cloneTheme } from "~/types/menuTheme";

import { emptyPublicProfile, type PublicProfile, type PublicSiteResponse } from '~/types/publicSite';
import type { MenuTheme, MenuThemeRecord, PreviewCategory, PreviewProduct } from "~/types/menuTheme";

// ==========================================
// CONFIGURACIÓN DE LA PÁGINA
// ==========================================

definePageMeta({
  middleware: "auth",
  layout: "dashboard",
});

useHead({
  title: "Personalizar carta | Carteliax",
  link: [
    {
      rel: "stylesheet",
      href:
        "https://fonts.googleapis.com/css2?" +
        "family=Inter:wght@400;500;600;700;800&" +
        "family=Poppins:wght@400;500;600;700&" +
        "family=Montserrat:wght@400;500;600;700&" +
        "family=Playfair+Display:wght@400;600;700&" +
        "family=Lora:wght@400;500;600;700&display=swap",
    },
  ],
});

// ==========================================
// TIPOS
// ==========================================

interface Menu {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  is_published: boolean;
}

interface Business {
  public_slug?: string;
  public_profile?: PublicProfile;
  description?: string;
  cover_url?: string | null;
  primary_color?: string;
  default_language?: string;
  id: string;
  name: string;
  logo_url: string | null;
}

interface ApiCategory {
  id: string;
  menu_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
}

interface ApiProduct {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
}

interface ApiAllergen {
  id: number;
  code: string;
  name_es: string;
}

interface CategoriesResponse {
  success: boolean;
  categories: ApiCategory[];
}

interface ProductsResponse {
  success: boolean;
  products: ApiProduct[];
}

interface AllergensResponse {
  success: boolean;
  allergens: ApiAllergen[];
}

interface ProductAllergensResponse {
  success: boolean;
  allergenIds: number[];
}

// ==========================================
// COMPOSABLES
// ==========================================

const route = useRoute();
const router = useRouter();

const { apiFetch } = useApi();

const { getTheme, saveDraft, publishTheme, resetTheme } = useMenuTheme();

const menuId = computed(() => String(route.params.id));

// ==========================================
// ESTADO
// ==========================================

const menu = ref<Menu | null>(null);
const business = ref<Business | null>(null);

const theme = ref<MenuTheme>(cloneTheme(DEFAULT_MENU_THEME));

const publicPreview = computed<PublicSiteResponse>(() => ({
  success: true,
  business: { name: business.value?.name ?? '', public_slug: business.value?.public_slug ?? '', description: business.value?.description ?? null, logo_url: business.value?.logo_url ?? null, cover_url: business.value?.cover_url ?? null, primary_color: business.value?.primary_color ?? '#16a34a', default_language: business.value?.default_language ?? 'es', profile: { ...emptyPublicProfile(), ...business.value?.public_profile } },
  menus: [],
  currentMenu: menu.value && business.value ? { success: true, business: { id: business.value.id, name: business.value.name, logo_url: business.value.logo_url }, menu: { id: menu.value.id, name: menu.value.name, slug: menu.value.slug, description: null }, theme: theme.value, categories: previewCategories.value } : null,
}));

const savedTheme = ref<MenuTheme>(cloneTheme(DEFAULT_MENU_THEME));

const themeRecord = ref<MenuThemeRecord | null>(null);

const loading = ref(true);
const saving = ref(false);
const publishing = ref(false);
const resetting = ref(false);

const errorMessage = ref("");
const successMessage = ref("");

const previewMode = ref<"mobile" | "desktop">("mobile");

const previewCategories = ref<PreviewCategory[]>([]);
const previewLoading = ref(false);
const previewError = ref("");

const showMoreActions = ref(false);
const showLeaveDialog = ref(false);

const pendingNavigation = ref<
  | {
      type: "route";
      to: string;
    }
  | {
      type: "browser";
    }
  | null
>(null);

// Sirve para distinguir los cambios realizados
// antes y después de guardar.

const hasChanges = computed(() => JSON.stringify(theme.value) !== JSON.stringify(savedTheme.value));

const isBusy = computed(() => saving.value || publishing.value || resetting.value);

const isDesignPublished = computed(() => Boolean(themeRecord.value?.published_at));

const previewProductCount = computed(() =>
  previewCategories.value.reduce((total, category) => total + category.products.length, 0),
);

const restaurantName = computed(() => business.value?.name || menu.value?.name || "Mi restaurante");

// ==========================================
// MENSAJES Y ERRORES
// ==========================================

function getError(error: unknown, fallback: string): string {
  return uiError(error, fallback);
}

function clearMessages() {
  errorMessage.value = "";
  successMessage.value = "";
}

function applyThemeRecord(record: MenuThemeRecord) {
  themeRecord.value = record;

  const draft =
    record.draft_config && Object.keys(record.draft_config).length ? record.draft_config : DEFAULT_MENU_THEME;

  theme.value = cloneTheme(draft);
  savedTheme.value = cloneTheme(draft);
}

// ==========================================
// CARGAR VISTA PREVIA REAL
// ==========================================

async function loadRealPreview() {
  previewLoading.value = true;
  previewError.value = "";

  const requestedMenuId = menuId.value;

  try {
    // 1. Categorías visibles.

    const categoryResponse = await apiFetch<CategoriesResponse>(`/api/menus/${requestedMenuId}/categories`);

    const visibleCategories = [...categoryResponse.categories]
      .filter((category) => category.is_visible)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (!visibleCategories.length) {
      if (requestedMenuId === menuId.value) {
        previewCategories.value = [];
      }

      return;
    }

    // 2. Productos asociados a cada categoría.

    const categoriesWithProducts = await Promise.all(
      visibleCategories.map(async (category) => {
        const response = await apiFetch<ProductsResponse>(`/api/categories/${category.id}/products`);

        return {
          category,
          products: response.products
            .filter((product) => product.is_available)
            .sort((a, b) => a.sort_order - b.sort_order),
        };
      }),
    );

    // 3. Productos únicos.

    const uniqueProductIds = [
      ...new Set(categoriesWithProducts.flatMap((item) => item.products.map((product) => product.id))),
    ];

    const allergensByProduct = new Map<string, string[]>();

    // 4. Cargar los alérgenos.

    if (uniqueProductIds.length > 0) {
      const catalogResponse = await apiFetch<AllergensResponse>("/api/allergens");

      const allergenNames = new Map<number, string>(
        catalogResponse.allergens.map((allergen) => [allergen.id, allergen.name_es]),
      );

      const allergenResults = await Promise.all(
        uniqueProductIds.map(async (productId) => {
          const response = await apiFetch<ProductAllergensResponse>(`/api/products/${productId}/allergens`);

          return {
            productId,
            allergenIds: response.allergenIds,
          };
        }),
      );

      for (const result of allergenResults) {
        const names = result.allergenIds
          .map((id) => allergenNames.get(id))
          .filter((name): name is string => typeof name === "string");

        allergensByProduct.set(result.productId, names);
      }
    }

    // 5. Adaptar los datos a MenuLivePreview.

    const result: PreviewCategory[] = categoriesWithProducts.map(
      ({ category, products }): PreviewCategory => ({
        id: category.id,
        name: category.name,

        products: products.map(
          (product): PreviewProduct => ({
            id: product.id,
            name: product.name,
            description: product.description ?? "",
            price: Number(product.price),
            image_url: product.image_url,
            allergens: allergensByProduct.get(product.id) ?? [],
          }),
        ),
      }),
    );

    // Evitar mostrar resultados de otra carta
    // si el usuario cambia de página durante la carga.

    if (requestedMenuId === menuId.value) {
      previewCategories.value = result;
    }
  } catch (error) {
    if (requestedMenuId === menuId.value) {
      previewError.value = getError(error, "No se pudo cargar la vista previa.");
    }
  } finally {
    if (requestedMenuId === menuId.value) {
      previewLoading.value = false;
    }
  }
}

// ==========================================
// CARGAR EDITOR
// ==========================================

async function loadEditor() {
  loading.value = true;

  clearMessages();

  menu.value = null;
  business.value = null;

  previewCategories.value = [];
  previewError.value = "";

  const requestedMenuId = menuId.value;

  try {
    const [menuResponse, themeResponse] = await Promise.all([
      apiFetch<{ menu: Menu }>(`/api/menus/${requestedMenuId}`),

      getTheme(requestedMenuId),
    ]);

    if (requestedMenuId !== menuId.value) {
      return;
    }

    menu.value = menuResponse.menu;

    applyThemeRecord(themeResponse.theme);

    // Los datos del negocio son opcionales.

    const businessPromise = apiFetch<{ business: Business }>(
      `/api/businesses/${menuResponse.menu.business_id}`,
    )
      .then((response) => {
        if (requestedMenuId === menuId.value) {
          business.value = response.business;
        }
      })
      .catch(() => {
        if (requestedMenuId === menuId.value) {
          business.value = null;
        }
      });

    await Promise.all([businessPromise, loadRealPreview()]);
  } catch (error) {
    if (requestedMenuId === menuId.value) {
      errorMessage.value = getError(error, "No se pudo cargar el editor.");
    }
  } finally {
    if (requestedMenuId === menuId.value) {
      loading.value = false;
    }
  }
}

// ==========================================
// GUARDAR BORRADOR
// ==========================================

async function saveChanges(): Promise<boolean> {
  if (isBusy.value) return false;

  if (!hasChanges.value) {
    successMessage.value = "Todos los cambios ya están guardados.";

    return true;
  }

  saving.value = true;
  clearMessages();

  try {
    // Capturamos exactamente lo que vamos
    // a enviar al servidor.

    const snapshot = cloneTheme(theme.value);

    const response = await saveDraft(menuId.value, snapshot);

    themeRecord.value = response.theme;

    savedTheme.value = cloneTheme(response.theme.draft_config);

    // No sobrescribimos theme.value.
    // Así se conservan los cambios que el usuario
    // haya hecho durante la petición.

    successMessage.value = hasChanges.value
      ? "Borrador guardado. Tienes cambios nuevos pendientes."
      : "Borrador guardado correctamente.";

    return true;
  } catch (error) {
    errorMessage.value = getError(error, "No se pudieron guardar los cambios.");

    return false;
  } finally {
    saving.value = false;
  }
}

// ==========================================
// GUARDAR Y PUBLICAR
// ==========================================

async function publishChanges() {
  if (isBusy.value) return;

  publishing.value = true;
  clearMessages();

  try {
    const snapshot = cloneTheme(theme.value);

    // Guardar automáticamente los cambios.

    if (hasChanges.value) {
      const saved = await saveDraft(menuId.value, snapshot);

      themeRecord.value = saved.theme;

      savedTheme.value = cloneTheme(saved.theme.draft_config);
    }

    // Publicar el borrador guardado.

    const response = await publishTheme(menuId.value);

    themeRecord.value = response.theme;

    // Puede haber cambios nuevos realizados
    // mientras se procesaba la publicación.

    successMessage.value = hasChanges.value
      ? "Diseño publicado. Tienes nuevos cambios sin guardar."
      : "¡Tu diseño se ha publicado correctamente!";
  } catch (error) {
    errorMessage.value = getError(error, "No se pudo publicar el diseño.");
  } finally {
    publishing.value = false;
  }
}

// ==========================================
// RESTABLECER
// ==========================================

async function resetChanges() {
  if (isBusy.value) return;

  showMoreActions.value = false;

  const confirmed = window.confirm(
    "¿Quieres restablecer el diseño? " +
      "Se perderán los cambios del borrador. " +
      "El diseño publicado no se modificará.",
  );

  if (!confirmed) return;

  resetting.value = true;
  clearMessages();

  try {
    const response = await resetTheme(menuId.value);

    applyThemeRecord(response.theme);

    successMessage.value = "Diseño restablecido correctamente.";
  } catch (error) {
    errorMessage.value = getError(error, "No se pudo restablecer el diseño.");
  } finally {
    resetting.value = false;
  }
}

// ==========================================
// NAVEGACIÓN SEGURA
// ==========================================

// Se usa tanto para volver a la carta como
// para cualquier otra navegación de Nuxt.

function requestBack() {
  if (isBusy.value) return;

  const destination = `/menus/${menuId.value}`;

  if (hasChanges.value) {
    pendingNavigation.value = {
      type: "route",
      to: destination,
    };

    showLeaveDialog.value = true;
    return;
  }

  router.push(destination);
}

function cancelLeave() {
  showLeaveDialog.value = false;
  pendingNavigation.value = null;
}

async function confirmLeave() {
  const navigation = pendingNavigation.value;

  showLeaveDialog.value = false;
  pendingNavigation.value = null;

  if (!navigation) return;

  if (navigation.type === "route") {
    // Permitir una navegación confirmada.
    allowNextNavigation.value = true;

    try {
      await router.push(navigation.to);
    } finally {
      allowNextNavigation.value = false;
    }
  }
}

const allowNextNavigation = ref(false);

onBeforeRouteLeave((to) => {
  if (allowNextNavigation.value) {
    return true;
  }

  if (isBusy.value) {
    return false;
  }

  if (!hasChanges.value) {
    return true;
  }

  pendingNavigation.value = {
    type: "route",
    to: to.fullPath,
  };

  showLeaveDialog.value = true;

  return false;
});

// El navegador utiliza su propio aviso nativo.
// Los navegadores modernos no permiten
// personalizar el texto de este mensaje.

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasChanges.value) return;

  event.preventDefault();
  event.returnValue = "";
}

// ==========================================
// CAMBIOS DE CARTA
// ==========================================

watch(menuId, () => {
  showMoreActions.value = false;
  showLeaveDialog.value = false;

  loadEditor();
});

// Al modificar el diseño, eliminamos el
// mensaje de éxito anterior.

watch(
  theme,
  () => {
    if (!isBusy.value) {
      successMessage.value = "";
    }
  },
  // Limpiar el aviso durante la edición; al restablecer, isBusy sigue activo.
  // Así el watcher no borra el mensaje de éxito después de terminar la petición.
  { flush: "sync" },
);

// ==========================================
// CICLO DE VIDA
// ==========================================

onMounted(() => {
  loadEditor();

  window.addEventListener("beforeunload", handleBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>

<template>
  <div class="design-page mx-auto max-w-[1600px] pb-12">
    <!-- ======================================
         ESTADO DE CARGA
    ======================================= -->

    <div v-if="loading" class="flex min-h-[65vh] flex-col items-center justify-center gap-4">
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
        <LoaderCircle :size="30" class="animate-spin text-emerald-600" />
      </div>

      <p class="text-sm font-medium text-slate-500">Preparando tu editor...</p>
    </div>

    <template v-else-if="menu">
      <!-- ======================================
           CABECERA
      ======================================= -->

      <header class="design-header mb-6 p-0">
        <!-- NAVEGACIÓN -->

        <button
          type="button"
          class="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-emerald-700"
          @click="requestBack">
          <ArrowLeft :size="17" />
          Volver a mi carta
        </button>

        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <!-- TÍTULO -->

          <div class="min-w-0">
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <span
                class="hidden">
                <Sparkles :size="13" />
                PERSONALIZACIÓN
              </span>

              <span
                v-if="hasChanges"
                class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                <span class="h-1.5 w-1.5 rounded-full bg-amber-500" />

                Cambios sin guardar
              </span>

              <span
                v-else
                class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                <CheckCircle2 :size="13" />
                Todo guardado
              </span>
            </div>

            <p class="ui-eyebrow">A TU MANERA</p><h1 class="ui-title">Diseño de la carta</h1>

            <p class="mt-2 text-sm leading-relaxed text-slate-500">
              {{ menu.name }}
              <span class="mx-1">·</span>
              Personalízala a tu gusto, sin complicaciones.
            </p>
          </div>

          <!-- ACCIONES -->

          <div class="design-actions flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <!-- GUARDAR SIN PUBLICAR -->

            <button
              type="button"
              :disabled="isBusy || !hasChanges"
              class="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              @click="saveChanges">
              <LoaderCircle v-if="saving" :size="17" class="animate-spin" />

              <Save v-else :size="17" />

              {{ saving ? "Guardando..." : "Guardar borrador" }}
            </button>

            <!-- ACCIÓN PRINCIPAL -->

            <button
              type="button"
              :disabled="isBusy"
              class="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              @click="publishChanges">
              <LoaderCircle v-if="publishing" :size="18" class="animate-spin" />

              <Send v-else :size="18" />

              {{ publishing ? "Publicando..." : "Guardar y publicar" }}
            </button>

            <!-- OPCIONES SECUNDARIAS -->

            <div class="relative">
              <button
                type="button"
                :disabled="isBusy"
                class="flex min-h-12 w-full items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                :aria-expanded="showMoreActions"
                aria-label="Más acciones"
                @click="showMoreActions = !showMoreActions">
                <ChevronDown :size="19" />
              </button>

              <div
                v-if="showMoreActions"
                class="design-more absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  @click="resetChanges">
                  <RotateCcw :size="16" />
                  Restablecer diseño
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ESTADO PUBLICACIÓN -->

        <div
          v-if="isDesignPublished"
          class="mt-5 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <CheckCircle2 :size="16" class="shrink-0 text-emerald-600" />

          <p>
            Tienes un diseño publicado. Los cambios nuevos no serán visibles para tus clientes hasta que
            vuelvas a publicarlos.
          </p>
        </div>
      </header>

      <UiMenuNavigation :menu-id="menuId" class="mb-5" />
      <!-- ======================================
           MENSAJES
      ======================================= -->

      <div
        v-if="successMessage"
        role="status"
        class="mb-5 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
        <CheckCircle2 :size="19" class="shrink-0" />

        <p class="flex-1">
          {{ successMessage }}
        </p>

        <button type="button" aria-label="Cerrar mensaje" @click="successMessage = ''">
          <X :size="17" />
        </button>
      </div>

      <div
        v-if="errorMessage"
        role="alert"
        class="mb-5 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
        <AlertCircle :size="19" class="shrink-0" />

        <p class="flex-1">
          {{ errorMessage }}
        </p>

        <button type="button" aria-label="Cerrar error" @click="errorMessage = ''">
          <X :size="17" />
        </button>
      </div>

      <!-- ======================================
           EDITOR + VISTA PREVIA
      ======================================= -->

      <nav aria-label="Opciones y vista previa del diseño" class="mb-4 flex flex-wrap gap-2 xl:hidden">
        <a href="#design-options" class="ui-secondary">Cambiar diseño</a>
        <a href="#design-preview" class="ui-secondary"><Eye :size="17" /> Ver vista previa</a>
      </nav>
      <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <!-- ==================================
             PANEL IZQUIERDO
        =================================== -->

        <div id="design-options" class="min-w-0 space-y-4">
          <div v-if="business?.public_slug" class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><p>La plantilla del establecimiento define toda la web y sus cartas. Aquí se conservan las opciones de contenido y el diseño histórico.</p><NuxtLink :to="`/businesses/${business.id}`" class="mt-2 inline-block font-semibold underline">Cambiar plantilla de la web</NuxtLink></div>
          <MenuEditorMenuThemeEditor v-model="theme" :unified-site="!!business?.public_slug" />

        </div>

        <!-- ==================================
             PANEL DERECHO
        =================================== -->

        <section
          id="design-preview"
          class="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-24">
          <!-- CABECERA PREVIEW -->

          <div
            class="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <div class="flex items-center gap-2">
                <Eye :size="19" class="text-emerald-600" />

                <h2 class="text-lg font-extrabold text-slate-950">Así verán tu carta</h2>
              </div>

              <p class="mt-1.5 text-xs text-slate-500">Los cambios aparecen aquí al instante.</p>
            </div>

            <!-- CONTROLES -->

            <div class="flex items-center gap-2">
              <button
                type="button"
                :disabled="previewLoading"
                title="Actualizar productos"
                aria-label="Actualizar productos"
                class="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                @click="loadRealPreview">
                <RefreshCw
                  :size="17"
                  :class="{
                    'animate-spin': previewLoading,
                  }" />
              </button>

              <!-- SELECTOR DISPOSITIVO -->

              <div class="flex items-center rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  title="Ver en móvil"
                  aria-label="Ver en móvil"
                  :aria-pressed="previewMode === 'mobile'"
                  class="flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition"
                  :class="
                    previewMode === 'mobile'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  "
                  @click="previewMode = 'mobile'">
                  <Smartphone :size="16" />
                  Móvil
                </button>

                <button
                  type="button"
                  title="Ver en ordenador"
                  aria-label="Ver en ordenador"
                  :aria-pressed="previewMode === 'desktop'"
                  class="flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition"
                  :class="
                    previewMode === 'desktop'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  "
                  @click="previewMode = 'desktop'">
                  <Monitor :size="16" />
                  <span class="hidden sm:inline"> Ordenador </span>
                </button>
              </div>
            </div>
          </div>

          <!-- DATOS PREVIEW -->

          <div
            v-if="!previewLoading && !previewError"
            class="flex flex-wrap items-center gap-2 px-4 pt-4 sm:px-5">
            <span class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {{ previewCategories.length }}
              categorías
            </span>

            <span class="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              {{ previewProductCount }}
              productos
            </span>

            <span class="ml-auto flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />

              Vista en directo
            </span>
          </div>

          <!-- SIMULADOR -->

          <div class="flex justify-center overflow-x-auto p-3 sm:p-5">
            <div
              class="flex w-full min-w-0 justify-center rounded-2xl bg-slate-100 px-2 py-6 sm:px-5 sm:py-8">
              <!-- MARCO -->

              <div
                class="w-full min-w-0 overflow-hidden bg-white shadow-2xl transition-all duration-300"
                :class="
                  previewMode === 'mobile'
                    ? 'max-w-[390px] rounded-xl border border-slate-200'
                    : 'max-w-[850px] rounded-xl border border-slate-200'
                ">
                <!-- CONTENIDO -->

                <div
                  class="overflow-y-auto overscroll-contain"
                  :class="previewMode === 'mobile' ? 'h-[600px] sm:h-[650px]' : 'h-[650px]'">
                  <!-- CARGANDO -->

                  <div
                    v-if="previewLoading"
                    class="flex h-full min-h-80 flex-col items-center justify-center gap-4 bg-white p-6">
                    <LoaderCircle :size="30" class="animate-spin text-emerald-600" />

                    <p class="text-center text-sm font-medium text-slate-500">Preparando tu carta...</p>
                  </div>

                  <!-- ERROR -->

                  <div
                    v-else-if="previewError"
                    class="flex h-full min-h-80 flex-col items-center justify-center p-6 text-center">
                    <AlertCircle :size="32" class="text-red-500" />

                    <h3 class="mt-4 text-sm font-bold text-slate-900">No se pudo mostrar la carta</h3>

                    <p class="mt-2 text-xs leading-relaxed text-slate-500">
                      {{ previewError }}
                    </p>

                    <button
                      type="button"
                      class="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                      @click="loadRealPreview">
                      Volver a intentar
                    </button>
                  </div>

                  <!-- CARTA REAL -->

                  <PublicRestaurantSite v-else-if="business?.public_slug" :site="publicPreview" :language="business.default_language === 'ca' ? 'val' : business.default_language || 'es'" preview />
                  <MenuEditorMenuLivePreview
                    v-else
                    :theme="theme"
                    :restaurant-name="restaurantName"
                    :logo-url="business?.logo_url ?? null"
                    :categories="previewCategories" />
                </div>


              </div>
            </div>
          </div>

          <!-- PIE -->

          <div class="border-t border-slate-100 px-5 py-4">
            <p class="text-center text-xs leading-relaxed text-slate-500">
              Esta vista utiliza los productos reales de tu restaurante.
            </p>

            <p class="mt-1 text-center text-xs text-slate-400">
              Si modificas productos en otra pestaña, pulsa el botón de actualizar.
            </p>
          </div>
        </section>
      </div>

      <!-- ======================================
           ACCIÓN INFERIOR
      ======================================= -->

      <div
        class="mt-8 hidden flex-col items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 sm:flex sm:flex-row">
        <div class="flex items-center gap-3">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600">
            <CheckCircle2 :size="22" />
          </div>

          <div>
            <h3 class="text-sm font-extrabold text-slate-900">¿Te gusta el resultado?</h3>

            <p class="mt-1 text-xs text-slate-600">Publica tu diseño cuando estés preparado.</p>
          </div>
        </div>

        <button
          type="button"
          :disabled="isBusy"
          class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
          @click="publishChanges">
          <LoaderCircle v-if="publishing" :size="17" class="animate-spin" />

          <Send v-else :size="17" />

          {{ publishing ? "Publicando..." : "Guardar y publicar" }}
        </button>
      </div>
    </template>

    <!-- ======================================
         ERROR DE CARGA
    ======================================= -->

    <div
      v-else
      class="flex min-h-96 flex-col items-center justify-center rounded-2xl border border-red-100 bg-white p-8 text-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
        <AlertCircle :size="27" class="text-red-500" />
      </div>

      <h2 class="mt-5 text-lg font-extrabold text-slate-900">No hemos podido abrir el editor</h2>

      <p class="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {{ errorMessage || "Ha ocurrido un problema al cargar tu carta." }}
      </p>

      <button
        type="button"
        class="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
        @click="loadEditor">
        <RefreshCw :size="17" />
        Reintentar
      </button>
    </div>

    <!-- ======================================
         MODAL CAMBIOS SIN GUARDAR
    ======================================= -->

    <div
      v-if="showLeaveDialog"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
      <div
        v-dialog-accessibility="cancelLeave"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-dialog-title"
        class="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <AlertCircle :size="25" />
        </div>

        <h2 id="leave-dialog-title" class="mt-5 text-xl font-extrabold text-slate-900">
          Tienes cambios sin guardar
        </h2>

        <p class="mt-2 text-sm leading-relaxed text-slate-500">
          Si sales ahora, perderás los últimos cambios que has realizado en el diseño.
        </p>

        <div class="mt-6 flex flex-col gap-2">
          <button
            type="button"
            class="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            @click="cancelLeave">
            Seguir editando
          </button>

          <button
            type="button"
            class="w-full rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            @click="confirmLeave">
            Salir sin guardar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 639px) {
  .design-page { padding-bottom: 100px; }
  .design-actions { position: fixed; inset-inline: 0; bottom: calc(70px + env(safe-area-inset-bottom)); z-index: 25; display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr) 44px; gap: 8px; padding: 10px 12px; background: white; border-top: 1px solid #e2e8f0; }
  .design-actions > button { min-width: 0; padding: 10px 8px; font-size: 12px; }
  .design-actions > button svg { display: none; }
  .design-more { bottom: calc(100% + 8px); margin-top: 0; }
}
.design-header{padding:0!important;border:0;box-shadow:none;background:transparent}.design-header>div:last-child{font-size:12px}.design-actions button{border-radius:var(--ui-radius-sm);font-weight:600;box-shadow:none}.design-header>button{margin-bottom:18px}.design-page #design-preview{border-color:var(--ui-border)}
</style>
