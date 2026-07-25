import type { DashboardAllocation } from "@/features/dashboard/types/dashboard"

const labels: Record<DashboardAllocation["group"], string> = {
  stocks: "Stocks",
  etfs: "ETFs",
  cash: "Cash",
  other: "Other",
}

export function PortfolioAllocationCard({
  allocation,
}: {
  allocation: DashboardAllocation[]
}) {
  return (
    <article className="tharwati-card p-6">
      <h2 className="text-xl font-bold">Portfolio Allocation</h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Current base-currency market values
      </p>
      {allocation.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--color-text-secondary)]">
          Allocation becomes available when cash or priced holdings exist.
        </p>
      ) : (
        <div className="mt-7 space-y-5">
          {allocation.map((item) => (
            <div key={item.group}>
              <div className="mb-2 flex justify-between gap-4 text-sm">
                <span className="font-semibold">{labels[item.group]}</span>
                <span className="font-bold" dir="ltr">
                  {new Intl.NumberFormat(undefined, {
                    maximumFractionDigits: 2,
                  }).format(Number(item.percentage))}
                  %
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)]"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
