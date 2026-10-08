import type { PublicMenuResponse } from "~/types/publicSite";
import { DEFAULT_MENU_THEME } from "~/types/menuTheme";
import { localizePublicMenu, matchMenuLanguage, PUBLIC_MENU_COPY } from "~/utils/publicMenuLanguages";
export function usePublicMenuLanguage(data: Ref<PublicMenuResponse | null | undefined>) {
  const route = useRoute();
  const router = useRouter();
  const chosenLanguage = ref("");
  const availableLanguages = computed(() => data.value?.languages?.available ?? []);
  const codes = computed(() => availableLanguages.value.map(l => l.code));
  const sourceLanguage = computed(() => data.value?.languages?.source_language ?? "es");
  const explicitLanguage = computed(() => typeof route.query.lang === "string" ? matchMenuLanguage(route.query.lang, codes.value) : undefined);
  watch(explicitLanguage, code => { if (code) chosenLanguage.value = code; });
  const selectedLanguage = computed(() => matchMenuLanguage(chosenLanguage.value, codes.value) ?? explicitLanguage.value ?? sourceLanguage.value);
  const localized = computed(() => localizePublicMenu(data.value?.categories ?? [], data.value?.theme ?? DEFAULT_MENU_THEME, data.value?.languages, selectedLanguage.value, data.value?.menu.id ?? ""));
  const copy = computed(() => PUBLIC_MENU_COPY[selectedLanguage.value] ?? PUBLIC_MENU_COPY.es!);
  function storageKey() { return `carteliax-language:${data.value?.business.id}:${data.value?.menu.slug}`; }
  function chooseLanguage(code: string) {
    if (!codes.value.includes(code)) return;
    chosenLanguage.value = code;
    if (route.query.lang !== code) void router.replace({ query: { ...route.query, lang: code }, hash: route.hash });
    try { localStorage.setItem(storageKey(), code); } catch { /* Private mode fallback. */ }
  }
  onMounted(() => {
    if (explicitLanguage.value) { chooseLanguage(explicitLanguage.value); return; }
    let stored: string | undefined;
    try { stored = localStorage.getItem(storageKey()) ?? undefined; } catch { /* Use browser preference. */ }
    const preference = matchMenuLanguage(stored, codes.value) ?? navigator.languages.map(l => matchMenuLanguage(l, codes.value)).find(Boolean);
    if (preference) chosenLanguage.value = preference;
  });
  return { availableLanguages, selectedLanguage, localized, copy, chooseLanguage };
}
