import { AlertTriangle } from "lucide-react"
import { Link } from "react-router-dom"

import type { DashboardViewModel } from "@/features/dashboard/types/dashboard"

export function MissingDataCards({
  missing,
}: {
  missing: DashboardViewModel["missingData"]
}) {
  if (
    missing.priceHoldings.length === 0 &&
    missing.exchangeRatePairs.length === 0
  ) {
    return null
  }
  return (
    <section aria-labelledby="missing-data-title">
      <div className="mb-3 flex items-center gap-2 text-amber-700">
        <AlertTriangle className="size-5" />
        <h2 id="missing-data-title" className="font-bold">
          Action required
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {missing.priceHoldings.length > 0 ? (
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <h3 className="font-bold">Missing market prices</h3>
            <p className="mt-2 text-sm">
              {missing.priceHoldings
                .map((holding) => holding.symbol ?? holding.assetName)
                .join(", ")}
            </p>
            <Link
              to="/market-prices"
              className="mt-4 inline-flex font-semibold text-amber-800 underline"
            >
              Add market prices
            </Link>
          </article>
        ) : null}
        {missing.exchangeRatePairs.length > 0 ? (
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <h3 className="font-bold">Missing exchange rates</h3>
            <p className="mt-2 text-sm">
              {missing.exchangeRatePairs
                .map(
                  (pair) =>
                    `${pair.sourceCurrencyCode}/${pair.destinationCurrencyCode}`,
                )
                .join(", ")}
            </p>
            <Link
              to="/exchange-rates"
              className="mt-4 inline-flex font-semibold text-amber-800 underline"
            >
              Add exchange rates
            </Link>
          </article>
        ) : null}
      </div>
    </section>
  )
}
