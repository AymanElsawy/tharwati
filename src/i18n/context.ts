import { createContext } from "react"

import type { TranslationKey } from "./en/translations"

export type Language = "en" | "ar"
export type TranslationParams = Record<string, string | number>
export type Translate = (
  key: TranslationKey,
  params?: TranslationParams,
) => string

export type LanguageContextValue = {
  language: Language
  direction: "ltr" | "rtl"
  setLanguage: (language: Language) => void
  t: Translate
}

export const LanguageContext =
  createContext<LanguageContextValue | null>(null)
