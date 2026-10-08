<script setup lang="ts">
import { uiError } from "~/utils/uiErrors";
import { emptyPublicProfile } from "~/types/publicSite";
import type { PublicProfile, PublicSiteResponse } from "~/types/publicSite";
import { publicSitePath } from "~/utils/publicUrls";
import {
  ArrowLeft,
  Store,
  Save,
  CheckCircle2,
  AlertCircle,
  Upload,
  Trash2,
  ImagePlus,
  LoaderCircle,
  CreditCard,
} from "lucide-vue-next";
import type { BusinessSubscription } from "~/composables/useSubscription";

definePageMeta({
  middleware: "auth",
  layout: "dashboard",
});

useHead({
  title: "Configurar establecimiento | Carteliax",
});

// ==========================================
// TIPOS
// ==========================================

interface Business {
  public_slug?: string;
  public_profile?: PublicProfile;
  cover_url?: string | null;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  primary_color: string;
  default_language: string;
}

// ==========================================
// CONFIGURACIÓN
// ==========================================

const LOGO_BUCKET = "business-logos";
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const route = useRoute();
const { apiFetch } = useApi();
const { $supabase } = useNuxtApp();

// ==========================================
// ESTADO
// ==========================================

const business = ref<Business | null>(null);
const settingsSection = ref('general');
async function submitSettings(event: Event) {
  if (saving.value || uploadingLogo.value || deletingLogo.value || coverBusy.value) return;
  const element = event.target as HTMLFormElement;
  const firstInvalid = element.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:invalid, select:invalid, textarea:invalid');
  if (firstInvalid) { revealField(firstInvalid); await nextTick(); firstInvalid.reportValidity(); return; }
  await saveBusiness();
}
const settingsSections = computed(() => [{id:'general',label:'Información'}, ...(business.value?.public_slug ? [{id:'web',label:'Web y contacto'}] : []), {id:'images',label:'Imágenes'}]);
function revealInvalid(event: Event) { revealField(event.target as HTMLElement); }
function revealField(field: HTMLElement) {
  const section = field.closest<HTMLElement>('[data-settings-section]');
  if (section) settingsSection.value = section.dataset.settingsSection ?? 'general';
  for (let parent = field.parentElement; parent; parent = parent.parentElement) { if (parent instanceof HTMLDetailsElement) parent.open = true; }
  nextTick(() => field.focus());
}

const loading = ref(true);
const saving = ref(false);
const uploadingLogo = ref(false);
const deletingLogo = ref(false);

const successMessage = ref("");
const errorMessage = ref("");

const logoInput = ref<HTMLInputElement | null>(null);

const businessId = computed(() => String(route.params.id));

const { getSubscription } = useSubscription();
const subscription = ref<BusinessSubscription | null>();
const subscriptionLoading = ref(true);

const billingUrl = computed(() => `/billing/${encodeURIComponent(businessId.value)}`);

const form = reactive({
  name: "",
  description: "",
  primary_color: "#16a34a",
  default_language: "es",
  public_profile: emptyPublicProfile(),
});

const origin = ref("");
const copied = ref(false);
const coverBusy = ref(false);
const previewOpen = ref(false);
const previewMenu = ref<PublicSiteResponse['currentMenu']>(null);
const previewMenus = ref<PublicSiteResponse['menus']>([]);
const publicUrl = computed(() => business.value?.public_slug ? origin.value + publicSitePath(business.value.public_slug) : "");
const previewSite = computed<PublicSiteResponse>(() => ({ success: true, business: { name: form.name, public_slug: business.value?.public_slug ?? '', description: form.description, logo_url: business.value?.logo_url ?? null, cover_url: business.value?.cover_url ?? null, primary_color: form.primary_color, default_language: form.default_language, profile: form.public_profile }, menus: previewMenus.value, currentMenu: previewMenu.value }));
async function copyUrl() { try { await navigator.clipboard.writeText(publicUrl.value); copied.value = true; } catch { errorMessage.value = "No se pudo copiar. Selecciona la dirección y cópiala."; } }
async function openPreview() {
  previewOpen.value = !previewOpen.value;
  if (!previewOpen.value || !business.value?.public_slug) return;
  try { const site = await $fetch<PublicSiteResponse>(`/api/public/sites/${encodeURIComponent(business.value.public_slug)}`); previewMenu.value = site.currentMenu; previewMenus.value = site.menus; }
  catch { previewMenu.value = null; previewMenus.value = []; }
}
async function updateCover(event?: Event) {
  if (!business.value || coverBusy.value) return;
  const file = event ? (event.target as HTMLInputElement).files?.[0] : undefined;
  if (event && !file) return;
  if (file && file.size > 5 * 1024 * 1024) { errorMessage.value = "La portada no puede superar los 5 MB."; return; }
  coverBusy.value = true; clearMessages();
  try {
    const body = new FormData(); if (file) body.append("image", file);
    const response = await apiFetch<{ business: Business }>(`/api/businesses/${business.value.id}/cover`, file ? { method: "POST", body } : { method: "DELETE" });
    business.value = response.business; successMessage.value = "Portada actualizada.";
  } catch(error) { errorMessage.value = getErrorMessage(error, "No se pudo actualizar la portada."); }
  finally { coverBusy.value = false; if (event) (event.target as HTMLInputElement).value = ''; }
}
onMounted(() => { origin.value = window.location.origin; });

// ==========================================
// MENSAJES
// ==========================================

function clearMessages() {
  successMessage.value = "";
  errorMessage.value = "";
}

function getErrorMessage(error: unknown, fallback: string): string {
  return uiError(error, fallback);
}

// ==========================================
// CARGAR ESTABLECIMIENTO
// ==========================================

async function loadBusiness() {
  loading.value = true;
  clearMessages();

  try {
    const response = await apiFetch<{
      success: boolean;
      business: Business;
    }>(`/api/businesses/${businessId.value}`);

    business.value = response.business;
    subscriptionLoading.value = true;
    const requestedId = businessId.value;
    void getSubscription(requestedId)
      .then((value) => { if (businessId.value === requestedId) subscription.value = value; })
      .catch(() => { if (businessId.value === requestedId) subscription.value = undefined; })
      .finally(() => { if (businessId.value === requestedId) subscriptionLoading.value = false; });

    form.name = response.business.name;

    form.description = response.business.description ?? "";

    form.primary_color = response.business.primary_color ?? "#16a34a";

    form.default_language = response.business.default_language;
    form.public_profile = { ...emptyPublicProfile(), ...response.business.public_profile };
  } catch (error) {
    console.error("Error cargando establecimiento:", error);

    business.value = null;

    errorMessage.value = getErrorMessage(error, "No se pudo cargar el establecimiento.");
  } finally {
    loading.value = false;
  }
}

// ==========================================
// GUARDAR CONFIGURACIÓN
// ==========================================

async function saveBusiness() {
  if (!business.value || saving.value) {
    return;
  }

  saving.value = true;
  clearMessages();

  try {
    const response = await apiFetch<{
      success: boolean;
      business: Business;
    }>(`/api/businesses/${businessId.value}`, {
      method: "PATCH",
      body: {
        name: form.name.trim(),
        description: form.description.trim(),
        primary_color: form.primary_color,
        default_language: form.default_language,
        ...(business.value.public_slug ? { public_profile: form.public_profile } : {}),
      },
    });

    business.value = response.business;

    successMessage.value = "Los cambios se han guardado correctamente.";
  } catch (error) {
    console.error("Error guardando establecimiento:", error);

    errorMessage.value = getErrorMessage(error, "No se pudieron guardar los cambios.");
  } finally {
    saving.value = false;
  }
}

// ==========================================
// SELECCIONAR LOGOTIPO
// ==========================================

function openLogoSelector() {
  if (uploadingLogo.value || deletingLogo.value) {
    return;
  }

  logoInput.value?.click();
}

// ==========================================
// SUBIR / SUSTITUIR LOGOTIPO
// ==========================================

async function uploadLogo(event: Event) {
  const input = event.target as HTMLInputElement;

  const file = input.files?.[0];

  if (!file || !business.value || uploadingLogo.value) {
    return;
  }

  clearMessages();

  const extension = ALLOWED_IMAGE_TYPES[file.type];

  if (!extension) {
    errorMessage.value = "Solo se permiten imágenes PNG, JPG y WebP.";

    input.value = "";
    return;
  }

  if (file.size > MAX_LOGO_SIZE) {
    errorMessage.value = "El logotipo no puede superar los 2 MB.";

    input.value = "";
    return;
  }

  if (file.size === 0) {
    errorMessage.value = "El archivo seleccionado está vacío.";

    input.value = "";
    return;
  }

  uploadingLogo.value = true;

  const currentBusinessId = business.value.id;

  // Cada imagen tiene un nombre único.
  // Evitamos problemas de caché y sobrescritura.

  const filename = `${crypto.randomUUID()}.${extension}`;

  const path = `${currentBusinessId}/${filename}`;

  let uploaded = false;
  let savedInDatabase = false;

  try {
    // ======================================
    // 1. SUBIR A SUPABASE STORAGE
    // ======================================

    const { error: uploadError } = await $supabase.storage.from(LOGO_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });

    if (uploadError) {
      throw uploadError;
    }

    uploaded = true;

    // ======================================
    // 2. GUARDAR URL EN LA BASE DE DATOS
    // ======================================

    const response = await apiFetch<{
      success: boolean;
      business: Business;
    }>(`/api/businesses/${currentBusinessId}/logo`, {
      method: "PATCH",
      body: {
        path,
      },
    });

    savedInDatabase = true;

    // ======================================
    // 3. ACTUALIZAR INTERFAZ
    // ======================================

    business.value = response.business;

    successMessage.value = "Logotipo actualizado correctamente.";
  } catch (error) {
    console.error("Error subiendo logotipo:", error);

    /*
      Si la imagen se subió pero el backend
      rechazó la actualización, intentamos
      eliminar el archivo nuevo.

      En errores de red puede que el backend
      haya guardado los cambios igualmente.

      En ese caso, recargamos el negocio antes
      de decidir si eliminamos la imagen.
    */

    if (uploaded && !savedInDatabase) {
      let shouldCleanup = false;

      try {
        const check = await apiFetch<{
          success: boolean;
          business: Business;
        }>(`/api/businesses/${currentBusinessId}`);

        business.value = check.business;

        const publicUrl = $supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;

        shouldCleanup = check.business.logo_url !== publicUrl;
      } catch (checkError) {
        console.error("No se pudo verificar el estado del logotipo:", checkError);
      }

      if (shouldCleanup) {
        const { error: cleanupError } = await $supabase.storage.from(LOGO_BUCKET).remove([path]);

        if (cleanupError) {
          console.error("No se pudo limpiar el archivo:", cleanupError);
        }
      }
    }

    errorMessage.value = getErrorMessage(error, "No se pudo actualizar el logotipo.");
  } finally {
    uploadingLogo.value = false;
    input.value = "";
  }
}

// ==========================================
// ELIMINAR LOGOTIPO
// ==========================================

async function deleteLogo() {
  if (!business.value?.logo_url || deletingLogo.value || uploadingLogo.value) {
    return;
  }

  deletingLogo.value = true;
  clearMessages();

  try {
    const response = await apiFetch<{
      success: boolean;
      business: Business;
    }>(`/api/businesses/${business.value.id}/logo`, {
      method: "DELETE",
    });

    business.value = response.business;

    successMessage.value = "Logotipo eliminado correctamente.";
  } catch (error) {
    console.error("Error eliminando logotipo:", error);

    errorMessage.value = getErrorMessage(error, "No se pudo eliminar el logotipo.");
  } finally {
    deletingLogo.value = false;
  }
}

// ==========================================
// CICLO DE VIDA
// ==========================================

watch(businessId, () => {
  loadBusiness();
});

onMounted(loadBusiness);
</script>

<template>
  <div class="ui-page settings-page mx-auto max-w-5xl">
    <NuxtLink to="/businesses" class="ui-quiet w-fit"><ArrowLeft :size="17" /> Volver a establecimientos</NuxtLink>
    <UiSkeleton v-if="loading" label="Cargando configuración…" />
    <UiNotice v-else-if="!business" tone="danger">{{ errorMessage }}<button type="button" class="ui-quiet underline" @click="loadBusiness">Reintentar</button></UiNotice>
    <template v-else>
      <UiPageHeader :title="business.name" description="Los datos y la identidad de tu restaurante." eyebrow="CONFIGURACIÓN"><NuxtLink :to="billingUrl" class="ui-secondary"><CreditCard :size="17" /> Gestionar facturación</NuxtLink></UiPageHeader>
      <div class="settings-status"><span>Suscripción del establecimiento</span><SubscriptionBadge :subscription="subscription" :loading="subscriptionLoading" /></div>
      <nav class="settings-navigation" aria-label="Secciones del establecimiento"><button v-for="section in settingsSections" :key="section.id" type="button" :aria-pressed="settingsSection === section.id" :aria-controls="`settings-${section.id}`" @click="settingsSection = section.id">{{ section.label }}</button></nav>
      <div id="settings-web" v-show="settingsSection === 'web'" class="space-y-5">
      <section v-if="business.public_slug" class="ui-panel space-y-4">
        <h2 class="text-xl font-bold">Mini web y carta QR</h2><label for="business-public-url" class="block text-sm font-semibold">Dirección de tu web</label><input id="business-public-url" :value="publicUrl" readonly class="w-full rounded-lg border border-slate-200 p-3 text-sm" /><p class="text-sm text-slate-500">Esta dirección permanece igual aunque cambies el nombre del restaurante. Tus QR seguirán funcionando.</p><div class="flex flex-wrap gap-3"><a :href="publicUrl" target="_blank" rel="noopener noreferrer" class="ui-secondary">Ver mi web</a><button type="button" class="ui-secondary" @click="copyUrl">{{ copied ? 'Copiada' : 'Copiar dirección' }}</button><button type="button" class="ui-quiet" :aria-expanded="previewOpen" @click="openPreview">{{ previewOpen ? 'Cerrar vista previa' : 'Vista previa de la mini web' }}</button></div>
        <div v-if="previewOpen" class="overflow-hidden rounded-lg border border-slate-200"><PublicRestaurantSite :site="previewSite" :language="form.default_language === 'ca' ? 'val' : form.default_language" preview /></div>
        <NuxtLink :to="`/businesses/qr/${business.id}`" class="ui-primary">Ver y descargar tu QR</NuxtLink><p class="text-sm text-slate-600">Un único QR abre tu web y todas tus cartas. Imprímelo una vez y actualiza la carta desde el panel.</p>
      </section>
      </div>
      <div id="settings-images" v-show="settingsSection === 'images'" class="space-y-5">
      <section class="ui-panel">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-center">
          <!-- IMAGEN -->

          <div
            class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <img
              v-if="business.logo_url"
              :src="business.logo_url"
              :alt="`Logotipo de ${business.name}`"
              class="h-full w-full object-contain p-3" />

            <ImagePlus v-else :size="42" class="text-slate-300" />
          </div>

          <!-- INFORMACIÓN Y ACCIONES -->

          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-bold text-slate-950">Logotipo del establecimiento</h2>

            <p class="mt-2 text-sm leading-relaxed text-slate-500">
              Personaliza la identidad visual de tu negocio. Utiliza una imagen PNG, JPG o WebP de hasta 2 MB.
            </p>

            <input
              ref="logoInput"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              class="hidden"
              aria-label="Seleccionar logotipo"
              @change="uploadLogo" />

            <div class="mt-5 flex flex-wrap items-center gap-3">
              <!-- SUBIR -->

              <button
                type="button"
                :disabled="uploadingLogo || deletingLogo"
                class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                @click="openLogoSelector">
                <LoaderCircle v-if="uploadingLogo" :size="17" class="animate-spin" />

                <Upload v-else :size="17" />

                {{
                  uploadingLogo ? "Subiendo..." : business.logo_url ? "Cambiar logotipo" : "Subir logotipo"
                }}
              </button>

              <!-- ELIMINAR -->

              <button
                v-if="business.logo_url"
                type="button"
                :disabled="uploadingLogo || deletingLogo"
                class="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                @click="deleteLogo">
                <LoaderCircle v-if="deletingLogo" :size="17" class="animate-spin" />

                <Trash2 v-else :size="17" />

                {{ deletingLogo ? "Eliminando..." : "Eliminar" }}
              </button>
            </div>
          </div>
        </div>
      </section>
      <section v-if="business.public_slug" class="ui-panel space-y-4"><h2 class="text-xl font-bold">Fotografía de portada</h2><p class="text-sm text-slate-500">JPEG, PNG o WebP de hasta 5 MB. La optimizamos para móviles.</p><img v-if="business.cover_url" :src="business.cover_url" :alt="business.name" class="max-h-56 w-full rounded-lg object-cover" /><label class="block"><span class="mb-2 block text-sm font-semibold">{{ coverBusy ? 'Actualizando…' : 'Elegir portada' }}</span><input type="file" accept="image/jpeg,image/png,image/webp" :disabled="coverBusy || saving" class="max-w-full text-sm" @change="updateCover" /></label><button v-if="business.cover_url" type="button" :disabled="coverBusy || saving" class="ui-quiet text-red-700" @click="updateCover()">Quitar portada</button></section>
      </div>
      <form id="business-settings-form" novalidate :aria-busy="saving" class="settings-form" @submit.prevent="submitSettings" @invalid.capture="revealInvalid">
        <section id="settings-general" data-settings-section="general" v-show="settingsSection === 'general'" class="ui-panel space-y-5">
        <!-- INFORMACIÓN -->

        <div>
          <h2 class="text-xl font-bold text-slate-950">Información del negocio</h2>

          <p class="mt-2 text-sm text-slate-500">Estos datos identificarán tu establecimiento.</p>
        </div>

        <!-- NOMBRE -->

        <div>
          <label for="edit-name" class="mb-2 block text-sm font-semibold text-slate-700">
            Nombre del establecimiento
          </label>

          <input
            id="edit-name"
            v-model="form.name"
            required
            minlength="2"
            maxlength="100"
            class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500" />
        </div>

        <!-- DESCRIPCIÓN -->

        <div>
          <label for="edit-description" class="mb-2 block text-sm font-semibold text-slate-700">
            Descripción
          </label>

          <textarea
            id="edit-description"
            v-model="form.description"
            maxlength="500"
            rows="4"
            class="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500" />
        </div>

        <!-- IDIOMA -->

        <div>
          <label for="edit-language" class="mb-2 block text-sm font-semibold text-slate-700">
            Idioma principal
          </label>

          <select
            id="edit-language"
            v-model="form.default_language"
            class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-500">
            <option value="es">Español</option>

            <option value="ca">Valencià / Català</option>

            <option value="en">English</option>
          </select>
        </div>

        <!-- APARIENCIA -->

        <div class="border-t border-slate-100 pt-7">
          <h2 class="text-xl font-bold text-slate-950">Apariencia</h2>

          <p class="mt-2 text-sm text-slate-500">Personaliza el color principal de tu establecimiento.</p>
        </div>

        <!-- COLOR -->

        <div>
          <label for="edit-color" class="mb-3 block text-sm font-semibold text-slate-700">
            Color principal
          </label>

          <div class="flex items-center gap-4">
            <input
              id="edit-color"
              v-model="form.primary_color"
              type="color"
              class="h-14 w-20 cursor-pointer rounded-lg" />

            <div>
              <p class="font-mono text-sm font-semibold text-slate-800">
                {{ form.primary_color }}
              </p>

              <p class="mt-1 text-xs text-slate-500">Vista previa en tiempo real</p>
            </div>
          </div>
        </div>


        </section>
        <section data-settings-section="web" v-show="settingsSection === 'web'" class="ui-panel">
          <BusinessesPublicProfileEditor v-if="business.public_slug" v-model="form.public_profile" :description="form.description" :source-language="form.default_language" />
        </section>
        <!-- MENSAJE CORRECTO -->

        <div
          v-if="successMessage"
          role="status"
          class="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-700">
          <CheckCircle2 :size="20" class="shrink-0" />

          <span>
            {{ successMessage }}
          </span>
        </div>

        <!-- MENSAJE DE ERROR -->

        <div
          v-if="errorMessage"
          role="alert"
          class="flex items-center gap-3 rounded-xl bg-red-50 p-4 text-red-700">
          <AlertCircle :size="20" class="shrink-0" />

          <span>
            {{ errorMessage }}
          </span>
        </div>

        <!-- GUARDAR -->

        <div class="settings-save-bar">
          <button
            type="submit"
            :disabled="saving || uploadingLogo || deletingLogo || coverBusy"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-7 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            <LoaderCircle v-if="saving" :size="18" class="animate-spin" />

            <Save v-else :size="18" />

            {{ saving ? "Guardando..." : "Guardar cambios" }}
          </button>
        </div>

      </form>
    </template>
  </div>
</template>
<style scoped>
.settings-status{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;font-size:12px;color:var(--ui-secondary-text)}.settings-navigation{display:flex;gap:4px;padding:5px;background:#eaece4;border-radius:12px}.settings-navigation button{flex:1;min-width:0;padding:12px 8px;font-size:13px;font-weight:600;border-radius:8px;color:var(--ui-secondary-text)}.settings-navigation button[aria-pressed=true]{background:var(--ui-surface);color:var(--ui-accent);box-shadow:var(--ui-shadow)}.settings-form{display:grid;gap:20px}.settings-save-bar{display:flex;justify-content:flex-end;padding:14px 16px;position:sticky;bottom:16px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);background:var(--ui-surface);box-shadow:0 4px 15px #193e3410;z-index:25}.settings-save-bar button{background:var(--ui-accent)}
@media(max-width:1023px){.settings-save-bar{bottom:calc(78px + env(safe-area-inset-bottom))}}
@media(max-width:639px){.settings-navigation button{font-size:12px}.settings-save-bar{padding:10px}.settings-save-bar button{width:100%}}
</style>
