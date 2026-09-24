import type { APIRoute } from 'astro'

/** Built from the configured origin, so a preview or custom domain points crawlers at its own sitemap. */
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap-index.xml', site).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
