// @ts-check
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'
import vercel from '@astrojs/vercel'
import { LOCALES, DEFAULT_LOCALE } from './src/i18n/locales.ts'

// Absolute origin the built pages use for canonical links, hreflang and the sitemap.
// Override with SITE_URL when a branch preview or a custom domain needs its own origin.
const site = process.env.SITE_URL ?? 'https://evd.vercel.app'

export default defineConfig({
  site,
  output: 'static',
  adapter: vercel(),
  i18n: {
    defaultLocale: DEFAULT_LOCALE,
    locales: [...LOCALES],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: DEFAULT_LOCALE, locales: Object.fromEntries(LOCALES.map((l) => [l, l])) },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
})
