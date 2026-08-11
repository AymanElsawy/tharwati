import { Languages } from "lucide-react"

import { useTranslation } from "./useTranslation"

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useTranslation()
  const nextLanguage = language === "en" ? "ar" : "en"
  const nextLanguageLabel =
    nextLanguage === "ar"
      ? t("language.arabic")
      : t("language.english")

  return (
    <button
      type="button"
      onClick={() => setLanguage(nextLanguage)}
      aria-label={t("language.switchTo", {
        language: nextLanguageLabel,
      })}
      title={nextLanguageLabel}
      className="flex size-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] sm:size-auto sm:gap-2 sm:px-3 sm:py-1.5"
    >
      <Languages size={17} />
      <span className="hidden sm:inline">{nextLanguageLabel}</span>
    </button>
  )
}
