import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useMemo, useState } from "react"

import { useTranslation } from "../../../i18n/useTranslation"
import type {
  HoldingSort,
  HoldingSortKey,
  HoldingView,
} from "../types/holding-view"
import { sortHoldingViews } from "../utils/holding-sort"
import { HoldingRow } from "./HoldingRow"

type Props = {
  holdings: HoldingView[]
}

const columns: Array<{
  key: HoldingSortKey
  label:
    | "holdings.table.asset"
    | "holdings.table.account"
    | "holdings.table.quantity"
    | "holdings.table.averageCost"
    | "holdings.table.totalCost"
}> = [
  { key: "asset", label: "holdings.table.asset" },
  { key: "account", label: "holdings.table.account" },
  { key: "quantity", label: "holdings.table.quantity" },
  { key: "averageCost", label: "holdings.table.averageCost" },
  { key: "totalCost", label: "holdings.table.totalCost" },
]

export function HoldingTable({ holdings }: Props) {
  const { t } = useTranslation()
  const [sort, setSort] = useState<HoldingSort>({
    key: "asset",
    direction: "ascending",
  })
  const sortedHoldings = useMemo(
    () => sortHoldingViews(holdings, sort),
    [holdings, sort],
  )

  function toggleSort(key: HoldingSortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }))
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse">
          <thead className="bg-[var(--color-surface-hover)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
            <tr>
              {columns.map((column) => {
                const active = sort.key === column.key
                const Icon = active
                  ? sort.direction === "ascending"
                    ? ArrowUp
                    : ArrowDown
                  : ArrowUpDown
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      active ? sort.direction : "none"
                    }
                    className="px-4 py-3 text-start"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-1.5 rounded-md font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      {t(column.label)}
                      <Icon size={13} aria-hidden="true" />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {sortedHoldings.map((view) => (
              <HoldingRow key={view.holding.id} view={view} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-[var(--color-border)] md:hidden">
        {sortedHoldings.map((view) => (
          <HoldingRow key={view.holding.id} view={view} mobile />
        ))}
      </div>
    </div>
  )
}
