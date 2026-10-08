<script setup lang="ts">
import { Info } from 'lucide-vue-next';
import type { PreviewProduct, MenuTheme } from '~/types/menuTheme';
const props = defineProps<{ product: PreviewProduct; layout: MenuTheme['layout']; language: string; allergenLabel: string }>();
const price = computed(() => new Intl.NumberFormat(props.language === 'val' ? 'ca-ES' : props.language, { style: 'currency', currency: 'EUR' }).format(props.product.price));
const unavailable = computed(() => props.product.is_available === false);
const soldOut = computed(() => ({ es:'Agotado', val:'Esgotat', en:'Sold out', fr:'Épuisé' }[props.language] ?? 'Agotado'));
</script>
<template>
  <article class="restaurant-product product" :class="{ 'has-image': layout.showImages && product.image_url, unavailable }">
    <PublicRestaurantImage v-if="layout.showImages && product.image_url" class="dish-image product-image" :src="product.image_url" :alt="product.name" :width="240" :height="240" />
    <div class="dish-content">
      <div class="dish-title"><h4 class="product-name">{{ product.name }}</h4><span class="dish-price product-price">{{ price }}</span></div>
      <span v-if="unavailable" class="sold-out">{{ soldOut }}</span>
      <p v-if="layout.showDescriptions && product.description" class="dish-description product-description">{{ product.description }}</p>
      <ul v-if="layout.showAllergens && product.allergens.length" class="dish-allergens allergens" :aria-label="allergenLabel">
        <li v-for="(allergen, index) in product.allergens" :key="index"><Info :size="11" aria-hidden="true" />{{ allergen }}</li>
      </ul>
    </div>
  </article>
</template>
