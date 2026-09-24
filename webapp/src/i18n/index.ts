import { en, type Dictionary } from './en'
import { vi } from './vi'
import { ja } from './ja'
import { zh } from './zh'
import { LOCALES, DEFAULT_LOCALE, type Locale } from './locales'

export { LOCALES, DEFAULT_LOCALE, type Locale }

/** localStorage key holding the visitor's chosen language. */
export const LANG_STORAGE_KEY = 'webapp-evidence.lang'

const DICTIONARIES: Record<Locale, Dictionary> = { en, vi, ja, zh }

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale)
}

/** Reads the locale out of a URL: `/` is English, `/vi/...` and the others are prefixed. */
export function localeFromUrl(url: URL): Locale {
  const segment = url.pathname.split('/').filter(Boolean)[0]
  return isLocale(segment) ? segment : DEFAULT_LOCALE
}

const PREFIX = new RegExp(`^/(${LOCALES.join('|')})(?=/|$)`)

/** Path of the same page in another language, keeping the trailing slash style. */
export function localePath(locale: Locale, path = '/'): string {
  const clean = path.replace(PREFIX, '') || '/'
  const suffix = clean.startsWith('/') ? clean : `/${clean}`
  if (locale === DEFAULT_LOCALE) return suffix
  return `/${locale}${suffix === '/' ? '/' : suffix}`
}

/** Translator bound to one locale. Missing keys throw at build time, never render blank. */
export function useTranslations(locale: Locale) {
  const dict = DICTIONARIES[locale]
  return function t(key: keyof Dictionary): string {
    const value = dict[key]
    if (value === undefined) throw new Error(`Missing ${locale} translation for "${String(key)}"`)
    return value
  }
}

export type { Dictionary }
