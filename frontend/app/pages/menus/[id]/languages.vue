<script setup lang="ts">
import { uiError } from "~/utils/uiErrors";
import { ArrowLeft, LoaderCircle, Pencil, X } from "lucide-vue-next";
import type { TranslationSource, TranslationStatusResponse, LanguageStatus, TranslationJob } from "~/types/menuTranslations";

definePageMeta({ middleware: "auth", layout: "dashboard" });
useHead({ title: "Idiomas de la carta | Carteliax" });
const route = useRoute();
const { apiFetch } = useApi();
const menuId = computed(() => String(route.params.id));
const endpoint = computed(() => `/api/menus/${menuId.value}/languages`);
const status = ref<TranslationStatusResponse | null>(null);
const menu = ref<{ name: string; business_id: string; is_published: boolean } | null>(null);
const loading = ref(true), busy = ref(false), error = ref(""), success = ref("");
const selected = ref("en"), search = ref("");
const editing = ref<TranslationSource | null>(null);
const form = reactive({ name: "", description: "", welcome_text: "" });
const showConfirm = ref(false), confirmText = ref(""), confirmAction = ref<(() => Promise<void>) | null>(null);
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
let wakingJob: string | undefined;
const jobRunning = computed(() => ["queued", "processing"].includes(status.value?.job?.status ?? ""));
const locked = computed(() => busy.value || jobRunning.value);
const otherLanguages = computed(() => status.value?.languages.filter((l) => l.code !== status.value?.sourceLanguage) ?? []);
const selectedStatus = computed(() => otherLanguages.value.find((l) => l.code === selected.value));
const items = computed(() => status.value?.translations.find((t) => t.language === selected.value)?.items ?? status.value?.items ?? []);
const visibleItems = computed(() => items.value.filter((i) => `${i.name} ${i.description} ${i.draft?.name ?? ""}`.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())));
const dirty = computed(() => Boolean(editing.value) && (form.name !== (editing.value?.draft?.name ?? editing.value?.name) || form.description !== (editing.value?.draft?.description ?? editing.value?.description) || form.welcome_text !== (editing.value?.draft?.welcome_text ?? editing.value?.welcome_text)));

function message(err: unknown) {
  return uiError(err, "No se han podido gestionar los idiomas. Inténtalo de nuevo.");
}
function languageLabel(l: LanguageStatus) {
  if (jobRunning.value && status.value?.job?.language_code === l.code) return "Traduciendo…";
  if (l.missing === l.total) return "Sin traducir";
  if (l.missing + l.stale) return `${l.missing + l.stale} ${l.missing + l.stale === 1 ? 'texto pendiente' : 'textos pendientes'}`;
  return l.unpublished ? "Listo para publicar" : l.published_at && l.enabled ? "Publicado" : "Actualizado";
}
function itemLabel(i: TranslationSource) { return i.type === "menu" ? "Título y bienvenida" : i.type === "category" ? "Categoría" : "Producto"; }
function confirm(text: string, action: () => Promise<void>) { confirmText.value = text; confirmAction.value = action; showConfirm.value = true; }
async function acceptConfirm() { const action = confirmAction.value; showConfirm.value = false; confirmAction.value = null; await action?.(); }

async function load(initial = false) {
  const id = menuId.value;
  if (initial) { loading.value = true; error.value = ""; }
  try {
    const [next, m] = await Promise.all([
      apiFetch<TranslationStatusResponse>(`/api/menus/${id}/languages`),
      initial ? apiFetch<{ menu: NonNullable<typeof menu.value> }>(`/api/menus/${id}`) : Promise.resolve(null),
    ]);
    if (disposed || id !== menuId.value) return;
    const previousJob = status.value?.job;
    status.value = next;
    // Wake an existing queued job after a reload, without enqueuing another
    // translation or retrying an interrupted provider request.
    wakeQueuedJob(id, next.job);
    if (m) menu.value = m.menu;
    if (!otherLanguages.value.some((l) => l.code === selected.value)) selected.value = otherLanguages.value[0]?.code ?? "";
    const jobLanguage = next.languages.find((l) => l.code === next.job?.language_code);
    if (next.job?.status === "failed" && jobLanguage && next.job.language_code !== next.sourceLanguage && jobLanguage.missing + jobLanguage.stale > 0) error.value = next.job.error_code === "CX_CHANGED" ? "La carta cambió durante la traducción. No se han sobrescrito tus textos. Vuelve a actualizar." : "No se ha podido completar la traducción. Los textos anteriores siguen intactos; puedes intentarlo de nuevo.";
    if (next.job?.status === "completed" && (previousJob?.id !== next.job.id || ["queued", "processing"].includes(previousJob?.status ?? ""))) success.value = jobLanguage && jobLanguage.missing + jobLanguage.stale > 0 ? "La traducción automática ha terminado. Revisa los textos pendientes antes de publicar." : "Traducción lista. Revísala y publícala para tus clientes.";
    if (jobRunning.value) error.value = "";
    if (jobRunning.value) schedulePoll();
  } catch (err) { if (id === menuId.value && !disposed) { error.value = message(err); if (jobRunning.value) schedulePoll(6000); } }
  finally { if (id === menuId.value) loading.value = false; }
}
function wakeQueuedJob(id: string, job: TranslationJob | null) {
  if (job?.status !== 'queued' || wakingJob === job.id) return;
  const jobId = job.id;
  wakingJob = jobId;
  void apiFetch(`/api/menus/${id}/languages/process`, { method: 'POST', body: {} })
    .catch(() => {})
    .finally(() => { if (wakingJob === jobId) wakingJob = undefined; });
}
async function pollProgress() {
  const id = menuId.value;
  try {
    const next = await apiFetch<{ job: TranslationJob | null }>(`/api/menus/${id}/languages/job`);
    if (disposed || id !== menuId.value || !status.value) return;
    if (!next.job || !['queued', 'processing'].includes(next.job.status)) {
      // Fetch drafts once on completion; polling only needs job counters.
      await load();
      return;
    }
    status.value.job = next.job;
    wakeQueuedJob(id, next.job);
    schedulePoll();
  } catch (err) {
    if (!disposed && id === menuId.value) { error.value = message(err); schedulePoll(6000); }
  }
}
function schedulePoll(delay = 1500) { clearTimeout(pollTimer); if (!disposed) pollTimer = setTimeout(() => { void pollProgress(); }, delay); }
async function action(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body: Record<string, unknown> = {}) {
  if (locked.value) return;
  const requestedId = menuId.value;
  busy.value = true; error.value = ""; success.value = "";
  try {
    const result = await apiFetch<{ message: string; job?: unknown }>(`${endpoint.value}${path}`, { method, body });
    if (disposed || requestedId !== menuId.value) return;
    success.value = result.message;
    if (method === "PUT") editing.value = null;
    await load();
  } catch (err) { if (!disposed && requestedId === menuId.value) error.value = message(err); }
  finally { if (requestedId === menuId.value) busy.value = false; }
}
function translate(l: LanguageStatus, replaceManual = false) {
  if (dirty.value) return;
  selected.value = l.code;
  if (replaceManual && l.manualStale) {
    confirm(`Se regenerarán ${l.manualStale} textos corregidos a mano cuyo original ha cambiado. Se sustituirán tus correcciones en el borrador; la versión pública se conserva hasta que publiques.`, () => action(`/${l.code}/translate`, "POST", { replaceManual: true }));
  } else void action(`/${l.code}/translate`, "POST", { replaceManual: false });
}
function changeSource(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  (event.target as HTMLSelectElement).value = status.value?.sourceLanguage ?? "es";
  if (value === status.value?.sourceLanguage) return;
  confirm("Elige el idioma en el que están escritos tus textos originales. Cambiarlo no traduce la carta y deja pendientes de revisión las traducciones existentes.", () => action("/source", "PATCH", { sourceLanguage: value }));
}
function edit(i: TranslationSource) {
  if (locked.value) return;
  editing.value = i;
  form.name = i.draft?.name ?? i.name; form.description = i.draft?.description ?? i.description; form.welcome_text = i.draft?.welcome_text ?? i.welcome_text;
}
function closeEditor() {
  if (busy.value) return;
  if (dirty.value) confirm("Tienes cambios sin guardar. ¿Quieres descartarlos?", async () => { await nextTick(); editing.value = null; });
  else editing.value = null;
}
async function save() {
  if (!editing.value) return;
  await action(`/${selected.value}/text`, "PUT", { type: editing.value.type, id: editing.value.id, ...form, sourceHash: editing.value.source_hash, revision: editing.value.draft?.revision ?? 0 });
}
function deleteTranslation(i: TranslationSource) {
  confirm("¿Eliminar esta traducción? El texto original se conservará y se mostrará también en la versión pública hasta que vuelvas a traducirlo.", () => action(`/${selected.value}/text`, "DELETE", { type: i.type, id: i.id, revision: i.draft?.revision ?? 0 }));
}
onMounted(() => { void load(true); });
watch(menuId, () => { clearTimeout(pollTimer); status.value = null; editing.value = null; busy.value = false; showConfirm.value = false; error.value = ''; success.value = ''; void load(true); });
onBeforeUnmount(() => { disposed = true; clearTimeout(pollTimer); });
onBeforeRouteLeave(() => dirty.value ? window.confirm("Tienes una traducción sin guardar. ¿Quieres salir y descartarla?") : true);
function beforeUnload(e: BeforeUnloadEvent) { if (dirty.value) { e.preventDefault(); e.returnValue = ""; } }
onMounted(() => window.addEventListener("beforeunload", beforeUnload));
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));
</script>

<template>
  <div class="ui-page languages-page">
    <NuxtLink :to="`/menus/${menuId}`" class="ui-quiet w-fit"><ArrowLeft :size="18" /> Volver a la carta</NuxtLink>
    <header><p class="ui-eyebrow">ATIENDE A MÁS CLIENTES</p><h1 class="ui-title">Idiomas</h1><p class="ui-description">{{ menu?.name }} · Traduce, revisa y publica para tus clientes.</p></header>
    <UiMenuNavigation :menu-id="menuId" />
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-800">{{ error }}</p>
    <p v-if="success" role="status" class="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{{ success }}</p>
    <div v-if="loading" role="status" class="ui-panel flex items-center gap-3"><LoaderCircle class="animate-spin" :size="20" /> Cargando idiomas…</div>
    <section v-else-if="!status" class="ui-panel"><p>No se han podido cargar los idiomas.</p><button class="ui-secondary mt-4" @click="load(true)">Reintentar</button></section>
    <template v-else>
      <section class="ui-panel">
        <label for="source-language" class="block font-semibold">Idioma de los textos originales</label>
        <select id="source-language" :value="status.sourceLanguage" :disabled="locked || dirty" class="mt-3 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base sm:max-w-xs" @change="changeSource">
          <option v-for="l in status.languages" :key="l.code" :value="l.code">{{ l.name }}</option>
        </select>
        <p class="mt-2 text-sm text-slate-500">Tus productos y categorías originales no se modifican al traducir.</p>
      </section>
      <section class="ui-panel language-list divide-y divide-slate-100" aria-label="Otros idiomas">
        <article v-for="l in otherLanguages" :key="l.code" class="language-row py-4 first:pt-0 last:pb-0">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div><h2 class="text-lg font-semibold">{{ l.name }} <span class="text-sm font-normal text-slate-500">{{ l.native_name }}</span></h2><p class="mt-1 text-sm" :class="l.stale || l.missing ? 'text-amber-800' : 'text-emerald-800'">{{ languageLabel(l) }}</p><p class="mt-1 text-sm text-slate-500">{{ l.enabled ? (status.publicReady ? 'Visible para tus clientes' : 'Se mostrará al publicar la carta y su diseño') : 'No se muestra en la carta pública' }}<span v-if="l.unpublished"> · {{ l.unpublished }} textos sin publicar</span></p></div>
            <div class="flex flex-wrap gap-2">
              <button :disabled="locked || dirty || l.missing + l.stale - l.manualStale === 0" class="ui-primary" @click="translate(l)">{{ l.missing === l.total ? 'Traducir' : 'Actualizar' }}</button>
              <button :disabled="locked || dirty" class="ui-secondary" @click="selected = l.code; search = ''">Revisar y editar</button>
            </div>
          </div>
          <p v-if="l.manualStale" class="mt-3 text-sm text-amber-800">{{ l.manualStale === 1 ? '1 texto corregido a mano necesita revisión.' : `${l.manualStale} textos corregidos a mano necesitan revisión.` }} Se conservan al actualizar.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button :disabled="locked || dirty || l.missing + l.stale > 0" class="ui-secondary" @click="action(`/${l.code}/publish`, 'POST')">Publicar {{ l.name.toLocaleLowerCase() }}</button>
            <button v-if="l.published_at" :disabled="locked || dirty" class="ui-quiet" @click="action(`/${l.code}`, 'PATCH', { enabled: !l.enabled })">{{ l.enabled ? 'Ocultar idioma' : 'Mostrar idioma' }}</button>
            <button v-if="l.manualStale" :disabled="locked || dirty" class="ui-quiet" @click="translate(l, true)">Regenerar correcciones pendientes</button>
          </div>
        </article>
      </section>
      <section v-if="jobRunning" role="status" class="ui-panel flex items-center gap-3"><LoaderCircle class="shrink-0 animate-spin" :size="20" /><div><p class="font-semibold">Traduciendo… {{ status.job?.completed_items }} / {{ status.job?.total_items }} textos</p><p class="text-sm text-slate-500">Puedes salir de esta pantalla. La traducción continúa y no se publica automáticamente.</p></div></section>
      <p v-if="menu && !status.publicReady" class="text-sm text-slate-500">Para mostrar los idiomas a tus clientes, la carta y su diseño deben estar publicados. Publicar un idioma no cambia esos estados.</p>
      <section v-if="selectedStatus" class="translation-review space-y-4">
        <div><h2 class="text-xl font-semibold">Revisar {{ selectedStatus.name.toLocaleLowerCase() }}</h2><p class="ui-description">Guardar una corrección no utiliza traducción automática. Después, publica el idioma.</p></div>
        <label for="translation-search" class="sr-only">Buscar texto original o traducido</label><input id="translation-search" v-model="search" type="search" placeholder="Buscar un producto o categoría" class="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base" />
        <p v-if="!visibleItems.length" class="ui-panel text-sm text-slate-500">No hay textos que coincidan con la búsqueda.</p>
        <article v-for="i in visibleItems" :key="`${i.type}:${i.id}`" class="ui-panel">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ itemLabel(i) }}</span>
          <h3 class="mt-1 font-semibold break-words">{{ i.name }}</h3><p v-if="i.description" class="mt-1 whitespace-pre-line break-words text-sm text-slate-500">{{ i.description }}</p>
          <div class="mt-3 rounded-lg bg-slate-50 p-3"><p class="break-words font-medium">{{ i.draft?.name || 'Todavía sin traducir' }}</p><p v-if="i.draft?.description" class="mt-1 whitespace-pre-line break-words text-sm">{{ i.draft.description }}</p><p v-if="i.draft?.welcome_text" class="mt-1 whitespace-pre-line break-words text-sm">{{ i.draft.welcome_text }}</p><p v-if="i.draft && i.draft.source_hash !== i.source_hash" class="mt-2 text-sm font-medium text-amber-800">El original ha cambiado. Revisa esta traducción.</p><p v-if="i.draft?.is_manual" class="mt-1 text-xs text-slate-500">Corregido a mano</p></div>
          <div class="mt-3 flex flex-wrap gap-2"><button class="ui-secondary" :disabled="locked" @click="edit(i)"><Pencil :size="16" /> Editar traducción</button><button v-if="i.draft" class="ui-quiet text-red-700" :disabled="locked" @click="deleteTranslation(i)">Eliminar traducción</button></div>
        </article>
      </section>
    </template>

    <div v-if="editing" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-2 sm:items-center sm:p-5" @click.self="closeEditor">
      <form v-dialog-accessibility="closeEditor" role="dialog" aria-modal="true" aria-labelledby="translation-dialog-title" class="flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white" @submit.prevent="save">
        <header class="flex shrink-0 items-center justify-between border-b border-slate-100 p-4"><h2 id="translation-dialog-title" class="font-semibold">Editar {{ selectedStatus?.name.toLocaleLowerCase() }}</h2><button type="button" class="ui-quiet p-2" aria-label="Cerrar" :disabled="busy" @click="closeEditor"><X :size="20" /></button></header>
        <div class="space-y-4 overflow-y-auto p-4"><div class="rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><p class="font-semibold">Texto original</p><p class="mt-1 break-words">{{ editing.name }}</p><p v-if="editing.description" class="mt-1 whitespace-pre-line break-words">{{ editing.description }}</p><p v-if="editing.welcome_text" class="mt-1 whitespace-pre-line break-words">{{ editing.welcome_text }}</p></div><div><label for="translated-name" class="mb-2 block font-medium">Nombre</label><input id="translated-name" v-model="form.name" required maxlength="240" class="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" /></div><div v-if="editing.type !== 'category'"><label for="translated-description" class="mb-2 block font-medium">Descripción</label><textarea id="translated-description" v-model="form.description" rows="4" maxlength="2000" class="w-full rounded-lg border border-slate-300 p-3 text-base" /><p class="mt-1 text-sm text-slate-500">Si la dejas vacía, se mostrará el texto original.</p></div><div v-if="editing.type === 'menu'"><label for="translated-welcome" class="mb-2 block font-medium">Bienvenida publicada</label><textarea id="translated-welcome" v-model="form.welcome_text" rows="2" maxlength="1000" class="w-full rounded-lg border border-slate-300 p-3 text-base" /></div><p v-if="error" role="alert" class="text-sm text-red-700">{{ error }}</p></div>
        <footer class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 p-4"><button type="button" :disabled="busy" class="ui-secondary" @click="closeEditor">Cancelar</button><button type="submit" :disabled="busy || !form.name.trim()" class="ui-primary">{{ busy ? 'Guardando…' : 'Guardar traducción' }}</button></footer>
      </form>
    </div>
    <div v-if="showConfirm" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" @click.self="showConfirm = false">
      <section v-dialog-accessibility="() => { showConfirm = false; }" role="dialog" aria-modal="true" aria-labelledby="translation-confirm-title" class="ui-panel max-h-[90dvh] w-full max-w-md overflow-y-auto"><h2 id="translation-confirm-title" class="text-lg font-semibold">Revisa antes de continuar</h2><p class="mt-3 text-sm text-slate-600">{{ confirmText }}</p><div class="mt-5 flex flex-wrap justify-end gap-2"><button class="ui-secondary" @click="showConfirm = false">Cancelar</button><button class="ui-primary" @click="acceptConfirm">Continuar</button></div></section>
    </div>
  </div>
</template>

<style scoped>
.language-row{position:relative;padding:22px 0}.language-row h2{font-size:17px}.language-row h2 span{font-size:12px}.language-row>div:first-child>div:first-child{border-left:3px solid #c8d9c2;padding-left:14px}.language-row .ui-primary,.language-row .ui-secondary{font-size:12px}.translation-review{margin-top:8px}.translation-review>article{position:relative}.translation-review>article>span{font-size:9px;letter-spacing:.12em}.translation-review>article>div.bg-slate-50{border-left:3px solid #c7d9c0;border-radius:0 9px 9px 0;padding:16px}.translation-review>article h3{font-size:15px}@media(min-width:1024px){.translation-review>article{display:grid;grid-template-columns:1fr 1fr;column-gap:28px}.translation-review>article>span,.translation-review>article>h3,.translation-review>article>p{grid-column:1}.translation-review>article>div.bg-slate-50{grid-column:2;grid-row:1/5;margin-top:0}.translation-review>article>div:last-child{grid-column:1/-1}}
</style>
