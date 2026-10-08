import { useTranslation } from "@/i18n/useTranslation"

export function LegalLinks() {
  const { t, language } = useTranslation()
  return (
    <nav
      aria-label={t("legal.links")}
      className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
    >
      {(["privacy", "terms"] as const).map((document) => (
        <a
          key={document}
          href={`/${document}?lang=${language}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-[var(--color-primary)] underline underline-offset-4"
        >
          {t(`legal.${document}`)}
        </a>
      ))}
    </nav>
  )
}
