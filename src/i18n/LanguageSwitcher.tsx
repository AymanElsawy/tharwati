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
      className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] shadow-sm transition hover:bg-[var(--color-surface-hover)]"
    >
      <Languages size={17} />
      <span>{nextLanguageLabel}</span>
    </button>
  )
}
