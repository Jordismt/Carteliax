import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2026-09-30",

  devtools: {
    enabled: true,
  },

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico?v=3', sizes: '16x16 32x32 48x48' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png?v=3' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png?v=3' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png?v=3' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },

  css: ["~/assets/css/main.css"],
  // Precompress static assets at build time, without compressing private HTML
  // or caching authenticated responses. Vercel also handles compression at its edge.
  nitro: { compressPublicAssets: { gzip: true, brotli: true } },

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    // SSR can use NUXT_API_BASE_URL, or the explicitly configured public API URL.
    // Never silently send production requests to a developer's localhost.
    apiBaseUrl: "",

    public: {
      siteUrl: 'https://www.carteliax.com',
      supabaseUrl: "",
      supabasePublishableKey: "",
      apiUrl: "",
    },
  },
  routeRules: {
    '/api/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/images/brand/**': { headers: { 'Cache-Control': 'public, max-age=86400' } },
  },
});
