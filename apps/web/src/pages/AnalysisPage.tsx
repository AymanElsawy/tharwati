import { useTranslation } from "@/i18n/useTranslation"

/// Read-only shell while Wealth Analysis data and specialized pages are built.
export function AnalysisPage() {
  const { t } = useTranslation()

  return (
    <section className="tharwati-page-stack">
      <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
        {t("pages.analysis.eyebrow")}
      </p>
      <div>
        <h1 className="font-heading text-3xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
          {t("pages.analysis.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--color-text-secondary)]">
          {t("pages.analysis.description")}
        </p>
      </div>
    </section>
  )
}
