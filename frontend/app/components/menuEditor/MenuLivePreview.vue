<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { UtensilsCrossed, ImageOff, ChevronRight, BookOpen, Leaf } from "lucide-vue-next";

import type { MenuTheme, PreviewCategory } from "~/types/menuTheme";
import { PUBLIC_MENU_COPY } from "~/utils/publicMenuLanguages";

// ==========================================
// PROPIEDADES
// ==========================================

const props = defineProps<{
  theme: MenuTheme;
  restaurantName: string;
  logoUrl?: string | null;
  categories?: PreviewCategory[];
  publicView?: boolean;
  language?: string;
  embedded?: boolean;
}>();
const copy = computed(() => PUBLIC_MENU_COPY[props.language ?? "es"] ?? PUBLIC_MENU_COPY.es!);

// ==========================================
// DATOS DE DEMOSTRACIÓN
// ==========================================

// Solo se utilizan cuando categories no se
// proporciona.
//
// Si categories es [], se muestra una
// carta vacía, nunca productos ficticios.

const demoCategories: PreviewCategory[] = [
  {
    id: "demo-1",
    name: "Entrantes",
    products: [
      {
        id: "demo-p1",
        name: "Ensalada mediterránea",
        description: "Tomate fresco, queso, aceitunas y aceite de oliva.",
        price: 9.5,
        image_url: null,
        allergens: ["Leche"],
      },
      {
        id: "demo-p2",
        name: "Croquetas caseras",
        description: "Croquetas cremosas elaboradas en nuestra cocina.",
        price: 8.9,
        image_url: null,
        allergens: ["Gluten", "Leche"],
      },
    ],
  },
  {
    id: "demo-2",
    name: "Platos principales",
    products: [
      {
        id: "demo-p3",
        name: "Arroz de la casa",
        description: "Arroz tradicional preparado con ingredientes frescos.",
        price: 16.5,
        image_url: null,
        allergens: [],
      },
      {
        id: "demo-p4",
        name: "Hamburguesa especial",
        description: "Carne a la parrilla, queso y salsa de la casa.",
        price: 13.9,
        image_url: null,
        allergens: ["Gluten", "Leche"],
      },
    ],
  },
  {
    id: "demo-3",
    name: "Postres",
    products: [
      {
        id: "demo-p5",
        name: "Tarta de queso",
        description: "Nuestra tarta de queso cremosa y casera.",
        price: 5.5,
        image_url: null,
        allergens: ["Leche", "Huevos", "Gluten"],
      },
    ],
  },
];

// ==========================================
// CATEGORÍAS
// ==========================================

const displayCategories = computed<PreviewCategory[]>(() =>
  props.categories !== undefined ? props.categories : demoCategories,
);

const activeCategoryId = ref("");

watch(
  displayCategories,
  (categories) => {
    const exists = categories.some((category) => category.id === activeCategoryId.value);

    if (!exists) {
      activeCategoryId.value = categories[0]?.id ?? "";
    }
  },
  { immediate: true },
);

const currentCategory = computed(() =>
  displayCategories.value.find((category) => category.id === activeCategoryId.value),
);

const totalProducts = computed(() =>
  displayCategories.value.reduce((total, category) => total + category.products.length, 0),
);

// ==========================================
// CONFIGURACIÓN VISUAL
// ==========================================

const template = computed(() => props.theme.template);

const isCards = computed(() => props.theme.layout.productStyle === "cards");

const isList = computed(() => props.theme.layout.productStyle === "list");

const isCompact = computed(() => props.theme.layout.productStyle === "compact");

// ==========================================
// VARIABLES CSS
// ==========================================

// Pick a readable foreground without changing the restaurant's selected colour.
const onPrimary = computed(() => {
  const hex = props.theme.colors.primary.slice(1);
  const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const luminance = .2126 * (linear[0] ?? 0) + .7152 * (linear[1] ?? 0) + .0722 * (linear[2] ?? 0);
  return luminance > .179 ? "#111827" : "#ffffff";
});

const themeStyles = computed(() => ({
  "--menu-primary": props.theme.colors.primary,
  "--menu-on-primary": onPrimary.value,

  "--menu-secondary": props.theme.colors.secondary,

  "--menu-background": props.theme.colors.background,

  "--menu-surface": props.theme.colors.surface,

  "--menu-text": props.theme.colors.text,

  "--menu-muted": props.theme.colors.muted,

  "--menu-radius": `${props.theme.layout.borderRadius}px`,

  "--menu-heading": `"${props.theme.typography.heading}", sans-serif`,

  "--menu-body": `"${props.theme.typography.body}", sans-serif`,
}));

// ==========================================
// UTILIDADES
// ==========================================

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

function money(price: number | string): string {
  const value = Number(price);

  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function selectCategory(categoryId: string) {
  activeCategoryId.value = categoryId;
}

function categoryProductLabel(count: number) {
  return `${count} ${count === 1 ? copy.value.dish : copy.value.dishes}`;
}

// ==========================================
// ERRORES DE IMÁGENES
// ==========================================

// Evitamos mostrar imágenes rotas.
// La clave incluye la URL para que una
// fotografía nueva pueda volver a cargarse.

const failedImages = ref<Set<string>>(new Set());

function imageKey(id: string, url: string | null) {
  return `${id}:${url ?? ""}`;
}

function markImageFailed(id: string, url: string | null) {
  const next = new Set(failedImages.value);

  next.add(imageKey(id, url));

  failedImages.value = next;
}

function canShowImage(id: string, url: string | null) {
  return Boolean(url) && !failedImages.value.has(imageKey(id, url));
}
</script>

<template>
  <div
    class="menu-preview"
    :class="[
      `template-${theme.template}`,
      {
        'public-menu': publicView,
        'layout-cards': isCards,
        'layout-list': isList,
        'layout-compact': isCompact,
      },
    ]"
    :style="themeStyles">
    <!-- =====================================
         PORTADA
    ====================================== -->

    <div v-if="theme.branding.coverUrl && !embedded" class="cover">
      <img :src="theme.branding.coverUrl" :alt="copy.cover" class="cover-image" />

      <div class="cover-overlay" />

      <div class="cover-bottom">
        <span class="cover-label">
          <UtensilsCrossed :size="12" />
          {{ copy.welcome }}
        </span>
      </div>
    </div>

    <!-- =====================================
         CABECERA DEL RESTAURANTE
    ====================================== -->

    <header
      v-if="!embedded"
      class="restaurant-header"
      :class="{
        'has-cover': Boolean(theme.branding.coverUrl),
      }">
      <!-- LOGOTIPO -->

      <div v-if="logoUrl" class="restaurant-logo">
        <img :src="logoUrl" :alt="copy.logo" class="restaurant-logo-image" />
      </div>

      <!-- ICONO SI NO HAY LOGOTIPO -->

      <div v-else class="restaurant-icon">
        <UtensilsCrossed :size="27" />
      </div>

      <!-- ETIQUETA -->

      <div class="restaurant-eyebrow">
        <span class="eyebrow-line" />

        <span>{{ copy.menu }}</span>

        <span class="eyebrow-line" />
      </div>

      <!-- NOMBRE -->

      <h1 class="restaurant-name">
        {{ restaurantName || "Mi restaurante" }}
      </h1>

      <!-- BIENVENIDA -->

      <p v-if="theme.branding.welcomeText" class="restaurant-welcome">
        {{ theme.branding.welcomeText }}
      </p>

      <!-- DECORACIÓN -->

      <div class="header-decoration">
        <span />
        <span />
        <span />
      </div>
    </header>
    <p v-if="embedded && theme.branding.welcomeText" class="restaurant-welcome">{{ theme.branding.welcomeText }}</p>
    <slot name="languages" />

    <!-- =====================================
         NAVEGACIÓN DE CATEGORÍAS
    ====================================== -->

    <div v-if="displayCategories.length" class="categories-wrapper">
      <nav class="categories-nav" :aria-label="copy.categories">
        <button
          v-for="category in displayCategories"
          :key="category.id"
          type="button"
          class="category-button"
          :class="{
            active: activeCategoryId === category.id,
          }"
          :aria-pressed="activeCategoryId === category.id"
          aria-controls="menu-category-content"
          @click="selectCategory(category.id)">
          {{ category.name }}
        </button>
      </nav>
    </div>

    <!-- =====================================
         CONTENIDO DE LA CARTA
    ====================================== -->

    <div id="menu-category-content" class="menu-content">
      <!-- ===================================
           CARTA SIN CATEGORÍAS
      ==================================== -->

      <div v-if="displayCategories.length === 0" class="empty-state">
        <div class="empty-icon">
          <BookOpen :size="30" />
        </div>

        <h2>{{ publicView ? copy.preparing : "Tu carta está esperando" }}</h2>

        <p>{{ publicView ? copy.empty : "Añade tus primeras categorías y productos para empezar a mostrar tu carta." }}</p>

        <div class="empty-decoration">
          <span />
          <span />
          <span />
        </div>
      </div>

      <!-- ===================================
           CATEGORÍA SELECCIONADA
      ==================================== -->

      <template v-else-if="currentCategory">
        <!-- CABECERA CATEGORÍA -->

        <div class="category-heading" :key="currentCategory.id">
          <div class="category-heading-top">
            <span class="category-overline">{{ copy.discover }}</span>

            <span class="category-count">
              {{ categoryProductLabel(currentCategory.products.length) }}
            </span>
          </div>

          <h2 class="category-title">
            {{ currentCategory.name }}
          </h2>

          <div class="category-underline" />
        </div>

        <!-- =================================
             PRODUCTOS
        ================================== -->

        <div
          v-if="currentCategory.products.length"
          class="products"
          :class="{
            'products-cards': isCards,
            'products-list': isList,
            'products-compact': isCompact,
          }">
          <article v-for="product in currentCategory.products" :key="product.id" class="product">
            <!-- =============================
                 IMAGEN
            ============================== -->

            <div v-if="theme.layout.showImages && product.image_url" class="product-image">
              <img
                v-if="canShowImage(product.id, product.image_url)"
                :src="product.image_url!"
                :alt="product.name"
                loading="lazy"
                decoding="async"
                @error="markImageFailed(product.id, product.image_url)" />

              <div v-else class="product-image-placeholder">
                <ImageOff :size="23" />
              </div>
            </div>

            <!-- =============================
                 INFORMACIÓN
            ============================== -->

            <div class="product-information">
              <!-- NOMBRE Y PRECIO -->

              <div class="product-title-row">
                <h3 class="product-name">
                  {{ product.name }}
                </h3>

                <span class="product-price">
                  {{ money(product.price) }}
                </span>
              </div>

              <!-- DESCRIPCIÓN -->

              <p v-if="theme.layout.showDescriptions && product.description" class="product-description">
                {{ product.description }}
              </p>

              <!-- ALÉRGENOS -->

              <div
                v-if="theme.layout.showAllergens && product.allergens.length"
                class="allergens"
                :aria-label="copy.allergens + ': ' + product.allergens.join(', ')">
                <span v-for="allergen in product.allergens" :key="allergen" class="allergen">
                  {{ allergen }}
                </span>
              </div>
            </div>
          </article>
        </div>

        <!-- =================================
             CATEGORÍA VACÍA
        ================================== -->

        <div v-else class="empty-state category-empty">
          <div class="empty-icon">
            <UtensilsCrossed :size="27" />
          </div>

          <h3>{{ copy.soon }}</h3>

          <p>{{ copy.emptyCategory }}</p>
        </div>

        <!-- =================================
             CAMBIAR CATEGORÍA
        ================================== -->

        <div v-if="displayCategories.length > 1" class="category-bottom">
          <span>{{ copy.explore }}</span>

          <div class="category-bottom-links">
            <button
              v-for="category in displayCategories.filter((item) => item.id !== activeCategoryId)"
              :key="category.id"
              type="button"
              @click="selectCategory(category.id)">
              {{ category.name }}

              <ChevronRight :size="13" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- =====================================
         PIE DE CARTA
    ====================================== -->

    <footer v-if="!embedded" class="menu-footer">
      <div class="footer-decoration">
        <Leaf :size="16" />
      </div>

      <p class="footer-restaurant">
        {{ restaurantName || "Mi restaurante" }}
      </p>

      <p v-if="totalProducts > 0" class="footer-message">{{ copy.thanks }}</p>

      <div class="footer-divider" />

      <p class="footer-brand">
        {{ copy.created }}
        <strong>Carteliax</strong>
      </p>
    </footer>
  </div>
</template>

<style scoped>
/* ==========================================
   BASE Y VARIABLES
========================================== */

.menu-preview {
  container-type: inline-size;

  width: 100%;
  min-height: 100%;

  overflow: hidden;

  background: var(--menu-background);

  color: var(--menu-text);

  font-family: var(--menu-body);

  font-size: 14px;

  transition:
    background-color 180ms ease,
    color 180ms ease;
}

.menu-preview * {
  box-sizing: border-box;
}

.menu-preview button {
  cursor: pointer;
}

.menu-preview button:focus-visible {
  outline: 2px solid var(--menu-primary);

  outline-offset: 3px;
}

/* ==========================================
   PORTADA
========================================== */

.cover {
  position: relative;

  width: 100%;
  height: 170px;

  overflow: hidden;
}

.cover-image {
  width: 100%;
  height: 100%;

  object-fit: cover;
}

.cover-overlay {
  position: absolute;
  inset: 0;

  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.4));
}

.cover-bottom {
  position: absolute;

  right: 20px;
  bottom: 17px;
  left: 20px;

  display: flex;
  justify-content: center;
}

.cover-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;

  padding: 8px 13px;

  border: 1px solid rgba(255, 255, 255, 0.35);

  border-radius: 100px;

  background: rgba(0, 0, 0, 0.25);

  color: white;

  font-size: 10px;
  font-weight: 600;

  letter-spacing: 0.08em;


}

/* ==========================================
   CABECERA
========================================== */

.restaurant-header {
  position: relative;

  padding: 36px 20px 31px;

  text-align: center;
}

.restaurant-header.has-cover {
  padding-top: 22px;
}

.restaurant-logo {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 76px;
  height: 76px;

  margin: 0 auto 18px;

  overflow: hidden;

  border: 3px solid var(--menu-surface);

  border-radius: 50%;

  background: var(--menu-surface);

  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.07);
}

.restaurant-logo-image {
  width: 100%;
  height: 100%;

  object-fit: contain;
}

.restaurant-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 66px;
  height: 66px;

  margin: 0 auto 19px;

  border-radius: var(--menu-radius);

  background: var(--menu-secondary);

  color: var(--menu-primary);
}

.restaurant-eyebrow {
  display: flex;

  align-items: center;
  justify-content: center;

  gap: 10px;

  margin-bottom: 11px;

  color: var(--menu-primary);

  font-size: 10px;
  font-weight: 700;

  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.eyebrow-line {
  width: 19px;
  height: 1px;

  background: var(--menu-primary);

  opacity: 0.5;
}

.restaurant-name {
  max-width: 560px;

  margin: 0 auto;

  font-family: var(--menu-heading);

  font-size: 29px;
  font-weight: 800;

  line-height: 1.18;

  overflow-wrap: anywhere;
}

.restaurant-welcome {
  max-width: 390px;

  margin: 13px auto 0;

  color: var(--menu-muted);

  font-size: 12px;

  line-height: 1.8;

  overflow-wrap: anywhere;
}

.header-decoration {
  display: flex;

  align-items: center;
  justify-content: center;

  gap: 5px;

  margin-top: 23px;
}

.header-decoration span {
  height: 3px;

  border-radius: 10px;

  background: var(--menu-primary);
}

.header-decoration span:nth-child(1),
.header-decoration span:nth-child(3) {
  width: 5px;
  opacity: 0.35;
}

.header-decoration span:nth-child(2) {
  width: 25px;
}

/* ==========================================
   CATEGORÍAS
========================================== */

.public-menu .categories-wrapper {
  position: sticky;
  top: 0;
  z-index: 10;
  padding-top: 8px;
  background: var(--menu-background);
}

.categories-wrapper {
  padding: 0 16px 18px;
}

.categories-nav {
  display: flex;

  gap: 8px;

  overflow-x: auto;

  padding: 4px 1px 8px;

  scrollbar-width: none;
}

.categories-nav::-webkit-scrollbar {
  display: none;
}

.category-button {
  flex-shrink: 0;

  min-height: 44px;

  padding: 10px 16px;

  border: 1px solid transparent;

  border-radius: var(--menu-radius);

  background: var(--menu-surface);

  color: var(--menu-text);

  font-family: var(--menu-body);

  font-size: 13px;
  font-weight: 600;

  white-space: nowrap;

  transition:
    background-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.category-button:hover {
  transform: translateY(-1px);
}

.category-button.active {
  background: var(--menu-primary);

  color: var(--menu-on-primary);
}

/* ==========================================
   CONTENIDO
========================================== */

.menu-content {
  min-height: 230px;

  padding: 12px 16px 35px;
}

.category-heading {
  margin-bottom: 22px;
}

.category-heading-top {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 12px;

  margin-bottom: 8px;
}

.category-overline {
  color: var(--menu-primary);

  font-size: 9px;
  font-weight: 800;

  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.category-count {
  flex-shrink: 0;

  color: var(--menu-muted);

  font-size: 10px;
}

.category-title {
  margin: 0;

  font-family: var(--menu-heading);

  font-size: 23px;
  font-weight: 800;

  line-height: 1.25;

  overflow-wrap: anywhere;
}

.category-underline {
  width: 34px;
  height: 3px;

  margin-top: 12px;

  border-radius: 10px;

  background: var(--menu-primary);
}

/* ==========================================
   PRODUCTOS: BASE
========================================== */

.products {
  display: flex;

  flex-direction: column;

  gap: 13px;
}

.product {
  min-width: 0;

  overflow: hidden;

  background: var(--menu-surface);

  border-radius: var(--menu-radius);
}

.product-image {
  position: relative;

  flex-shrink: 0;

  overflow: hidden;

  background: var(--menu-secondary);
}

.product-image img {
  display: block;

  width: 100%;
  height: 100%;

  object-fit: cover;
}

.product-image-placeholder {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 100%;
  height: 100%;

  min-height: 60px;

  color: var(--menu-primary);

  opacity: 0.55;
}

.product-information {
  min-width: 0;
  flex: 1;

  padding: 14px;
}

.product-title-row {
  display: flex;

  align-items: flex-start;
  justify-content: space-between;

  flex-wrap: wrap;

  gap: 5px 10px;
}

.product-name {
  min-width: 0;
  flex: 1;

  margin: 0;

  font-family: var(--menu-heading);

  font-size: 16px;
  font-weight: 700;

  line-height: 1.45;

  overflow-wrap: anywhere;
}

.product-price {
  flex-shrink: 0;

  color: var(--menu-primary);

  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;

  white-space: nowrap;
}

.product-description {
  margin-top: 8px;

  color: var(--menu-muted);

  font-size: 14px;

  line-height: 1.65;

  overflow-wrap: anywhere;
}

/* ==========================================
   ALÉRGENOS
========================================== */

.allergens {
  display: flex;

  flex-wrap: wrap;

  gap: 5px;

  margin-top: 12px;
}

.allergen {
  display: inline-flex;

  align-items: center;

  padding: 5px 8px;

  border: 1px solid var(--menu-secondary);

  border-radius: 6px;

  background: var(--menu-background);

  color: var(--menu-muted);

  font-size: 11px;
  font-weight: 500;

  line-height: 1.3;
}

/* ==========================================
   ESTILO TARJETAS
========================================== */

.products-cards {
  display: grid;

  grid-template-columns: minmax(0, 1fr);

  gap: 13px;
}

.products-cards .product {
  display: flex;

  flex-direction: column;
}

.products-cards .product-image {
  width: 100%;
  height: 155px;
}

.products-cards .product-information {
  display: flex;

  flex-direction: column;
}

.products-cards .allergens {
  margin-top: 12px;
}

/* ==========================================
   ESTILO LISTA
========================================== */

.products-list .product {
  display: flex;

  align-items: stretch;

  gap: 0;
}

.products-list .product-image {
  width: 100px;
  min-height: 105px;
}

.products-list .product-information {
  align-self: center;

  padding: 12px;
}

/* ==========================================
   ESTILO COMPACTO
========================================== */

.products-compact {
  gap: 9px;
}

.products-compact .product {
  display: flex;

  align-items: center;
}

.products-compact .product-image {
  width: 67px;
  height: 67px;

  margin-left: 9px;

  border-radius: max(4px, calc(var(--menu-radius) * 0.65));
}

.products-compact .product-information {
  padding: 10px 12px;
}

.products-compact .product-name {
  font-size: 14px;
}

.products-compact .product-price {
  font-size: 14px;
}

.products-compact .product-description {
  margin-top: 4px;

  font-size: 13px;
}

.products-compact .allergens {
  margin-top: 7px;
}

/* ==========================================
   CAMBIO DE CATEGORÍA
========================================== */

.category-bottom {
  margin-top: 34px;

  padding-top: 20px;

  border-top: 1px solid var(--menu-secondary);
}

.category-bottom > span {
  display: block;

  margin-bottom: 12px;

  color: var(--menu-muted);

  font-size: 10px;
  font-weight: 600;
}

.category-bottom-links {
  display: flex;

  flex-wrap: wrap;

  gap: 8px;
}

.category-bottom-links button {
  min-height: 44px;
  max-width: 100%;
  overflow-wrap: anywhere;
  display: inline-flex;

  align-items: center;

  gap: 4px;

  padding: 8px 10px;

  border: 1px solid var(--menu-secondary);

  border-radius: var(--menu-radius);

  background: var(--menu-surface);

  color: var(--menu-primary);

  font-size: 10px;
  font-weight: 700;

  transition: transform 160ms ease;
}

.category-bottom-links button:hover {
  transform: translateY(-2px);
}

/* ==========================================
   ESTADOS VACÍOS
========================================== */

.empty-state {
  display: flex;

  flex-direction: column;

  align-items: center;
  justify-content: center;

  min-height: 250px;

  padding: 30px 15px;

  text-align: center;
}

.empty-icon {
  display: flex;

  align-items: center;
  justify-content: center;

  width: 70px;
  height: 70px;

  margin-bottom: 20px;

  border-radius: var(--menu-radius);

  background: var(--menu-secondary);

  color: var(--menu-primary);
}

.empty-state h2,
.empty-state h3 {
  margin: 0;

  font-family: var(--menu-heading);

  font-size: 20px;
  font-weight: 800;
}

.empty-state p {
  max-width: 260px;

  margin-top: 10px;

  color: var(--menu-muted);

  font-size: 12px;

  line-height: 1.8;
}

.empty-decoration {
  display: flex;

  gap: 5px;

  margin-top: 23px;
}

.empty-decoration span {
  width: 5px;
  height: 5px;

  border-radius: 50%;

  background: var(--menu-primary);

  opacity: 0.4;
}

/* ==========================================
   PIE
========================================== */

.menu-footer {
  padding: 29px 18px 25px;

  border-top: 1px solid var(--menu-secondary);

  text-align: center;
}

.footer-decoration {
  display: flex;

  justify-content: center;

  margin-bottom: 11px;

  color: var(--menu-primary);
}

.footer-restaurant {
  font-family: var(--menu-heading);

  font-size: 14px;
  font-weight: 800;
}

.footer-message {
  margin-top: 7px;

  color: var(--menu-muted);

  font-size: 11px;
}

.footer-divider {
  width: 28px;
  height: 2px;

  margin: 21px auto 14px;

  background: var(--menu-primary);

  opacity: 0.4;
}

.footer-brand {
  color: var(--menu-muted);

  font-size: 9px;
}

.footer-brand strong {
  color: var(--menu-primary);

  font-weight: 800;
}

/* ==========================================
   PLANTILLA MODERNA
========================================== */

.template-modern .product {
  box-shadow: 0 3px 14px rgba(0, 0, 0, 0.035);
}

.template-modern .category-button.active {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* ==========================================
   PLANTILLA MINIMALISTA
========================================== */

.template-minimal .restaurant-icon {
  background: transparent;

  border: 1px solid var(--menu-primary);
}

.template-minimal .restaurant-name {
  letter-spacing: -0.035em;
}

.template-minimal .product {
  border: 1px solid var(--menu-secondary);

  box-shadow: none;
}

.template-minimal .category-button {
  background: transparent;

  border: 1px solid var(--menu-secondary);
}

.template-minimal .category-button.active {
  background: var(--menu-primary);

  border-color: var(--menu-primary);
}

.template-minimal .header-decoration span:first-child,
.template-minimal .header-decoration span:last-child {
  display: none;
}

/* ==========================================
   PLANTILLA PREMIUM
========================================== */

.template-premium .restaurant-header {
  padding-top: 42px;
  padding-bottom: 39px;
}

.template-premium .restaurant-name {
  font-size: 31px;
  font-weight: 600;

  letter-spacing: 0.015em;
}

.template-premium .restaurant-eyebrow {
  letter-spacing: 0.25em;
}

.template-premium .category-title {
  font-size: 25px;
  font-weight: 600;
}

.template-premium .product {
  border: 1px solid var(--menu-secondary);
}

.template-premium .product-name {
  font-weight: 600;
}

.template-premium .restaurant-icon {
  border: 1px solid var(--menu-primary);

  background: transparent;
}

.template-premium .category-button {
  border: 1px solid var(--menu-secondary);
}

.template-premium .category-button.active {
  border-color: var(--menu-primary);
}

/* ==========================================
   PLANTILLA MEDITERRÁNEA
========================================== */

.template-mediterranean .restaurant-icon {
  border-radius: 50%;
}

.template-mediterranean .restaurant-name {
  font-weight: 700;
}

.template-mediterranean .product {
  border: 1px solid var(--menu-secondary);
}

.template-mediterranean .category-button {
  border-radius: 100px;
}

.template-mediterranean .category-underline {
  width: 45px;
}

.template-mediterranean .header-decoration span:nth-child(2) {
  width: 35px;
}

/* ==========================================
   RESPONSIVE POR ANCHO DEL COMPONENTE
========================================== */

/*
  Usamos container queries en lugar de
  depender solo del ancho de la ventana.

  Esto permite que la vista móvil del editor
  se comporte como un móvil incluso cuando
  el navegador está en un monitor grande.
*/

@container (min-width: 520px) {
  .restaurant-header {
    padding-top: 48px;
    padding-bottom: 43px;
  }

  .restaurant-name {
    font-size: 37px;
  }

  .restaurant-welcome {
    font-size: 13px;
  }

  .cover {
    height: 230px;
  }

  .categories-wrapper {
    max-width: 1100px;
    margin-inline: auto;
    padding-right: 30px;
    padding-left: 30px;
  }

  .menu-content {
    max-width: 1100px;
    margin-inline: auto;
    padding: 20px 30px 50px;
  }

  .category-title {
    font-size: 29px;
  }

  .products-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    gap: 17px;
  }

  .products-cards .product-image {
    height: 180px;
  }

  .product-name {
    font-size: 16px;
  }

  .product-price {
    font-size: 16px;
  }

  .product-description {
    font-size: 14px;
  }

  .products-list .product-image {
    width: 150px;
    min-height: 140px;
  }

  .products-list .product-information {
    padding: 19px;
  }

  .products-compact .product-image {
    width: 83px;
    height: 83px;
  }

  .template-premium .restaurant-name {
    font-size: 40px;
  }

  .template-premium .category-title {
    font-size: 30px;
  }
}

@container (max-width: 280px) {
  .restaurant-name {
    font-size: 23px;
  }

  .category-title {
    font-size: 20px;
  }

  .product-information {
    padding: 10px;
  }

  .products-list .product-image {
    width: 75px;
  }

  .product-title-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .category-button {
    padding: 9px 12px;
  }
}

/* ==========================================
   ACCESIBILIDAD
========================================== */

@media (prefers-reduced-motion: reduce) {
  .menu-preview,
  .menu-preview button {
    transition: none;
  }
}
</style>
