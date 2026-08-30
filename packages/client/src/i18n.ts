import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import ka from './locales/ka.json'
import ru from './locales/ru.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'ka', label: 'ქართული' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
] as const

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ka: { translation: ka },
      ru: { translation: ru },
    },
    fallbackLng: 'en',
    supportedLngs: ['ka', 'ru', 'en'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already safe from XSS
    },
  })

export default i18n
