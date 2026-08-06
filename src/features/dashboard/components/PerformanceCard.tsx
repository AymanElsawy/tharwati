import type { DashboardViewModel } from "@/features/dashboard/types/dashboard"

function format(value: string | null, currency?: string) {
  if (value === null) return "Unavailable"
  return `${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))}${currency ? ` ${currency}` : ""}`
}

export function PerformanceCard({
  performance,
  currency,
}: {
  performance: DashboardViewModel["performance"]
  currency: string
}) {
  return (
    <article className="tharwati-analytical-surface px-1 py-7 sm:px-7">
      <h2 className="tharwati-section-title">Portfolio Performance</h2>
      <p className="tharwati-section-description">
        Current unrealized performance; historical series is not yet available.
      </p>
      <dl className="tharwati-data-grid mt-8">
        <div className="tharwati-data-point">
          <dt className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            Market value
          </dt>
          <dd className="mt-2 text-xl font-black" dir="ltr">
            {format(performance.marketValueBase, currency)}
          </dd>
        </div>
        <div className="tharwati-data-point">
          <dt className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            Unrealized gain/loss
          </dt>
          <dd className="mt-2 text-xl font-black" dir="ltr">
            {format(performance.unrealizedGainLossBase, currency)}
          </dd>
        </div>
        <div className="tharwati-data-point">
          <dt className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            Unrealized return
          </dt>
          <dd className="mt-2 text-xl font-black" dir="ltr">
            {performance.unrealizedReturnPercent === null
              ? "Unavailable"
              : `${format(performance.unrealizedReturnPercent)}%`}
          </dd>
        </div>
      </dl>
    </article>
  )
}
