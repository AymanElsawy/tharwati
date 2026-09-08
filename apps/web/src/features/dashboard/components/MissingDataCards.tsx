import { AlertTriangle } from "lucide-react"
import { Link } from "react-router-dom"

import type { DashboardViewModel } from "@/features/dashboard/types/dashboard"
import { useTranslation } from "@/i18n/useTranslation"
import { isFrankfurterSupportedPair } from "@/services/exchange-rates/frankfurter-supported"

export function MissingDataCards({
  missing,
  onRetry,
}: {
  missing: DashboardViewModel["missingData"]
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const automaticPairs = missing.exchangeRatePairs.filter((pair) =>
    isFrankfurterSupportedPair(pair.sourceCurrencyCode, pair.destinationCurrencyCode),
  )
  const unsupportedPairs = missing.exchangeRatePairs.filter((pair) =>
    !isFrankfurterSupportedPair(pair.sourceCurrencyCode, pair.destinationCurrencyCode),
  )
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
      <div className="grid gap-px overflow-hidden rounded-xl border border-amber-200/70 bg-amber-200/70 md:grid-cols-2">
        {missing.priceHoldings.length > 0 ? (
          <article className="bg-amber-50 p-5 text-amber-950">
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
        {automaticPairs.length > 0 ? (
          <article className="bg-amber-50 p-5 text-amber-950">
            <h3 className="font-bold">{t("fx.temporaryUnavailable")}</h3>
            <p className="mt-2 text-sm">
              {automaticPairs
                .map(
                  (pair) =>
                    `${pair.sourceCurrencyCode}/${pair.destinationCurrencyCode}`,
                )
                .join(", ")}
            </p>
            <button type="button" onClick={onRetry} className="mt-4 font-semibold text-amber-800 underline">{t("fx.retry")}</button>
          </article>
        ) : null}
        {unsupportedPairs.length > 0 ? (
          <article className="bg-amber-50 p-5 text-amber-950">
            <h3 className="font-bold">{t("fx.unsupportedCurrency")}</h3>
            <p className="mt-2 text-sm">
              {unsupportedPairs
                .map((pair) => `${pair.sourceCurrencyCode}/${pair.destinationCurrencyCode}`)
                .join(", ")}
            </p>
          </article>
        ) : null}
      </div>
    </section>
  )
}
