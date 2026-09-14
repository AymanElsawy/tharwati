import {
  ArrowUpRight,
  Building2,
  Coins,
  Gem,
  Landmark,
  Store,
  WalletCards,
} from "lucide-react"
import { Link } from "react-router-dom"

import type { WealthAnalysisEvidence } from "@/features/analysis/utils/wealth-analysis"
import type { DashboardAggregate, DashboardAssetGroup } from "@/features/dashboard/services/dashboard-aggregate.service"
import { formatPortfolioPercent } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"

const icons: Record<DashboardAssetGroup, typeof Landmark> = {
  cashAndBank: Landmark,
  brokerage: WalletCards,
  goldAndSilver: Gem,
  realEstate: Building2,
  business: Store,
  certificates: Coins,
  other: Coins,
}

export function WealthExplorer({
  aggregate,
  evidence,
}: {
  aggregate: DashboardAggregate
  evidence: WealthAnalysisEvidence
}) {
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-EG" : "en-US"

  return (
    <section aria-labelledby="wealth-explorer-title">
      <header className="tharwati-section-header">
        <p className="tharwati-eyebrow">{t("analysis.explorer.eyebrow")}</p>
        <h2 id="wealth-explorer-title" className="tharwati-section-title mt-2">
          {t("analysis.explorer.title")}
        </h2>
        <p className="tharwati-section-description">
          {t("analysis.explorer.description")}
        </p>
      </header>
      <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {evidence.assetClasses.map((assetClass) => {
          const Icon = icons[assetClass.group]
          const content = (
            <>
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: `${assetClass.color}18`,
                  color: assetClass.color,
                }}
              >
                <Icon size={19} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{t(assetClass.labelKey)}</span>
                {assetClass.destination ? (
                  <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">
                    {t("analysis.classes.openPortfolio")}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-end">
                <span className="block text-sm font-bold tabular-nums">
                  {aggregate.status === "complete" ? (
                    assetClass.value === "0" || assetClass.percentage === null ? (
                      <span className="font-medium text-[var(--color-text-muted)]">
                        {t("analysis.explorer.noCurrentValue")}
                      </span>
                    ) : (
                      <bdi dir="ltr">
                        {formatPortfolioPercent(assetClass.percentage, locale)}
                      </bdi>
                    )
                  ) : (
                    t("analysis.value.unavailable")
                  )}
                </span>
                {assetClass.destination ? (
                  <ArrowUpRight className="mt-1 ms-auto size-4 text-[var(--color-primary)] rtl:-scale-x-100" aria-hidden="true" />
                ) : null}
              </span>
            </>
          )

          return assetClass.destination ? (
            <Link
              key={assetClass.group}
              to={assetClass.destination}
              className="flex items-center gap-4 py-4 outline-none transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]"
            >
              {content}
            </Link>
          ) : (
            <article
              key={assetClass.group}
              aria-disabled="true"
              className="flex items-center gap-4 py-3.5 opacity-60"
            >
              {content}
            </article>
          )
        })}
      </div>
    </section>
  )
}
