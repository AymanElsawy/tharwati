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
      className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      <Languages size={17} />
      <span>{nextLanguageLabel}</span>
    </button>
  )
}
