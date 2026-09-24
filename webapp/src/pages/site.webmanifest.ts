import type { APIRoute } from 'astro'
import { useTranslations, DEFAULT_LOCALE } from '../i18n'
import { PLUGIN } from '../lib/upstream'
import { THEME_COLOR } from '../lib/site'

/** The install manifest, from the same names and colour the page uses; icons from scripts/build-social.mjs. */
export const GET: APIRoute = () => {
  const t = useTranslations(DEFAULT_LOCALE)
  const manifest = {
    name: PLUGIN,
    short_name: PLUGIN,
    description: t('meta.description'),
    start_url: '/',
    display: 'browser',
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: '/icon/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
  return new Response(JSON.stringify(manifest, null, 2), { headers: { 'Content-Type': 'application/manifest+json' } })
}
