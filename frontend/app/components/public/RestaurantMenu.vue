<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next';
import type { PublicMenuResponse } from '~/types/publicSite';
import { localizePublicMenu, PUBLIC_MENU_COPY } from '~/utils/publicMenuLanguages';
const props = defineProps<{ data: PublicMenuResponse; language: string; preview?: boolean }>();
const localized = computed(() => localizePublicMenu(props.data.categories, props.data.theme, props.data.languages, props.language, props.data.menu.id));
const copy = computed(() => PUBLIC_MENU_COPY[props.language] ?? PUBLIC_MENU_COPY.es!);
const active = ref('');
const root = ref<HTMLElement>();
let observer: IntersectionObserver | undefined;
function categoryId(id: string) { return `dish-category-${id}`; }
function observe() {
  observer?.disconnect();
  active.value = localized.value.categories[0]?.id ?? '';
  if (!root.value || props.preview) return;
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) active.value = (entry.target as HTMLElement).dataset.category ?? '';
  }, { rootMargin: '-8% 0px -65% 0px', threshold: 0 });
  root.value.querySelectorAll('[data-category]').forEach(el => observer?.observe(el));
}
function select(id: string, event: MouseEvent) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  active.value = id;
  root.value?.querySelector(`[id="${CSS.escape(categoryId(id))}"]`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}
watch(active, id => nextTick(() => {
  const rail = root.value?.querySelector('.category-rail');
  const link = rail?.querySelector('[aria-current]') as HTMLElement | null;
  if (!rail || !link) return;
  const left = link.offsetLeft - (rail as HTMLElement).offsetLeft;
  if (left < rail.scrollLeft || left + link.offsetWidth > rail.scrollLeft + rail.clientWidth) rail.scrollTo({ left: Math.max(0, left - 16), behavior: 'auto' });
}));
onMounted(observe);
watch(() => props.data.menu.id, () => nextTick(observe));
onBeforeUnmount(() => observer?.disconnect());
</script>
<template>
  <div ref="root" class="restaurant-menu-content">
    <p v-if="localized.menuText?.description || data.menu.description" class="menu-intro">{{ localized.menuText?.description || data.menu.description }}</p>
    <p v-if="localized.theme.branding.welcomeText" class="menu-intro">{{ localized.theme.branding.welcomeText }}</p>
    <nav v-if="localized.categories.length > 1" class="category-rail" :aria-label="copy.categories">
      <a v-for="category in localized.categories" :key="category.id" :href="`#${categoryId(category.id)}`" :aria-current="active === category.id ? 'location' : undefined" @click="select(category.id, $event)">{{ category.name }}</a>
    </nav>
    <div v-if="!localized.categories.length" class="restaurant-empty"><BookOpen :size="28" aria-hidden="true" /><h3>{{ copy.preparing }}</h3><p>{{ copy.empty }}</p></div>
    <div class="menu-categories">
      <section v-for="(category, index) in localized.categories" :id="categoryId(category.id)" :key="`${data.menu.id}-${category.id}`" :data-category="category.id" class="dish-category" :aria-labelledby="`heading-${categoryId(category.id)}`">
        <header class="dish-category-heading"><span class="category-number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span><h3 :id="`heading-${categoryId(category.id)}`">{{ category.name }}</h3><span class="dish-count">{{ category.products.length }} {{ category.products.length === 1 ? copy.dish : copy.dishes }}</span></header>
        <div v-if="category.products.length" class="dish-grid"><PublicRestaurantProduct v-for="product in category.products" :key="product.id" :product="product" :layout="localized.theme.layout" :language="language" :allergen-label="copy.allergens!" /></div>
        <p v-else class="category-empty">{{ copy.emptyCategory }}</p>
      </section>
    </div>
  </div>
</template>
