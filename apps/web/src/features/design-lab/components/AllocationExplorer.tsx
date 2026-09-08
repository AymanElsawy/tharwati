import { useMemo, useState } from "react"

type AllocationContributor = {
  name: string
  detail?: string
  value: number
  percentage: number
}

type AllocationCategory = {
  id: string
  label: string
  panelTitle: string
  percentage: number
  value: number
  color: string
  contributors: AllocationContributor[]
}

const allocationCategories: AllocationCategory[] = [
  {
    id: "equities",
    label: "Equities",
    panelTitle: "Top Equity Holdings",
    percentage: 42,
    value: 1_828_180,
    color: "#23705f",
    contributors: [
      { name: "NVIDIA", detail: "NVDA", value: 621_581, percentage: 34 },
      { name: "S&P 500 ETF", detail: "VOO", value: 511_890, percentage: 28 },
      { name: "Saudi Aramco", detail: "2222", value: 402_200, percentage: 22 },
      { name: "Apple", detail: "AAPL", value: 292_509, percentage: 16 },
    ],
  },
  {
    id: "cash",
    label: "Cash",
    panelTitle: "Top Cash Accounts",
    percentage: 18,
    value: 783_506,
    color: "#3e6f91",
    contributors: [
      { name: "Primary Bank", detail: "Current account", value: 391_753, percentage: 50 },
      { name: "Savings Account", detail: "Savings", value: 235_052, percentage: 30 },
      { name: "Cash Reserve", detail: "Liquidity reserve", value: 156_701, percentage: 20 },
    ],
  },
  {
    id: "real-estate",
    label: "Real Estate",
    panelTitle: "Top Real Estate Holdings",
    percentage: 14,
    value: 609_393,
    color: "#9a6049",
    contributors: [
      { name: "Residential Property", detail: "Riyadh", value: 274_227, percentage: 45 },
      { name: "Commercial Property", detail: "Income property", value: 182_818, percentage: 30 },
      { name: "REITs", detail: "Listed funds", value: 91_409, percentage: 15 },
      { name: "Land", detail: "Undeveloped", value: 60_939, percentage: 10 },
    ],
  },
  {
    id: "gold",
    label: "Gold",
    panelTitle: "Top Gold Holdings",
    percentage: 10,
    value: 435_281,
    color: "#b08a3f",
    contributors: [
      { name: "24K Gold", detail: "Physical", value: 174_112, percentage: 40 },
      { name: "21K Gold", detail: "Physical", value: 108_820, percentage: 25 },
      { name: "Gold ETF", detail: "Listed fund", value: 87_056, percentage: 20 },
      { name: "Gold Bars", detail: "Bullion", value: 65_293, percentage: 15 },
    ],
  },
  {
    id: "fixed-income",
    label: "Fixed Income",
    panelTitle: "Top Fixed Income Holdings",
    percentage: 7,
    value: 304_697,
    color: "#6f7d43",
    contributors: [
      { name: "Government Bonds", detail: "Sovereign", value: 106_644, percentage: 35 },
      { name: "Corporate Bonds", detail: "Investment grade", value: 76_174, percentage: 25 },
      { name: "Term Deposits", detail: "12 month", value: 67_033, percentage: 22 },
      { name: "Sukuk", detail: "Sharia-compliant", value: 54_846, percentage: 18 },
    ],
  },
  {
    id: "crypto",
    label: "Crypto",
    panelTitle: "Top Crypto Holdings",
    percentage: 5,
    value: 217_641,
    color: "#67588c",
    contributors: [
      { name: "Bitcoin", detail: "BTC", value: 130_585, percentage: 60 },
      { name: "Ethereum", detail: "ETH", value: 65_292, percentage: 30 },
      { name: "Other Digital Assets", value: 21_764, percentage: 10 },
    ],
  },
  {
    id: "other",
    label: "Other",
    panelTitle: "Top Contributors",
    percentage: 4,
    value: 174_112,
    color: "#71767d",
    contributors: [
      { name: "Private Business", detail: "Private asset", value: 104_467, percentage: 60 },
      { name: "Collectibles", detail: "Alternative asset", value: 43_528, percentage: 25 },
      { name: "Other Assets", value: 26_117, percentage: 15 },
    ],
  },
]

const allocationTotal = allocationCategories.reduce(
  (total, category) => total + category.percentage,
  0,
)

function formatBaseCurrency(value: number) {
  return `SAR ${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value)}`
}

export function AllocationExplorer() {
  const defaultCategory = allocationCategories.reduce((largest, category) =>
    category.percentage > largest.percentage ? category : largest,
  )
  const [selectedId, setSelectedId] = useState(defaultCategory.id)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const selectedCategory =
    allocationCategories.find((category) => category.id === selectedId) ??
    defaultCategory
  const hoveredCategory = useMemo(
    () =>
      allocationCategories.find((category) => category.id === hoveredId) ??
      null,
    [hoveredId],
  )
  const emphasizedId = hoveredId ?? selectedId

  function selectCategory(categoryId: string) {
    setSelectedId(categoryId)
  }

  return (
    <div className="grid bg-[var(--color-surface)] lg:grid-cols-2">
      <div className="p-6 sm:p-8">
        <h3 className="text-base font-bold text-[var(--color-text)]">
          Asset Allocation
        </h3>

        <div className="mt-8 flex flex-col items-center gap-8 sm:flex-row">
          <div className="relative size-44 shrink-0">
            <svg
              viewBox="0 0 120 120"
              className="size-full -rotate-90"
              role="img"
              aria-label={`Portfolio allocation totaling ${allocationTotal}%`}
            >
              <circle
                cx="60"
                cy="60"
                r="48"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="12"
              />
              {allocationCategories.map((category) => {
                const precedingPercentage = allocationCategories
                  .slice(0, allocationCategories.indexOf(category))
                  .reduce((total, item) => total + item.percentage, 0)
                const isEmphasized = emphasizedId === category.id
                const isDimmed = emphasizedId !== null && !isEmphasized

                return (
                  <circle
                    key={category.id}
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    pathLength="100"
                    stroke={category.color}
                    strokeWidth={isEmphasized ? 14 : 12}
                    strokeDasharray={`${category.percentage} ${100 - category.percentage}`}
                    strokeDashoffset={-precedingPercentage}
                    className="cursor-pointer transition-[opacity,stroke-width] duration-150 focus:outline-none"
                    opacity={isDimmed ? 0.34 : 1}
                    tabIndex={0}
                    role="button"
                    aria-label={`${category.label}, ${category.percentage}%, ${formatBaseCurrency(category.value)}`}
                    aria-pressed={selectedId === category.id}
                    onMouseEnter={() => setHoveredId(category.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setHoveredId(category.id)}
                    onBlur={() => setHoveredId(null)}
                    onClick={() => selectCategory(category.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        selectCategory(category.id)
                      }
                    }}
                  />
                )
              })}
            </svg>

            <div
              className="pointer-events-none absolute inset-5 flex flex-col items-center justify-center rounded-full bg-[var(--color-surface)] text-center"
              aria-live="polite"
            >
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {hoveredCategory ? hoveredCategory.label : selectedCategory.label}
              </span>
              <strong className="mt-1 text-2xl font-black tabular-nums text-[var(--color-text)]">
                {hoveredCategory
                  ? `${hoveredCategory.percentage}%`
                  : `${selectedCategory.percentage}%`}
              </strong>
              <span className="mt-1 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                {formatBaseCurrency(
                  hoveredCategory?.value ?? selectedCategory.value,
                )}
              </span>
            </div>
          </div>

          <div className="w-full" role="list" aria-label="Allocation categories">
            {allocationCategories.map((category) => {
              const isEmphasized = emphasizedId === category.id

              return (
                <button
                  key={category.id}
                  type="button"
                  role="listitem"
                  aria-pressed={selectedId === category.id}
                  onMouseEnter={() => setHoveredId(category.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(category.id)}
                  onBlur={() => setHoveredId(null)}
                  onClick={() => selectCategory(category.id)}
                  className={[
                    "flex w-full items-center justify-between gap-4 border-b border-[var(--color-border)]/60 py-2.5 text-start transition-opacity duration-150 last:border-b-0",
                    emphasizedId !== null && !isEmphasized
                      ? "opacity-45"
                      : "opacity-100",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{category.label}</span>
                  </span>
                  <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">
                    {category.percentage}%
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)]/60 p-6 sm:p-8 lg:border-s lg:border-t-0">
        <div
          key={selectedCategory.id}
          className="animate-in fade-in slide-in-from-right-1 duration-200"
        >
          <h3 className="text-base font-bold text-[var(--color-text)]">
            {selectedCategory.panelTitle}
          </h3>

          {selectedCategory.contributors.length > 0 ? (
            <div className="mt-6 divide-y divide-[var(--color-border)]/60">
              {selectedCategory.contributors.map((contributor) => (
                <div
                  key={contributor.name}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--color-text)]">
                      {contributor.name}
                    </p>
                    {contributor.detail ? (
                      <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
                        {contributor.detail}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      {formatBaseCurrency(contributor.value)}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-[var(--color-text-secondary)]">
                      {contributor.percentage}% of {selectedCategory.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 border-y border-[var(--color-border)]/60 py-10 text-center">
              <p className="text-sm font-semibold text-[var(--color-text)]">
                No contributors yet
              </p>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                This category has no portfolio positions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
