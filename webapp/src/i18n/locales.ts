/** Order is the order they are offered in; the first is the unprefixed default. */
export const LOCALES = ['en', 'vi', 'ja', 'zh'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
