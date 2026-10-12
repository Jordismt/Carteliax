<script setup lang="ts">
import { ArrowLeft, CheckCircle2, Eye, LoaderCircle, QrCode, Send, Smartphone, Monitor, Palette } from 'lucide-vue-next';
import type { MenuThemeRecord, PreviewCategory } from '~/types/menuTheme';
import type { PublicSiteResponse, PublicProfile } from '~/types/publicSite';
import { emptyPublicProfile } from '~/types/publicSite';
import { publicMenuPath } from '~/utils/publicUrls';
import { uiError } from '~/utils/uiErrors';
definePageMeta({ middleware: 'auth', layout: 'dashboard' });
useHead({ title: 'Revisión y publicación | Carteliax' });
interface Menu { id: string; name: string; slug: string; description: string | null; business_id: string; is_published: boolean; public_ready?: boolean; public_slug?: string }
interface Business { id: string; name: string; public_slug?: string; logo_url: string | null; cover_url: string | null; description: string | null; primary_color: string; default_language: string; public_profile?: PublicProfile }
const route = useRoute();
const menuId = computed(() => String(route.params.id));
const { apiFetch } = useApi();
const { getTheme, publishTheme } = useMenuTheme();
const { loadMenuPreview } = useMenuPreviewData();
const menu = ref<Menu>();
const business = ref<Business>();
const record = ref<MenuThemeRecord>();
const categories = ref<PreviewCategory[]>([]);
const loading = ref(true);
const busy = ref(false);
const confirmed = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const mode = ref<'mobile' | 'desktop'>('mobile');
const stalePreview = ref(false);
const productCount = computed(() => categories.value.reduce((n,c) => n+c.products.length,0));
const designChanged = computed(() => !!record.value && JSON.stringify(record.value.draft_config) !== JSON.stringify(record.value.published_config));
const language = computed(() => business.value?.default_language === 'ca' ? 'val' : business.value?.default_language || 'es');
const preview = computed<PublicSiteResponse>(() => ({ success: true, business: { name: business.value?.name || '', public_slug: business.value?.public_slug || '', description: business.value?.description || null, logo_url: business.value?.logo_url || null, cover_url: business.value?.cover_url || null, primary_color: business.value?.primary_color || '#16a34a', default_language: language.value, profile: { ...emptyPublicProfile(), ...business.value?.public_profile } }, menus: [], currentMenu: menu.value && business.value && record.value ? { success: true, business: business.value, menu: menu.value, theme: record.value.draft_config, categories: categories.value } : null }));
async function load() {
  const id = menuId.value;
  loading.value = true; errorMessage.value = ''; successMessage.value = ''; confirmed.value = false; stalePreview.value = false;
  menu.value = undefined; business.value = undefined; record.value = undefined;
  try {
    const [result, theme, content] = await Promise.all([apiFetch<{ menu: Menu }>(`/api/menus/${id}`), getTheme(id), loadMenuPreview(id)]);
    const owner = await apiFetch<{ business: Business }>(`/api/businesses/${result.menu.business_id}`);
    if (id !== menuId.value) return;
    menu.value = result.menu; business.value = owner.business; record.value = theme.theme; categories.value = content;
  } catch (error) { if (id === menuId.value) errorMessage.value = uiError(error, 'No se pudo preparar la revisión.'); }
  finally { if (id === menuId.value) loading.value = false; }
}
async function publish() {
  if (busy.value || loading.value || !confirmed.value || !menu.value || !record.value) return;
  busy.value = true; errorMessage.value = ''; successMessage.value = '';
  try {
    const current = await getTheme(menuId.value);
    if (JSON.stringify(current.theme.draft_config) !== JSON.stringify(record.value.draft_config)) {
      confirmed.value = false; stalePreview.value = true;
      errorMessage.value = 'El diseño cambió desde que abriste la revisión. Actualiza la vista previa y vuelve a comprobarlo.';
      return;
    }
    // Publish the saved draft first; never let the menu PATCH create a default design.
    const theme = await publishTheme(menuId.value);
    record.value = theme.theme;
    if (!menu.value.is_published || menu.value.public_ready === false) {
      const response = await apiFetch<{ menu: Menu }>(`/api/menus/${menuId.value}`, { method: 'PATCH', body: { is_published: true } });
      menu.value = { ...menu.value, ...response.menu, public_ready: true };
    }
    successMessage.value = 'Carta publicada. Ya puedes compartir su enlace y QR.';
    confirmed.value = false;
  } catch (error) { errorMessage.value = uiError(error, 'No se completó la publicación. Revisa el estado y vuelve a intentarlo.'); }
  finally { busy.value = false; }
}
onMounted(load);
watch(menuId, load);
onBeforeRouteLeave(() => !busy.value);
</script>
<template>
  <div class="ui-page mx-auto max-w-7xl">
    <UiSkeleton v-if="loading" label="Preparando la revisión final…" :count="3" />
    <template v-else-if="menu && business && record">
      <NuxtLink :to="`/menus/${menuId}/design`" class="ui-quiet w-fit"><ArrowLeft :size="17" /> Volver al diseño</NuxtLink>
      <UiPageHeader title="Una última mirada, antes de compartir" :description="`${menu.name} · ${business.name}`" />
      <MenusCreationProgress v-if="!menu.is_published" :menu-id="menuId" :business-id="menu.business_id" :step="4" />
      <UiMenuNavigation :menu-id="menuId" />
      <UiNotice v-if="errorMessage" tone="danger">{{ errorMessage }}<button v-if="stalePreview" type="button" class="ui-secondary mt-2" @click="load">Actualizar revisión</button></UiNotice>
      <UiNotice v-if="successMessage" tone="success">{{ successMessage }}</UiNotice>
      <div class="review-grid">
        <section class="review-summary" aria-labelledby="review-title">
          <p class="ui-eyebrow">REVISIÓN FINAL</p><h2 id="review-title">Tu carta, lista para la mesa.</h2>
          <dl><div><dt>Información</dt><dd>{{ menu.name }}</dd></div><div><dt>Contenido visible</dt><dd>{{ categories.length }} categorías · {{ productCount }} platos</dd></div><div><dt>Diseño</dt><dd>{{ business.public_slug ? ({modern:'Moderna',elegant:'Elegante',minimal:'Minimalista',classic:'Clásica'}[preview.business.profile.template]) : ({modern:'Moderna',minimal:'Minimalista',premium:'Premium',mediterranean:'Mediterránea'}[record.draft_config.template]) }}</dd></div><div><dt>Estado actual</dt><dd>{{ menu.is_published && menu.public_ready !== false ? 'Publicada' : 'Borrador / pendiente de publicación' }}</dd></div></dl>
          <p class="review-explanation">La vista previa usa los platos disponibles y las categorías visibles. Comprueba nombres, precios, alérgenos y diseño.</p>
          <p v-if="menu.is_published" class="review-explanation">La carta ya está publicada: los cambios de contenido se muestran al guardar. Esta acción publica el diseño guardado; los idiomas se gestionan desde su sección.</p>
          <UiNotice v-if="!productCount" tone="info">Todavía no hay platos visibles. Puedes volver a Contenido o publicar una carta vacía de forma consciente.</UiNotice>
          <NuxtLink :to="`/menus/${menuId}`" class="ui-secondary w-full">Revisar contenido</NuxtLink>
          <NuxtLink :to="`/menus/${menuId}/design`" class="ui-secondary w-full"><Palette :size="16" /> Ajustar diseño</NuxtLink>
          <label class="review-consent"><input v-model="confirmed" type="checkbox" :disabled="busy" /><span>He revisado la vista previa y quiero {{ menu.is_published ? 'publicar este diseño' : 'hacer visible esta carta a mis clientes' }}{{ !productCount ? ", aunque todavía no tenga platos visibles" : "" }}.</span></label>
          <button class="ui-primary w-full" :disabled="busy || !confirmed" type="button" @click="publish"><LoaderCircle v-if="busy" class="animate-spin" :size="17" /><Send v-else :size="17" />{{ busy ? 'Publicando…' : menu.is_published ? 'Publicar diseño revisado' : 'Publicar carta' }}</button>
          <p class="review-explanation">Puedes salir y continuar después. El contenido y el borrador de diseño guardados se conservarán.</p>
          <div v-if="menu.is_published && menu.public_ready !== false" class="review-shared"><CheckCircle2 :size="20" /><strong>{{ designChanged ? 'Carta pública disponible. Hay un diseño pendiente.' : 'Tu carta está disponible' }}</strong><a :href="publicMenuPath(menu.business_id, menu.slug, business.public_slug)" target="_blank" rel="noopener noreferrer" class="ui-secondary"><Eye :size="16" /> Ver carta pública</a><NuxtLink :to="`/menus/${menuId}/qr`" class="ui-secondary"><QrCode :size="16" /> Obtener QR y enlace</NuxtLink></div>
        </section>
        <section class="review-preview" aria-label="Vista previa final">
          <div class="review-preview-toolbar"><span><Eye :size="17" /> Vista previa final</span><div><button type="button" :aria-pressed="mode === 'mobile'" aria-label="Vista móvil" @click="mode='mobile'"><Smartphone :size="18" /></button><button type="button" :aria-pressed="mode === 'desktop'" aria-label="Vista ordenador" @click="mode='desktop'"><Monitor :size="18" /></button></div></div>
          <div class="review-preview-stage"><div class="review-preview-frame" :class="mode"><PublicRestaurantSite v-if="business.public_slug" :site="preview" :language="language" preview /><MenuEditorMenuLivePreview v-else :theme="record.draft_config" :restaurant-name="business.name" :logo-url="business.logo_url" :categories="categories" /></div></div>
        </section>
      </div>
    </template>
    <UiNotice v-else tone="danger">{{ errorMessage || 'No se pudo cargar la carta.' }}<button type="button" class="ui-secondary" @click="load">Reintentar</button></UiNotice>
  </div>
</template>
<style scoped>
.review-grid{display:grid;grid-template-columns:340px minmax(0,1fr);gap:28px;align-items:start}.review-summary{background:white;border:1px solid var(--ui-border);border-radius:16px;padding:24px}.review-summary h2{font:400 30px/1.15 Georgia,serif;color:#15372b;margin:10px 0 24px}.review-summary dl{margin-bottom:20px}.review-summary dl>div{padding:12px 0;border-bottom:1px solid #e2e8f0}.review-summary dt{font-size:11px;color:#64748b;margin-bottom:5px}.review-summary dd{font-size:13px;font-weight:600;overflow-wrap:anywhere}.review-explanation{font-size:12px;color:#64748b;line-height:1.7;margin:16px 0}.review-summary .ui-secondary{margin-top:8px}.review-consent{display:flex;align-items:start;gap:12px;margin:24px 0;font-size:13px;line-height:1.6}.review-consent input{width:18px;height:18px;flex-shrink:0;accent-color:#065f46;margin-top:2px}.review-shared{display:flex;flex-direction:column;gap:8px;margin-top:24px;padding-top:20px;border-top:1px solid #e2e8f0;color:#065f46;font-size:13px}.review-preview{border:1px solid var(--ui-border);border-radius:16px;overflow:hidden;background:#e9ece8}.review-preview-toolbar{display:flex;align-items:center;justify-content:space-between;padding:16px;background:white;gap:12px}.review-preview-toolbar span{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}.review-preview-toolbar>div{display:flex;gap:4px}.review-preview-toolbar button{width:44px;height:44px;display:grid;place-items:center;border-radius:8px}.review-preview-toolbar button[aria-pressed=true]{background:#ecfdf5;color:#065f46}.review-preview-stage{padding:24px;display:flex;justify-content:center}.review-preview-frame{width:100%;max-height:780px;overflow-y:auto;overscroll-behavior:contain;border:1px solid #d5ddd4;box-shadow:0 16px 40px #15372b10;border-radius:12px}.review-preview-frame.mobile{max-width:390px}.review-preview-frame.desktop{max-width:100%}@media(max-width:900px){.review-grid{grid-template-columns:minmax(0,1fr)}.review-preview{grid-row:1}.review-preview-stage{padding:12px}.review-preview-frame{max-height:600px}.review-summary{padding:20px}}
</style>
