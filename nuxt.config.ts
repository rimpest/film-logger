// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  // Devtools off in dev because Vite re-discovers their chunks on first load
  // and forces a full reload — that breaks Playwright's hydration assumptions
  // in slow environments. Re-enable locally if needed.
  devtools: { enabled: false },

  vite: {
    optimizeDeps: {
      // Pre-bundle these so Vite doesn't trigger a server-restart-style reload
      // the first time an unauth user navigates to a page that imports them.
      include: ['idb'],
    },
  },

  modules: [
    '@nuxt/ui',
    '@nuxthub/core',
    'nuxt-auth-utils',
    '@vite-pwa/nuxt',
    '@nuxtjs/i18n',
  ],

  i18n: {
    // Strategy: no URL prefix — locale is decided by cookie / Accept-Language,
    // not by a `/es/` segment. Keeps PWA + offline behavior simple.
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'es', language: 'es-MX', name: 'Español', file: 'es.json' },
    ],
    bundle: {
      // Recommended for Nuxt 4 — split locale chunks at build time.
      optimizeTranslationDirective: false,
    },
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: 'en',
    },
  },

  css: ['~/assets/css/main.css'],

  // @nuxt/ui pulls in @nuxt/fonts which probes external CDNs at boot. Restrict
  // to the local cache so the dev server doesn't hang for ~30s on each restart
  // when those CDNs are blocked or slow.
  fonts: {
    providers: {
      google: false,
      googleicons: false,
      bunny: false,
      fontshare: false,
      fontsource: false,
      adobe: false,
    },
  },

  hub: {
    database: true,
  },

  runtimeConfig: {
    // session secret should come from NUXT_SESSION_PASSWORD env var (>= 32 chars)
    session: {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      cookie: {
        // In dev / E2E we serve over plain HTTP, so Secure cookies would be
        // silently dropped by the browser. Production builds get the default
        // (secure: true). NUXT_SESSION_COOKIE_SECURE can override either way.
        secure: process.env.NODE_ENV === 'production',
      },
    },
    public: {
      appName: 'Film Logger',
    },
  },

  nitro: {
    experimental: {
      tasks: true,
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Film Logger',
      short_name: 'FilmLog',
      description: 'Log your film photography shots in the moment.',
      theme_color: '#0a0a0a',
      background_color: '#0a0a0a',
      display: 'standalone',
      start_url: '/',
      icons: [
        {
          src: '/favicon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,svg,png,ico,webp}'],
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            networkTimeoutSeconds: 5,
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24,
            },
          },
        },
      ],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: false,
    },
  },

  app: {
    head: {
      title: 'Film Logger',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Log film shots in the moment.' },
        { name: 'theme-color', content: '#0a0a0a' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },
})
