/** Facts about the project this page advertises. One place, so no link drifts. */
export const REPO_SLUG = 'TOMOSIA-VIETNAM/webapp-evidence'
export const REPO_URL = `https://github.com/${REPO_SLUG}`
export const RELEASES_URL = `${REPO_URL}/releases`
export const ISSUES_URL = `${REPO_URL}/issues`
export const LICENSE = 'MIT'
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`

/** The organisation behind the project, written the same way wherever it is named. */
export const TOMOSIA_NAME = 'TOMOSIA VIETNAM'
export const TOMOSIA_URL = 'https://tomosia.com'

/** The sibling project whose landing page the demo recording tours. */
export const OPEN_PR_SITE_URL = 'https://open-pr.vercel.app'

/** The demo gif, copied next to the page by scripts/sync-upstream.mjs. */
export const DEMO_GIF = '/upstream/site-tour.gif'

/**
 * The colour the browser paints its own chrome with on mobile. It has to be a literal because a
 * meta tag cannot read a CSS variable; it mirrors --color-surface in src/styles/tokens.css.
 */
export const THEME_COLOR = '#fafafa'
