import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2026-09-30",

  devtools: {
    enabled: true,
  },

  // Favicon de Carteliax
  app: {
    head: {
      link: [
        {
          rel: "icon",
          type: "image/png",
          href: "/favicon.png?v=2",
        },
      ],
    },
  },

  css: ["~/assets/css/main.css"],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    // SSR can use NUXT_API_BASE_URL, or the explicitly configured public API URL.
    // Never silently send production requests to a developer's localhost.
    apiBaseUrl: "",

    public: {
      supabaseUrl: "",
      supabasePublishableKey: "",
      apiUrl: "",
    },
  },
});
