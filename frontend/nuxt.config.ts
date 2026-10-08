import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2026-09-30",

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    apiBaseUrl: "http://localhost:5000",

    public: {
      supabaseUrl: "",
      supabasePublishableKey: "",
      apiUrl: "",
    },
  },
});
