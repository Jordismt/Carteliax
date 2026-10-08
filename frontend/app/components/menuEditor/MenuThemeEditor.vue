<script setup lang="ts">
import { computed, ref } from "vue";
import { Image as ImageIcon, Check, ChevronDown, ChevronUp, Palette, SlidersHorizontal, Sparkles, Type, LayoutTemplate, Info, RotateCcw } from "lucide-vue-next";

import { MENU_PRESETS, cloneTheme } from "~/types/menuTheme";

import type { MenuTheme, MenuTemplate, MenuFont, ProductStyle } from "~/types/menuTheme";

// ==========================================
// PROPIEDADES
// ==========================================

const props = defineProps<{
  modelValue: MenuTheme;
  unifiedSite?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: MenuTheme];
}>();

const theme = computed({
  get: () => props.modelValue,
  set: (value: MenuTheme) => emit("update:modelValue", value),
});

// ==========================================
// INTERFAZ
// ==========================================

const showAdvanced = ref(false);
const showCoverInput = ref(false);

// ==========================================
// PLANTILLAS
// ==========================================

const templates: {
  id: MenuTemplate;
  name: string;
  description: string;
  preview: {
    background: string;
    surface: string;
    primary: string;
    text: string;
  };
}[] = [
  {
    id: "modern",
    name: "Moderna",
    description: "Fresca y actual",
    preview: {
      background: "#f0fdf4",
      surface: "#ffffff",
      primary: "#16a34a",
      text: "#14532d",
    },
  },
  {
    id: "minimal",
    name: "Minimalista",
    description: "Sencilla y elegante",
    preview: {
      background: "#f5f5f4",
      surface: "#ffffff",
      primary: "#292524",
      text: "#292524",
    },
  },
  {
    id: "premium",
    name: "Premium",
    description: "Distinguida y sofisticada",
    preview: {
      background: "#171717",
      surface: "#262626",
      primary: "#d4af37",
      text: "#fafaf9",
    },
  },
  {
    id: "mediterranean",
    name: "Mediterránea",
    description: "Cálida y acogedora",
    preview: {
      background: "#fffbeb",
      surface: "#ffffff",
      primary: "#b45309",
      text: "#78350f",
    },
  },
];

// ==========================================
// COLORES RÁPIDOS
// ==========================================

const suggestedColors = [
  { name: "Verde", value: "#16a34a" },
  { name: "Esmeralda", value: "#059669" },
  { name: "Azul", value: "#2563eb" },
  { name: "Negro", value: "#171717" },
  { name: "Dorado", value: "#b45309" },
  { name: "Terracota", value: "#c2410c" },
  { name: "Rojo", value: "#dc2626" },
];

const advancedColors = [
  { key: "primary", label: "Color principal" },
  { key: "secondary", label: "Color secundario" },
  { key: "background", label: "Fondo de la carta" },
  { key: "surface", label: "Fondo de productos" },
  { key: "text", label: "Texto principal" },
  { key: "muted", label: "Texto secundario" },
] as const;

// ==========================================
// TIPOGRAFÍA Y DISEÑO
// ==========================================

const headingFonts: MenuFont[] = ["Inter", "Poppins", "Montserrat", "Playfair Display", "Lora"];

const bodyFonts: MenuTheme["typography"]["body"][] = ["Inter", "Poppins", "Montserrat", "Lora"];

const productStyles: {
  id: ProductStyle;
  name: string;
  description: string;
}[] = [
  {
    id: "cards",
    name: "Tarjetas",
    description: "Productos en cuadrícula",
  },
  {
    id: "list",
    name: "Lista",
    description: "Productos uno debajo de otro",
  },
  {
    id: "compact",
    name: "Compacto",
    description: "Ocupa menos espacio",
  },
];

// ==========================================
// ESTADO DERIVADO
// ==========================================

const currentTemplate = computed(() => templates.find((item) => item.id === theme.value.template));

const isSuggestedColor = computed(() =>
  suggestedColors.some((item) => item.value.toLowerCase() === theme.value.colors.primary.toLowerCase()),
);

// ==========================================
// UTILIDADES
// ==========================================

function updateTheme(callback: (draft: MenuTheme) => void) {
  const draft = cloneTheme(theme.value);
  callback(draft);
  theme.value = draft;
}

function selectTemplate(id: MenuTemplate) {
  if (theme.value.template === id) return;

  const preset = cloneTheme(MENU_PRESETS[id]);

  // Mantener la información que ya ha escrito
  // el propietario al cambiar de plantilla.
  preset.branding = {
    ...theme.value.branding,
  };

  theme.value = preset;
}

function setColor(key: keyof MenuTheme["colors"], value: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return;

  updateTheme((draft) => {
    draft.colors[key] = value;
  });
}

function setWelcomeText(value: string) {
  updateTheme((draft) => {
    draft.branding.welcomeText = value.slice(0, 250);
  });
}

function setCoverUrl(value: string) {
  updateTheme((draft) => {
    draft.branding.coverUrl = value.trim() || null;
  });
}

function removeCover() {
  updateTheme((draft) => {
    draft.branding.coverUrl = null;
  });

  showCoverInput.value = false;
}

function setHeadingFont(value: string) {
  if (!headingFonts.includes(value as MenuFont)) return;

  updateTheme((draft) => {
    draft.typography.heading = value as MenuFont;
  });
}

function setBodyFont(value: string) {
  const font = value as MenuTheme["typography"]["body"];

  if (!bodyFonts.includes(font)) return;

  updateTheme((draft) => {
    draft.typography.body = font;
  });
}

function setProductStyle(value: ProductStyle) {
  updateTheme((draft) => {
    draft.layout.productStyle = value;
  });
}

function setLayoutBoolean(key: "showImages" | "showDescriptions" | "showAllergens", value: boolean) {
  updateTheme((draft) => {
    draft.layout[key] = value;
  });
}

function setBorderRadius(value: string) {
  const radius = Number(value);

  if (!Number.isFinite(radius)) return;

  updateTheme((draft) => {
    draft.layout.borderRadius = Math.max(0, Math.min(32, Math.round(radius)));
  });
}

function resetTemplateAppearance() {
  if (!window.confirm("¿Recuperar los ajustes del estilo elegido? Se restablecerán los colores, la tipografía y la distribución del borrador. Tu portada y mensaje se conservarán.")) return;
  const preset = cloneTheme(MENU_PRESETS[theme.value.template]);

  preset.branding = {
    ...theme.value.branding,
  };

  theme.value = preset;
}
</script>

<template>
  <div class="space-y-5">
    <!-- ======================================
         INTRODUCCIÓN
    ======================================= -->

    <!-- ======================================
         1. ELEGIR ESTILO
    ======================================= -->

    <section v-if="!unifiedSite" class="editor-section">
      <div class="mb-5 flex items-start gap-3">
        <div class="section-icon">
          <LayoutTemplate :size="19" />
        </div>

        <div>
          <div class="flex items-center gap-2">
            <span class="step-number">1</span>

            <h2 class="text-lg font-extrabold text-slate-900">Elige un estilo</h2>
          </div>

          <p class="mt-1 text-sm text-slate-500">Selecciona el diseño que mejor encaje con tu restaurante.</p>
        </div>
      </div>

      <!-- PLANTILLAS -->

      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="item in templates"
          :key="item.id"
          type="button"
          class="template-option group relative overflow-hidden rounded-2xl border-2 bg-white p-2 text-left transition-all duration-200"
          :class="
            theme.template === item.id
              ? 'border-emerald-600 shadow-md shadow-emerald-100'
              : 'border-slate-200 hover:border-emerald-300 hover:shadow-sm'
          "
          :aria-pressed="theme.template === item.id"
          @click="selectTemplate(item.id)">
          <!-- MINIATURA DE LA CARTA -->

          <div
            class="relative h-28 overflow-hidden rounded-lg p-3"
            :style="{
              backgroundColor: item.preview.background,
              color: item.preview.text,
            }">
            <!-- CABECERA -->

            <div class="flex flex-col items-center">
              <div
                class="mb-2 flex h-7 w-7 items-center justify-center rounded-full"
                :style="{
                  backgroundColor: item.preview.primary,
                  opacity: 0.85,
                }">
                <span class="text-[11px] font-bold text-white"> R </span>
              </div>

              <div
                class="h-1.5 w-20 rounded-full"
                :style="{
                  backgroundColor: item.preview.text,
                }" />

              <div
                class="mt-1.5 h-1 w-12 rounded-full opacity-30"
                :style="{
                  backgroundColor: item.preview.text,
                }" />
            </div>

            <!-- CATEGORÍA -->

            <div
              class="mx-auto mt-3 h-3 w-16 rounded-full"
              :style="{
                backgroundColor: item.preview.primary,
                opacity: 0.75,
              }" />

            <!-- PRODUCTOS -->

            <div class="mt-2 grid grid-cols-2 gap-1.5">
              <div
                v-for="n in 2"
                :key="n"
                class="overflow-hidden rounded-md"
                :style="{
                  backgroundColor: item.preview.surface,
                }">
                <div
                  class="h-7"
                  :style="{
                    backgroundColor: item.preview.primary,
                    opacity: n === 1 ? 0.24 : 0.12,
                  }" />

                <div class="space-y-1 p-1.5">
                  <div
                    class="h-1 w-4/5 rounded-full"
                    :style="{
                      backgroundColor: item.preview.text,
                      opacity: 0.75,
                    }" />

                  <div
                    class="h-1 w-3/5 rounded-full"
                    :style="{
                      backgroundColor: item.preview.text,
                      opacity: 0.2,
                    }" />

                  <div
                    class="mt-1 h-1 w-1/3 rounded-full"
                    :style="{
                      backgroundColor: item.preview.primary,
                    }" />
                </div>
              </div>
            </div>

            <!-- SELECCIÓN -->

            <div
              v-if="theme.template === item.id"
              class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
              <Check :size="14" :stroke-width="3" />
            </div>
          </div>

          <!-- NOMBRE -->

          <div class="px-1 pb-1 pt-3">
            <p class="text-sm font-extrabold text-slate-900">
              {{ item.name }}
            </p>

            <p class="mt-0.5 text-xs text-slate-500">
              {{ item.description }}
            </p>
          </div>
        </button>
      </div>

      <div v-if="currentTemplate" class="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5">
        <Check :size="16" class="shrink-0 text-emerald-600" />

        <p class="text-xs font-semibold text-emerald-800">
          Estilo {{ currentTemplate.name.toLowerCase() }} seleccionado
        </p>
      </div>

      <p class="mt-3 text-xs leading-relaxed text-slate-400">
        Puedes cambiar de estilo cuando quieras. Tu portada y mensaje de bienvenida se conservarán.
      </p>
    </section>

    <!-- ======================================
         2. PERSONALIZACIÓN
    ======================================= -->

    <section class="editor-section">
      <div class="mb-5 flex items-start gap-3">
        <div class="section-icon">
          <Palette :size="19" />
        </div>

        <div>
          <div class="flex items-center gap-2">
            <span class="step-number">2</span>

            <h2 class="text-lg font-extrabold text-slate-900">Dale tu toque personal</h2>
          </div>

          <p class="mt-1 text-sm text-slate-500">
            Estos detalles son opcionales. Tu carta ya está lista con el estilo elegido.
          </p>
        </div>
      </div>

      <!-- COLOR PRINCIPAL -->

      <div v-if="!unifiedSite" class="rounded-xl border border-slate-200 p-4">
        <div class="mb-4 flex items-start gap-3">
          <Palette :size="18" class="mt-0.5 shrink-0 text-slate-500" />

          <div>
            <h3 class="text-sm font-bold text-slate-900">Color principal</h3>

            <p class="mt-1 text-xs leading-relaxed text-slate-500">
              Se utilizará en los botones y detalles de tu carta.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            v-for="color in suggestedColors"
            :key="color.value"
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-full transition hover:scale-110"
            :class="
              theme.colors.primary.toLowerCase() === color.value.toLowerCase()
                ? 'ring-2 ring-emerald-600 ring-offset-2'
                : 'ring-1 ring-slate-200'
            "
            :style="{
              backgroundColor: color.value,
            }"
            :title="color.name"
            :aria-label="`Elegir color ${color.name}`"
            :aria-pressed="theme.colors.primary.toLowerCase() === color.value.toLowerCase()"
            @click="setColor('primary', color.value)">
            <Check
              v-if="theme.colors.primary.toLowerCase() === color.value.toLowerCase()"
              :size="19"
              :stroke-width="3"
              class="text-white drop-shadow" />
          </button>

          <!-- COLOR PERSONALIZADO -->

          <label
            class="relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 transition hover:border-emerald-500"
            title="Elegir otro color">
            <Palette v-if="isSuggestedColor" :size="17" class="pointer-events-none text-slate-500" />

            <span
              v-else
              class="pointer-events-none h-7 w-7 rounded-full"
              :style="{
                backgroundColor: theme.colors.primary,
              }" />

            <input
              type="color"
              aria-label="Elegir color personalizado"
              :value="theme.colors.primary"
              class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              @input="setColor('primary', ($event.target as HTMLInputElement).value)" />
          </label>
        </div>
      </div>

      <!-- MENSAJE DE BIENVENIDA -->

      <div class="mt-4 rounded-xl border border-slate-200 p-4">
        <label for="welcome-text" class="block text-sm font-bold text-slate-900">
          Mensaje de bienvenida
        </label>

        <p class="mt-1 text-xs leading-relaxed text-slate-500">Una frase para recibir a tus clientes.</p>

        <textarea
          id="welcome-text"
          :value="theme.branding.welcomeText"
          maxlength="250"
          rows="3"
          placeholder="¡Bienvenidos! Disfruta de nuestra carta..."
          class="editor-input mt-3 resize-none"
          @input="setWelcomeText(($event.target as HTMLTextAreaElement).value)" />

        <p class="mt-1.5 text-right text-xs text-slate-400">{{ theme.branding.welcomeText.length }}/250</p>
      </div>

      <!-- PORTADA -->

      <div class="mt-4 rounded-xl border border-slate-200 p-4">
        <div class="flex items-start gap-3">
          <ImageIcon :size="19" class="mt-0.5 shrink-0 text-slate-500" />

          <div class="min-w-0 flex-1">
            <h3 class="text-sm font-bold text-slate-900">Imagen de portada</h3>

            <p class="mt-1 text-xs leading-relaxed text-slate-500">
              Añade una fotografía para dar la bienvenida a tus clientes.
            </p>
          </div>
        </div>

        <!-- PORTADA EXISTENTE -->

        <div
          v-if="theme.branding.coverUrl"
          class="relative mt-4 overflow-hidden rounded-xl border border-slate-200">
          <img :src="theme.branding.coverUrl" alt="Portada actual" class="h-36 w-full object-cover" />

          <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3">
            <span class="text-xs font-semibold text-slate-600"> Portada añadida </span>

            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                @click="showCoverInput = !showCoverInput">
                Cambiar
              </button>

              <button
                type="button"
                class="rounded-lg border border-red-100 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                @click="removeCover">
                Quitar
              </button>
            </div>
          </div>
        </div>

        <!-- AÑADIR PORTADA -->

        <button
          v-else
          type="button"
          class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50"
          @click="showCoverInput = !showCoverInput">
          <ImageIcon :size="19" />
          Añadir imagen de portada
        </button>

        <!-- CAMPO URL -->

        <div v-if="showCoverInput" class="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
          <label for="cover-url" class="block text-xs font-semibold text-slate-700">
            Enlace de la imagen
          </label>

          <input
            id="cover-url"
            type="url"
            :value="theme.branding.coverUrl ?? ''"
            placeholder="https://ejemplo.com/portada.jpg"
            class="editor-input"
            @change="setCoverUrl(($event.target as HTMLInputElement).value)" />

          <p class="text-xs leading-relaxed text-slate-500">
            Por ahora, utiliza una URL HTTPS de una imagen. La subida directa de fotografías se añadirá cuando
            conectemos esta función con Storage.
          </p>
        </div>
      </div>
    </section>

    <!-- ======================================
         3. MÁS OPCIONES
    ======================================= -->

    <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-slate-50"
        :aria-expanded="showAdvanced"
        aria-controls="advanced-menu-options"
        @click="showAdvanced = !showAdvanced">
        <div class="flex items-start gap-3">
          <div class="section-icon">
            <SlidersHorizontal :size="19" />
          </div>

          <div>
            <h2 class="text-base font-extrabold text-slate-900">Fotos, alérgenos y más</h2>

            <p class="mt-1 text-xs leading-relaxed text-slate-500">
              Personaliza los detalles si lo necesitas.
            </p>
          </div>
        </div>

        <ChevronUp v-if="showAdvanced" :size="20" class="shrink-0 text-slate-400" />

        <ChevronDown v-else :size="20" class="shrink-0 text-slate-400" />
      </button>

      <div v-if="showAdvanced || unifiedSite" id="advanced-menu-options" class="space-y-6 border-t border-slate-100 p-5">
        <!-- DISEÑO DE PRODUCTOS -->

        <div v-if="!unifiedSite">
          <div class="mb-3 flex items-center gap-2">
            <LayoutTemplate :size="18" class="text-emerald-600" />

            <h3 class="text-sm font-extrabold text-slate-900">Cómo mostrar los productos</h3>
          </div>

          <div class="space-y-2">
            <button
              v-for="style in productStyles"
              :key="style.id"
              type="button"
              class="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition"
              :class="
                theme.layout.productStyle === style.id
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 hover:border-slate-300'
              "
              :aria-pressed="theme.layout.productStyle === style.id"
              @click="setProductStyle(style.id)">
              <div>
                <p class="text-sm font-bold text-slate-900">
                  {{ style.name }}
                </p>

                <p class="mt-0.5 text-xs text-slate-500">
                  {{ style.description }}
                </p>
              </div>

              <div
                v-if="theme.layout.productStyle === style.id"
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check :size="14" />
              </div>
            </button>
          </div>
        </div>

        <div class="border-t border-slate-100" />

        <!-- ELEMENTOS VISIBLES -->

        <div>
          <h3 class="mb-4 text-sm font-extrabold text-slate-900">Qué mostrar en la carta</h3>

          <div class="space-y-4">
            <label class="editor-toggle">
              <span>
                <span class="block font-semibold"> Fotografías </span>

                <span class="mt-0.5 block text-xs text-slate-500"> Imágenes de los platos </span>
              </span>

              <input
                type="checkbox"
                :checked="theme.layout.showImages"
                @change="setLayoutBoolean('showImages', ($event.target as HTMLInputElement).checked)" />
            </label>

            <label class="editor-toggle">
              <span>
                <span class="block font-semibold"> Descripciones </span>

                <span class="mt-0.5 block text-xs text-slate-500"> Información de cada plato </span>
              </span>

              <input
                type="checkbox"
                :checked="theme.layout.showDescriptions"
                @change="setLayoutBoolean('showDescriptions', ($event.target as HTMLInputElement).checked)" />
            </label>

            <label class="editor-toggle">
              <span>
                <span class="block font-semibold"> Alérgenos </span>

                <span class="mt-0.5 block text-xs text-slate-500"> Información alimentaria </span>
              </span>

              <input
                type="checkbox"
                :checked="theme.layout.showAllergens"
                @change="setLayoutBoolean('showAllergens', ($event.target as HTMLInputElement).checked)" />
            </label>
          </div>

          <div
            v-if="!theme.layout.showAllergens"
            class="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            <Info :size="16" class="shrink-0" />

            <p>
              Comprueba las obligaciones de información alimentaria aplicables a tu restaurante antes de
              ocultar los alérgenos.
            </p>
          </div>
        </div>

        <div class="border-t border-slate-100" />

        <!-- TIPOGRAFÍA -->

        <div v-if="!unifiedSite">
          <div class="mb-4 flex items-center gap-2">
            <Type :size="18" class="text-emerald-600" />

            <h3 class="text-sm font-extrabold text-slate-900">Tipografía</h3>
          </div>

          <div class="space-y-4">
            <div>
              <label for="heading-font" class="mb-2 block text-xs font-semibold text-slate-700">
                Fuente de los títulos
              </label>

              <select
                id="heading-font"
                :value="theme.typography.heading"
                class="editor-input"
                @change="setHeadingFont(($event.target as HTMLSelectElement).value)">
                <option v-for="font in headingFonts" :key="font" :value="font">
                  {{ font }}
                </option>
              </select>
            </div>

            <div>
              <label for="body-font" class="mb-2 block text-xs font-semibold text-slate-700">
                Fuente del contenido
              </label>

              <select
                id="body-font"
                :value="theme.typography.body"
                class="editor-input"
                @change="setBodyFont(($event.target as HTMLSelectElement).value)">
                <option v-for="font in bodyFonts" :key="font" :value="font">
                  {{ font }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="border-t border-slate-100" />

        <!-- BORDES -->

        <div v-if="!unifiedSite">
          <label
            for="border-radius"
            class="mb-3 flex items-center justify-between gap-3 text-sm font-semibold text-slate-800">
            <span>Redondeo de las esquinas</span>

            <span class="text-xs text-slate-500"> {{ theme.layout.borderRadius }} px </span>
          </label>

          <input
            id="border-radius"
            type="range"
            min="0"
            max="32"
            step="2"
            :value="theme.layout.borderRadius"
            class="w-full accent-emerald-600"
            @input="setBorderRadius(($event.target as HTMLInputElement).value)" />
        </div>

        <div class="border-t border-slate-100" />

        <!-- COLORES AVANZADOS -->

        <div v-if="!unifiedSite">
          <h3 class="mb-2 text-sm font-extrabold text-slate-900">Colores adicionales</h3>

          <p class="mb-4 text-xs leading-relaxed text-slate-500">
            Solo necesitas cambiarlos si quieres personalizar aún más el diseño.
          </p>

          <div class="space-y-3">
            <div
              v-for="field in advancedColors"
              :key="field.key"
              class="flex items-center justify-between gap-3">
              <label :for="`advanced-color-${field.key}`" class="text-xs font-medium text-slate-700">
                {{ field.label }}
              </label>

              <div class="flex items-center gap-2">
                <span class="font-mono text-[11px] text-slate-400">
                  {{ theme.colors[field.key] }}
                </span>

                <input
                  :id="`advanced-color-${field.key}`"
                  type="color"
                  :value="theme.colors[field.key]"
                  class="h-9 w-11 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                  @input="setColor(field.key, ($event.target as HTMLInputElement).value)" />
              </div>
            </div>
          </div>
        </div>

        <!-- RESTAURAR APARIENCIA -->

        <button v-if="!unifiedSite"
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
          @click="resetTemplateAppearance">
          <RotateCcw :size="15" />
          Recuperar los ajustes del estilo elegido
        </button>

        <p class="text-center text-xs text-slate-400">
          Esta acción conserva tu portada y mensaje. Guarda el borrador para conservar los cambios.
        </p>
      </div>
    </section>

    <!-- ======================================
         AYUDA FINAL
    ======================================= -->

    <div class="flex items-start gap-3 rounded-xl bg-slate-100 p-4">
      <Info :size="18" class="mt-0.5 shrink-0 text-slate-500" />

      <p class="text-xs leading-relaxed text-slate-600">
        <strong>¿Ya te gusta cómo queda?</strong>
        Comprueba la vista previa y utiliza el botón de publicar para aplicar el diseño.
      </p>
    </div>
  </div>
</template>

<style scoped>
.editor-section {
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: white;
  padding: 20px;
}

.section-icon {
  display: flex;
  height: 40px;
  width: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--ui-radius);
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.step-number {
  display: inline-flex;
  height: 22px;
  width: 22px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ui-accent);
  color: white;
  font-size: 11px;
  font-weight: 650;
}

.editor-input {
  width: 100%;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: white;
  padding: 11px 13px;
  font-size: 14px;
  color: var(--ui-text);
  outline: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.editor-input:focus {
  border-color: var(--ui-accent);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.editor-toggle {
  display: flex;
  cursor: pointer;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  color: var(--ui-secondary-text);
}

.editor-toggle input {
  height: 19px;
  width: 19px;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: var(--ui-accent);
}

.template-option:focus-visible,
button:focus-visible {
  outline: 3px solid var(--ui-accent);
  outline-offset: 3px;
}

@media (max-width: 380px) {
  .editor-section {
    padding: 16px;
  }
}
.editor-section{border-radius:var(--ui-radius-lg);box-shadow:var(--ui-shadow)}.template-option{border-width:1px;border-radius:var(--ui-radius)!important;box-shadow:none!important}.template-option[aria-pressed=true]{box-shadow:0 0 0 1px var(--ui-accent)!important}.editor-section h2{font-size:16px}.section-icon{height:35px;width:35px;border-radius:9px}.step-number{height:19px;width:19px;font-size:10px}.editor-section>div:first-child{align-items:center}.editor-input{border-radius:var(--ui-radius-sm)}
</style>
