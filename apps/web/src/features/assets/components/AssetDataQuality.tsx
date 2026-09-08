import { AlertTriangle, CircleOff, ExternalLink } from "lucide-react"
import { Link } from "react-router-dom"

import type {
  AssetHealthAnalysis,
  AssetInventoryItem,
  AssetQualityIssueId,
} from "@/features/assets/types/asset-workspace"
import { useTranslation } from "@/i18n/useTranslation"

const priceIssues = new Set<AssetQualityIssueId>([
  "missing_price",
  "missing_valuation_date",
  "stale_market_price",
])

export function AssetDataQuality({
  analysis,
  items,
  selectedIssueId,
  onSelect,
}: {
  analysis: AssetHealthAnalysis
  items: AssetInventoryItem[]
  selectedIssueId: AssetQualityIssueId | null
  onSelect: (id: AssetQualityIssueId | null) => void
}) {
  const { t } = useTranslation()
  const selected = analysis.issues.find((issue) => issue.id === selectedIssueId)
  const affected = selected
    ? items.filter((item) => selected.affectedAssetIds.includes(item.asset.id))
    : []
  const firstAffected = affected[0]
  const resolution = selected
    ? priceIssues.has(selected.id) && firstAffected
      ? `/market-prices?assetId=${encodeURIComponent(firstAffected.asset.id)}`
      : selected.id === "missing_fx"
        ? "/exchange-rates"
        : null
    : null
  const missingPair = firstAffected?.missingExchangeRatePairs[0]

  return (
    <section
      aria-labelledby="asset-quality-title"
      className="mt-16 border-t border-[var(--border-subtle)] pt-10"
    >
      <header className="tharwati-section-header">
        <p className="tharwati-eyebrow">{t("assets.quality.eyebrow")}</p>
        <h2 id="asset-quality-title" className="tharwati-section-title mt-2">
          {t("assets.quality.title")}
        </h2>
        <p className="tharwati-section-description">
          {t("assets.quality.description")}
        </p>
      </header>

      {analysis.issues.length === 0 ? (
        <div className="mt-7 flex items-start gap-3 border-y border-[var(--border-subtle)] py-7">
          <CircleOff size={18} className="text-muted-foreground" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold">{t("assets.quality.emptyTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("assets.quality.emptyDescription")}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)]">
          <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
            {analysis.issues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                aria-pressed={selectedIssueId === issue.id}
                onClick={() => onSelect(selectedIssueId === issue.id ? null : issue.id)}
                className="flex w-full items-center justify-between gap-4 px-2 py-4 text-start outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 aria-pressed:bg-muted/50 motion-reduce:transition-none"
              >
                <span className="inline-flex items-center gap-2.5 text-sm font-semibold">
                  <AlertTriangle size={16} className="text-amber-700 dark:text-amber-300" aria-hidden="true" />
                  {t(`assets.quality.issue.${issue.id}`)}
                </span>
                <span className="tabular-nums text-sm text-muted-foreground">
                  {issue.count}
                </span>
              </button>
            ))}
          </div>

          <div aria-live="polite">
            {selected ? (
              <div key={selected.id} className="animate-in fade-in duration-150 motion-reduce:animate-none">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("assets.quality.selectedIssue")}
                </p>
                <h3 className="mt-2 text-lg font-semibold">
                  {t(`assets.quality.issue.${selected.id}`)}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t(`assets.quality.explanation.${selected.id}`)}
                </p>
                <ul className="mt-5 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
                  {affected.map((item) => (
                    <li key={item.asset.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <span>
                        <strong className="block font-medium">{item.asset.name}</strong>
                        <span className="text-xs text-muted-foreground" dir="ltr">
                          {item.asset.symbol ?? item.asset.currency_code}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(`assets.workspace.data.${item.dataStatus}`)}
                      </span>
                    </li>
                  ))}
                </ul>
                {resolution ? (
                  <Link to={resolution} state={selected.id === "missing_fx" && missingPair ? { sourceCurrencyCode: missingPair.sourceCurrencyCode, destinationCurrencyCode: missingPair.destinationCurrencyCode, returnTo: "/assets" } : { returnTo: "/assets" }} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2">
                    {t(selected.id === "missing_fx" ? "assets.quality.resolveFx" : "assets.quality.resolvePrice")}
                    <ExternalLink size={14} aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="mt-5 text-xs text-muted-foreground">
                    {t("assets.quality.noResolution")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("assets.quality.selectPrompt")}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
