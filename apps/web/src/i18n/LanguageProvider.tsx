import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { ar } from "./ar/translations"
import {
  LanguageContext,
  type Language,
  type TranslationParams,
} from "./context"
import { en, type TranslationKey } from "./en/translations"

const STORAGE_KEY = "tharwati-language"

function getInitialLanguage(): Language {
  const savedLanguage = localStorage.getItem(STORAGE_KEY)
  return savedLanguage === "ar" ? "ar" : "en"
}

function interpolate(
  value: string,
  params?: TranslationParams,
): string {
  if (!params) {
    return value
  }

  return Object.entries(params).reduce(
    (result, [name, replacement]) =>
      result.replaceAll(`{{${name}}}`, String(replacement)),
    value,
  )
}

type LanguageProviderProps = {
  children: ReactNode
}

export function LanguageProvider({
  children,
}: LanguageProviderProps) {
  const [language, setLanguage] =
    useState<Language>(getInitialLanguage)
  const direction: "ltr" | "rtl" =
    language === "ar" ? "rtl" : "ltr"

  useEffect(() => {
    const root = document.documentElement
    root.lang = language
    root.dir = direction
    localStorage.setItem(STORAGE_KEY, language)
  }, [direction, language])

  const value = useMemo(() => {
    const dictionary = language === "ar" ? ar : en

    return {
      language,
      direction,
      setLanguage,
      t: (key: TranslationKey, params?: TranslationParams) =>
        interpolate(dictionary[key], params),
    }
  }, [direction, language])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
