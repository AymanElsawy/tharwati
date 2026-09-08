import { AlertTriangle, RefreshCw } from "lucide-react"

import { useTranslation } from "@/i18n/useTranslation"

export function PortfolioExecutiveError({
  error,
  onRetry,
}: {
  error: Error
  onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <section
      role="alert"
      className="rounded-2xl border border-amber-600/35 bg-[var(--color-surface)] px-6 py-10 sm:px-10"
    >
      <AlertTriangle
        className="size-6 text-amber-700 dark:text-amber-400"
        aria-hidden="true"
      />
      <h1 className="mt-5 text-2xl font-bold">
        {t("portfolio.error.title")}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
        {error.message || t("portfolio.error.description")}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="tharwati-button-secondary mt-6 gap-2"
      >
        <RefreshCw size={16} aria-hidden="true" />
        {t("portfolio.error.retry")}
      </button>
    </section>
  )
}
