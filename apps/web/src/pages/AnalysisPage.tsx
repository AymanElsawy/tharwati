import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { WealthAllocationAnalysis } from "@/features/analysis/components/WealthAllocationAnalysis"
import { WealthAttentionSummary } from "@/features/analysis/components/WealthAttentionSummary"
import { WealthHealthHero } from "@/features/analysis/components/WealthHealthHero"
import { WealthTargetAllocation } from "@/features/analysis/components/WealthTargetAllocation"
import { getWealthAnalysisEvidence } from "@/features/analysis/utils/wealth-analysis"
import { useDashboardAggregate } from "@/features/dashboard/hooks/useDashboardAggregate"
import { useTranslation } from "@/i18n/useTranslation"

export function AnalysisPage() {
  const { t } = useTranslation()
  const { result, error, isLoading, refresh } = useDashboardAggregate()

  if (isLoading) {
    return (
      <section
        aria-label={t("analysis.loading")}
        className="tharwati-page-stack animate-pulse"
      >
        <div className="h-5 w-32 rounded bg-[var(--color-surface-hover)]" />
        <div className="h-10 w-64 rounded bg-[var(--color-surface-hover)]" />
        <div className="h-80 rounded-3xl bg-[var(--color-surface-hover)]" />
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-48 rounded-2xl bg-[var(--color-surface-hover)]"
            />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-[var(--color-surface-hover)]" />
      </section>
    )
  }

  if (error || !result) {
    return (
      <section className="tharwati-page-stack">
        <div className="tharwati-card max-w-2xl p-6 sm:p-8">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-700 dark:text-red-300">
            <AlertTriangle size={21} />
          </span>
          <h1 className="font-heading mt-5 text-2xl font-black">
            {t("analysis.error.title")}
          </h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            {t("analysis.error.description")}
          </p>
          <Button className="mt-5" onClick={() => void refresh()}>
            <RefreshCw /> {t("analysis.error.retry")}
          </Button>
        </div>
      </section>
    )
  }

  if (result.accountCount === 0) {
    return (
      <section className="tharwati-page-stack">
        <p className="tharwati-eyebrow">{t("pages.analysis.eyebrow")}</p>
        <div className="tharwati-card max-w-2xl p-6 sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <BarChart3 size={23} />
          </span>
          <h1 className="font-heading mt-5 text-3xl font-black">
            {t("analysis.empty.title")}
          </h1>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            {t("analysis.empty.description")}
          </p>
          <Link to="/accounts" className="tharwati-button-primary mt-5">
            {t("analysis.empty.action")}
          </Link>
        </div>
      </section>
    )
  }

  const evidence = getWealthAnalysisEvidence(result)

  return (
    <section className="grid gap-8 lg:gap-10">
      <header className="max-w-2xl">
        <p className="tharwati-eyebrow">{t("pages.analysis.eyebrow")}</p>
        <h1 className="font-heading mt-3 text-3xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
          {t("pages.analysis.title")}
        </h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          {t("pages.analysis.description")}
        </p>
      </header>
      <WealthHealthHero aggregate={result} />
      <WealthAttentionSummary aggregate={result} />
      <WealthAllocationAnalysis aggregate={result} evidence={evidence} />
      <WealthTargetAllocation aggregate={result} evidence={evidence} />
    </section>
  )
}
