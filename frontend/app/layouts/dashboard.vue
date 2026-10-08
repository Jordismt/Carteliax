<script setup lang="ts">
import {
  LayoutDashboard,
  Store,
  BookOpen,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-vue-next";

const route = useRoute();
const { logout } = useAuth();

const mobileMenuOpen = ref(false);
const loggingOut = ref(false);
const logoutError = ref("");
const mobileMenuButton = ref<HTMLButtonElement | null>(null);
const sidebar = ref<HTMLElement | null>(null);

const navigation = [
  {
    label: "Inicio",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    label: "Establecimientos",
    icon: Store,
    path: "/businesses",
  },
  {
    label: "Cartas",
    icon: BookOpen,
    path: "/menus",
  },
];

const currentTitle = computed(() => {
  const path = route.path;

  if (path === "/dashboard") {
    return "Inicio";
  }

  if (path === "/businesses") {
    return "Mis establecimientos";
  }

  if (path.startsWith("/businesses/")) {
    return "Configurar establecimiento";
  }

  if (path === "/menus") {
    return "Mis cartas";
  }

  if (path.startsWith("/billing/")) return "Suscripción y facturación";
  if (path.endsWith("/design")) return "Personalizar carta";
  if (path.endsWith("/qr")) return "Código QR de la carta";
  if (path.endsWith("/languages")) return "Idiomas de la carta";

  if (path.startsWith("/menus/")) {
    return "Gestionar carta";
  }

  return "Carteliax";
});

const currentSection = computed(() => {
  if (route.path.startsWith("/billing/")) return "Facturación";

  if (route.path.startsWith("/businesses")) {
    return "Establecimientos";
  }

  if (route.path.startsWith("/menus")) {
    return "Cartas";
  }

  return "Inicio";
});

function isActive(path: string) {
  if (path === "/dashboard") {
    return route.path === path;
  }

  return route.path === path || route.path.startsWith(`${path}/`);
}

function trapMobileFocus(event: KeyboardEvent) {
  if (!mobileMenuOpen.value || !sidebar.value) return;
  const items = [...sidebar.value.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)")].filter((item) => item.getClientRects().length);
  const first = items[0];
  const last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}

function closeMobileMenu() {
  mobileMenuOpen.value = false;
  if (import.meta.client) nextTick(() => mobileMenuButton.value?.focus());
}

async function handleLogout() {
  if (loggingOut.value) return;

  loggingOut.value = true;
  logoutError.value = "";

  try {
    await logout();
  } catch (error) {
    console.error("Error cerrando sesión:", error);
    logoutError.value = "No se pudo cerrar la sesión. Inténtalo de nuevo.";
    loggingOut.value = false;
  }
}

watch(
  () => route.fullPath,
  () => {
    closeMobileMenu();
  },
);

watch(mobileMenuOpen, (open) => {
  if (!import.meta.client) return;

  document.body.style.overflow = open ? "hidden" : "";
  if (open) nextTick(() => sidebar.value?.querySelector<HTMLButtonElement>("button")?.focus());
});

onUnmounted(() => {
  if (import.meta.client) {
    document.body.style.overflow = "";
  }
});
</script>

<template>
  <div class="workspace app-shell" @keydown.esc="mobileMenuOpen && closeMobileMenu()">
    <a href="#workspace-content" class="skip-link">Ir al contenido</a>
    <Transition name="fade"><button v-if="mobileMenuOpen" type="button" aria-label="Cerrar navegación" class="app-overlay lg:hidden" @click="closeMobileMenu" /></Transition>
    <aside id="workspace-navigation" ref="sidebar" class="app-sidebar" :class="{ 'is-open': mobileMenuOpen }" @keydown.tab="trapMobileFocus">
      <div class="app-brand-row"><NuxtLink to="/dashboard" class="app-brand" @click="closeMobileMenu"><span class="app-brand-symbol" aria-hidden="true"><UiBrandMark /></span>Carteliax<span class="app-brand-dot">.</span></NuxtLink><button type="button" class="app-close lg:hidden" aria-label="Cerrar menú" @click="closeMobileMenu"><X :size="21" /></button></div>
      <div class="app-sidebar-content"><p class="app-nav-label">TU ESPACIO</p>
        <nav aria-label="Navegación principal" class="app-nav"><NuxtLink v-for="item in navigation" :key="item.path" :to="item.path" :aria-current="isActive(item.path) ? 'page' : undefined" @click="closeMobileMenu"><component :is="item.icon" :size="19" aria-hidden="true" /><span>{{ item.label }}</span><ChevronRight v-if="isActive(item.path)" :size="15" /></NuxtLink></nav>
        <div class="app-sidebar-note"><BookOpen :size="22" aria-hidden="true" /><p>Tu carta, siempre al día.</p><span>Prepara, publica y comparte desde aquí.</span><NuxtLink to="/menus" @click="closeMobileMenu">Ir a mis cartas <ChevronRight :size="15" /></NuxtLink></div>
        <div class="app-account"><NuxtLink :to="route.params.businessId ? `/billing/${route.params.businessId}` : route.path.startsWith('/businesses/') && route.params.id ? `/billing/${route.params.id}` : '/businesses'" @click="closeMobileMenu">Cuenta y facturación <ChevronRight :size="16" /></NuxtLink><p v-if="logoutError" role="alert">{{ logoutError }}</p><button type="button" :disabled="loggingOut" @click="handleLogout"><LogOut :size="17" />{{ loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión' }}</button></div>
      </div>
    </aside>
    <main :inert="mobileMenuOpen || undefined" class="app-main">
      <header class="app-topbar"><div class="flex min-w-0 items-center gap-3"><button ref="mobileMenuButton" type="button" aria-controls="workspace-navigation" aria-label="Abrir menú" :aria-expanded="mobileMenuOpen" class="app-menu-button lg:hidden" @click="mobileMenuOpen = true"><Menu :size="21" /></button><div class="min-w-0"><div class="app-breadcrumb"><NuxtLink to="/dashboard">Mi espacio</NuxtLink><ChevronRight :size="13" /><span>{{ currentSection }}</span></div><p class="app-current-title">{{ currentTitle }}</p></div></div><span class="app-topbar-brand">Carteliax<span>.</span></span></header>
      <div id="workspace-content" tabindex="-1" class="app-content"><slot /></div>
      <footer class="app-footer"><span>© {{ new Date().getFullYear() }} Carteliax</span><span>Hecho para tu restaurante</span></footer>
    </main>
    <nav :inert="mobileMenuOpen || undefined" aria-label="Accesos principales" class="mobile-navigation"><NuxtLink v-for="item in navigation" :key="item.path" :to="item.path" :aria-current="isActive(item.path) ? 'page' : undefined"><component :is="item.icon" :size="20" aria-hidden="true" />{{ item.label }}</NuxtLink></nav>
  </div>
</template>
<style scoped>
.app-shell{display:flex;min-height:100dvh}.app-sidebar{position:sticky;top:0;height:100dvh;width:232px;flex-shrink:0;background:var(--ui-sidebar);color:var(--ui-sidebar-text);display:flex;flex-direction:column;z-index:50}.app-brand-row{display:flex;align-items:center;justify-content:space-between;padding:25px 22px 23px}.app-brand{display:flex;align-items:center;font-size:23px;letter-spacing:-1px;font-weight:750;color:#fff}.app-brand-symbol{display:flex;align-items:center;justify-content:center;width:31px;height:31px;background:transparent;color:#183f35;border-radius:9px;margin-right:9px}.app-brand-dot{color:#9cd1ae}.app-close{padding:10px}.app-sidebar-content{display:flex;flex-direction:column;flex:1;min-height:0;padding:12px 14px 16px;overflow:auto}.app-nav-label{font-size:10px;font-weight:650;letter-spacing:1.8px;color:#a8c1b8;padding:0 13px;margin:9px 0 15px}.app-nav{display:grid;gap:6px}.app-nav a{display:flex;align-items:center;gap:12px;min-height:48px;padding:12px 14px;border-radius:10px;font-size:14px;color:#c9d9d2;font-weight:550;transition:background 150ms,color 150ms}.app-nav a span{flex:1}.app-nav a:hover{background:#ffffff0b;color:#fff}.app-nav a[aria-current]{background:#d4e9d8;color:#183f35;font-weight:700}.app-sidebar-note{margin:auto 4px 24px;padding:22px 13px 0;border-top:1px solid #ffffff1a;color:#a8c1b8}.app-sidebar-note>svg{color:#afcfba;margin-bottom:12px}.app-sidebar-note p{font-size:13px;font-weight:650;color:#e8f0eb}.app-sidebar-note span{display:block;font-size:12px;line-height:1.7;margin-top:5px}.app-sidebar-note a{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#d4e9d8;margin-top:10px;min-height:44px}.app-account{border-top:1px solid #ffffff1a;padding:12px 5px 0;font-size:12px}.app-account>a,.app-account button{display:flex;align-items:center;gap:10px;min-height:44px;padding:8px;width:100%;color:#c9d9d2}.app-account>a{justify-content:space-between}.app-account button:hover,.app-account>a:hover{color:white;background:#ffffff09;border-radius:8px}.app-account p{color:#ffd0cb;line-height:1.6}.app-main{flex:1;min-width:0;display:flex;flex-direction:column}.app-topbar{position:sticky;top:0;z-index:30;display:flex;align-items:center;justify-content:space-between;height:76px;padding:12px 36px;border-bottom:1px solid var(--ui-border);background:var(--ui-surface)}.app-breadcrumb{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--ui-muted)}.app-current-title{font-size:14px;font-weight:650;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.app-topbar-brand{font-size:12px;color:var(--ui-muted);letter-spacing:-.3px}.app-topbar-brand span{color:var(--ui-accent);font-weight:700}.app-content{width:100%;max-width:1336px;margin:0 auto;flex:1;padding:36px}.app-footer{display:flex;justify-content:space-between;border-top:1px solid var(--ui-border);padding:20px 36px;font-size:11px;color:var(--ui-muted)}.app-menu-button{padding:10px;border:1px solid var(--ui-border);border-radius:10px;background:var(--ui-surface)}.app-overlay{position:fixed;inset:0;z-index:40;background:#10271f80}.mobile-navigation{display:none}.fade-enter-active,.fade-leave-active{transition:opacity 150ms}.fade-enter-from,.fade-leave-to{opacity:0}
@media(max-width:1023px){.app-sidebar{position:fixed;inset:0 auto 0 0;width:272px;max-width:calc(100vw - 40px);transform:translateX(-100%);visibility:hidden;transition:transform 180ms}.app-sidebar.is-open{visibility:visible;transform:translateX(0)}.app-main{padding-bottom:calc(76px + env(safe-area-inset-bottom))}.app-topbar{height:65px;padding:10px 20px}.app-content{padding:28px 24px}.app-footer{display:none}.mobile-navigation{display:grid;grid-template-columns:repeat(3,1fr);position:fixed;bottom:0;left:0;right:0;z-index:30;background:var(--ui-surface);border-top:1px solid var(--ui-border);padding:6px 8px max(6px,env(safe-area-inset-bottom))}.mobile-navigation a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font-size:10px;min-height:56px;border-radius:10px;font-weight:600;color:var(--ui-muted)}.mobile-navigation a[aria-current]{background:var(--ui-accent-soft);color:var(--ui-accent)}.app-sidebar-note{margin-top:48px}.app-account{margin-top:auto}}
@media(max-width:639px){.app-content{padding:24px 16px}.app-topbar{padding-inline:16px}.app-topbar-brand{display:none}.app-breadcrumb{font-size:10px}.app-current-title{font-size:13px}}
</style>
