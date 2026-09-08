import { Banknote, ChartNoAxesCombined, WalletCards } from "lucide-react"

import type { DashboardViewModel } from "@/features/dashboard/types/dashboard"

function amount(value: string, currency: string) {
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(value))} ${currency}`
}

function signed(value: string | null, suffix = "") {
  if (value === null) return "Unavailable"
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(value))
  return `${value.startsWith("-") ? "" : "+"}${formatted}${suffix}`
}

type Props = {
  dashboard: DashboardViewModel
}

export function DashboardSummary({ dashboard }: Props) {
  const cards = [
    {
      title: "Net Worth",
      value: amount(
        dashboard.netWorth.netWorth,
        dashboard.baseCurrency,
      ),
      detail:
        dashboard.netWorth.status === "partial"
          ? "Partial valuation — missing data disclosed below"
          : "Cash and current investment market value",
      icon: WalletCards,
    },
    {
      title: "Cash",
      value: amount(
        dashboard.cash.projectedBalanceBase,
        dashboard.cash.currencyCode,
      ),
      detail: `${dashboard.cash.accountCount} cash ${
        dashboard.cash.accountCount === 1 ? "account" : "accounts"
      } in reporting currency`,
      icon: Banknote,
    },
    {
      title: "Investments",
      value:
        dashboard.investments.marketValueBase === null
          ? "Unavailable"
          : amount(
              dashboard.investments.marketValueBase,
              dashboard.investments.currencyCode,
            ),
      detail: `${dashboard.investments.holdingsCount} valued ${
        dashboard.investments.holdingsCount === 1
          ? "holding"
          : "holdings"
      }`,
      icon: ChartNoAxesCombined,
    },
  ]

  return (
    <section className="tharwati-metric-grid" aria-label="Wealth summary">
      {cards.map((card) => (
        <article key={card.title} className="tharwati-metric-panel">
          <div className="flex items-center justify-between gap-3">
            <h2 className="tharwati-metric-label">
              {card.title}
            </h2>
            <card.icon
              className="size-4 text-[var(--color-text-muted)]"
              strokeWidth={1.75}
            />
          </div>
          <p className="tharwati-metric-value" dir="ltr">
            {card.value}
          </p>
          {card.title === "Investments" ? (
            <p className="mt-2 text-sm font-semibold" dir="ltr">
              {signed(
                dashboard.investments.unrealizedGainLossBase,
                ` ${dashboard.baseCurrency}`,
              )}
              {" · "}
              {signed(
                dashboard.investments.unrealizedReturnPercent,
                "%",
              )}
            </p>
          ) : null}
          {card.title === "Investments" ? (
            <div className="mt-1 space-y-1">
              {dashboard.investments.priceSources.map((source) => (
                <p
                  key={`${source.symbol}-${source.fetchedAt}`}
                  className="text-xs text-[var(--color-text-secondary)]"
                  data-testid="market-price-provenance"
                >
                  {source.symbol ?? "Asset"}: {source.provider} · {source.priceType} · {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(source.fetchedAt))}
                </p>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {card.detail}
          </p>
        </article>
      ))}
    </section>
  )
}
