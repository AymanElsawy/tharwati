import {
  AlertTriangle,
  BadgeCheck,
  Landmark,
  Layers3,
  ShieldAlert,
  WalletCards,
} from "lucide-react"
import type { ReactNode } from "react"

import type { WealthInsight } from "@/features/analysis/utils/wealth-insights"
import { formatPortfolioPercent } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"

const insightIcons: Record<WealthInsight["kind"], typeof BadgeCheck> = {
  "valuation-confidence": BadgeCheck,
  concentration: ShieldAlert,
  liabilities: WalletCards,
  liquidity: Landmark,
  breadth: Layers3,
}

export function WealthKeyInsights({ insights }: { insights: WealthInsight[] }) {
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-EG" : "en-US"

  const category = (insight: WealthInsight) => {
    switch (insight.kind) {
      case "valuation-confidence":
        return t("analysis.insights.category.confidence")
      case "concentration":
      case "breadth":
        return t("analysis.insights.category.structure")
      case "liabilities":
        return t("analysis.insights.category.liabilities")
      case "liquidity":
        return t("analysis.insights.category.liquidity")
    }
  }

  const title = (insight: WealthInsight) => {
    switch (insight.kind) {
      case "valuation-confidence":
        return t("analysis.insights.confidence.title")
      case "concentration":
        return t("analysis.insights.concentration.title")
      case "liabilities":
        return t("analysis.insights.liabilities.title")
      case "liquidity":
        return t("analysis.insights.liquidity.title")
      case "breadth":
        return t("analysis.insights.breadth.title")
    }
  }

  const evidence = (insight: WealthInsight): ReactNode => {
    switch (insight.kind) {
      case "valuation-confidence":
        if (insight.state === "incomplete") {
          return (
            <>
              {t("analysis.insights.confidence.unresolved")} {" "}
              <bdi dir="ltr">{insight.unresolvedCount}</bdi>
            </>
          )
        }
        if (insight.state === "stale") {
          return t("analysis.insights.confidence.stale")
        }
        if (insight.state === "unavailable") {
          return t("analysis.insights.confidence.unavailable")
        }
        return t("analysis.insights.confidence.completeCurrent")
      case "concentration":
        return (
          <>
            {t(insight.assetClass.labelKey)} {" "}
            {t("analysis.insights.concentration.represents")} {" "}
            <bdi dir="ltr">
              {formatPortfolioPercent(insight.percentage, locale)}
            </bdi>{" "}
            {t("analysis.insights.concentration.ofWealth")}
          </>
        )
      case "liabilities":
        return insight.percentage === null ? (
          t("analysis.insights.liabilities.unavailable")
        ) : (
          <>
            {t("analysis.insights.liabilities.prefix")} {" "}
            <bdi dir="ltr">
              {formatPortfolioPercent(insight.percentage, locale)}
            </bdi>{" "}
            {t("analysis.insights.liabilities.suffix")}
          </>
        )
      case "liquidity":
        return (
          <>
            {t("analysis.insights.liquidity.prefix")} {" "}
            <bdi dir="ltr">
              {formatPortfolioPercent(insight.percentage, locale)}
            </bdi>{" "}
            {t("analysis.insights.liquidity.suffix")}
          </>
        )
      case "breadth":
        return (
          <>
            {t("analysis.insights.breadth.prefix")} {" "}
            <bdi dir="ltr">{insight.assetClassCount}</bdi>{" "}
            {t("analysis.insights.breadth.suffix")}
          </>
        )
    }
  }

  return (
    <section aria-labelledby="wealth-insights-title">
      <header className="tharwati-section-header mb-5">
        <p className="tharwati-eyebrow">{t("analysis.insights.eyebrow")}</p>
        <h2 id="wealth-insights-title" className="tharwati-section-title mt-2">
          {t("analysis.insights.title")}
        </h2>
        <p className="tharwati-section-description">
          {t("analysis.insights.description")}
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {insights.map((insight) => {
          const Icon =
            insight.kind === "valuation-confidence" &&
            insight.state !== "complete-current"
              ? AlertTriangle
              : insightIcons[insight.kind]
          return (
            <article
              key={insight.id}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 shadow-sm"
            >
              <div className="flex items-center gap-2 text-[var(--color-primary)]">
                <Icon size={16} aria-hidden="true" />
                <p className="text-xs font-bold tracking-wide uppercase">
                  {category(insight)}
                </p>
              </div>
              <h3 className="mt-3 font-bold">{title(insight)}</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                {evidence(insight)}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
