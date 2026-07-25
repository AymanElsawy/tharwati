import { WalletCards } from "lucide-react"

import { useCashBalances } from "@/features/account-balances/hooks/useCashBalances"

function formatBalance(value: string, currencyCode: string) {
  return `${currencyCode} ${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))}`
}

export function CashBalancesCard() {
  const { balances, error, isLoading } = useCashBalances()

  return (
    <article className="tharwati-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Cash
        </p>
        <WalletCards className="size-5 text-[var(--color-primary)]" />
      </div>
      {isLoading ? (
        <div className="mt-4 h-8 animate-pulse rounded-lg bg-[var(--color-surface-muted)]" />
      ) : error ? (
        <p className="mt-4 text-sm font-semibold text-red-600">
          Cash balances unavailable
        </p>
      ) : balances.length === 0 ? (
        <p className="mt-4 text-2xl font-black">—</p>
      ) : (
        <div className="mt-4 space-y-1">
          {balances.map((balance) => (
            <p
              key={balance.currencyCode}
              className="text-xl font-black"
              dir="ltr"
            >
              {formatBalance(
                balance.currentBalance,
                balance.currencyCode,
              )}
            </p>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
        Available across active cash accounts
      </p>
    </article>
  )
}
