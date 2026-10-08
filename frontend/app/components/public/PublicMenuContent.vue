<script setup lang="ts">
import type { PublicMenuResponse } from "~/types/publicSite";
const props = defineProps<{ data: PublicMenuResponse; language: string; embedded?: boolean }>();
const emit = defineEmits<{ language: [code: string] }>();
import { localizePublicMenu, PUBLIC_MENU_COPY } from "~/utils/publicMenuLanguages";
const localized = computed(() => localizePublicMenu(props.data.categories, props.data.theme, props.data.languages, props.language, props.data.menu.id));
const copy = computed(() => PUBLIC_MENU_COPY[props.language] ?? PUBLIC_MENU_COPY.es!);
</script>
<template>
  <MenuEditorMenuLivePreview :theme="localized.theme" :restaurant-name="data.business.name" :logo-url="data.business.logo_url" :categories="localized.categories" :language="language" :embedded="embedded" public-view>
    <template #languages>
      <nav v-if="(data.languages?.available.length ?? 0) > 1" class="language-selector" :aria-label="copy.language">
        <button v-for="l in data.languages?.available" :key="l.code" type="button" :lang="l.html_lang" :aria-pressed="language === l.code" @click="emit('language', l.code)">{{ l.native_name }}</button>
      </nav>
    </template>
  </MenuEditorMenuLivePreview>
</template>
<style scoped>
.language-selector { display:flex;flex-wrap:wrap;justify-content:center;gap:4px;padding:8px 12px 18px; }
button { min-height:44px;padding:8px 12px;border:1px solid transparent;border-radius:8px;color:var(--menu-text);background:transparent;font:inherit;cursor:pointer; }
button[aria-pressed="true"] { border-color:var(--menu-primary);font-weight:600; }
</style>
