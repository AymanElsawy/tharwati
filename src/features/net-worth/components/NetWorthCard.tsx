import { AlertTriangle, RefreshCw, WalletCards } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useNetWorth } from "@/features/net-worth/hooks/useNetWorth"
import { getMissingRateLinkState } from "@/features/net-worth/utils/missing-rate-link"

function formatAmount(value: string) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

export function NetWorthCard() {
  const { error, isLoading, refresh, result } = useNetWorth()

  if (isLoading) {
    return (
      <article aria-label="Loading net worth" className="tharwati-card min-h-48 animate-pulse p-6">
        <div className="h-4 w-24 rounded bg-[var(--color-surface-hover)]" />
        <div className="mt-7 h-9 w-48 rounded bg-[var(--color-surface-hover)]" />
        <div className="mt-5 h-4 w-36 rounded bg-[var(--color-surface-hover)]" />
      </article>
    )
  }

  if (error || !result) {
    return (
      <article className="tharwati-card min-h-48 p-6">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="size-5" />
          <h2 className="font-bold">Net Worth unavailable</h2>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          {error?.message ?? "Your net worth could not be calculated."}
        </p>
        <Button className="mt-5" variant="outline" onClick={() => void refresh()}>
          <RefreshCw /> Try Again
        </Button>
      </article>
    )
  }

  if (result.status === "incomplete") {
    const pairs = result.missingCurrencyPairs
      .map((pair) => `${pair.sourceCurrencyCode}/${pair.destinationCurrencyCode}`)
      .join(", ")
    return (
      <article className="tharwati-card min-h-48 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
            Net Worth
          </h2>
          <AlertTriangle className="size-5 text-amber-600" />
        </div>
        <p className="mt-6 text-xl font-bold text-[var(--color-text)]">Incomplete data</p>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Add a current exchange rate for {pairs} to calculate your complete net worth.
        </p>
        <Link
          to="/exchange-rates"
          state={getMissingRateLinkState(result)}
          className="mt-5 inline-flex rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-on-primary)]"
        >
          Add exchange rate
        </Link>
      </article>
    )
  }

  return (
    <article className="tharwati-card relative min-h-48 overflow-hidden p-6">
      <div aria-hidden="true" className="absolute -end-8 -top-8 size-28 rounded-full bg-[var(--color-primary-soft)]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
            Net Worth
          </h2>
          <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <WalletCards className="size-5" />
          </span>
        </div>
        <p className="mt-5 text-3xl font-black tracking-tight text-[var(--color-text)]" dir="ltr">
          {formatAmount(result.netWorth)} {result.baseCurrency}
        </p>
        {result.status === "empty" ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            <Link to="/cash" className="font-semibold text-[var(--color-primary)] hover:underline">
              Add a cash account
            </Link>{" "}
            to start tracking your wealth.
          </p>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            Across {result.accountCount} cash {result.accountCount === 1 ? "account" : "accounts"}
          </p>
        )}
      </div>
    </article>
  )
}
