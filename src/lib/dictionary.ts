import 'server-only'
import type { Locale } from '../../i18n.config'

const dictionaries = {
  en: () => import('@/dictionaries/en.json').then((module) => module.default),
  th: () => import('@/dictionaries/th.json').then((module) => module.default),
}

export const getDictionary = async (locale: Locale) => {
  // Add a check to ensure the locale exists in our dictionaries, otherwise default to 'th'
  if (locale && dictionaries[locale]) {
    return dictionaries[locale]();
  }
  return dictionaries.th();
};
