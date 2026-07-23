import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type Period = "1M" | "3M" | "6M" | "1Y" | "2Y" | "3Y" | "ALL"

type PerformancePoint = {
  date: string
  value: number
}

const periods: { label: string; value: Period }[] = [
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1Y" },
  { label: "2Y", value: "2Y" },
  { label: "3Y", value: "3Y" },
  { label: "All", value: "ALL" },
]

const performanceData: Record<Period, PerformancePoint[]> = {
  "1M": [
    { date: "1 Jul", value: 23800 },
    { date: "5 Jul", value: 24150 },
    { date: "9 Jul", value: 23950 },
    { date: "13 Jul", value: 24700 },
    { date: "17 Jul", value: 25150 },
    { date: "21 Jul", value: 24900 },
    { date: "25 Jul", value: 25750 },
    { date: "30 Jul", value: 26380 },
  ],

  "3M": [
    { date: "May", value: 21400 },
    { date: "15 May", value: 22100 },
    { date: "Jun", value: 22800 },
    { date: "15 Jun", value: 22450 },
    { date: "Jul", value: 24100 },
    { date: "15 Jul", value: 25200 },
    { date: "Now", value: 26380 },
  ],

  "6M": [
    { date: "Feb", value: 18600 },
    { date: "Mar", value: 19750 },
    { date: "Apr", value: 20500 },
    { date: "May", value: 21600 },
    { date: "Jun", value: 22850 },
    { date: "Jul", value: 26380 },
  ],

  "1Y": [
    { date: "Aug", value: 14800 },
    { date: "Oct", value: 15650 },
    { date: "Dec", value: 17100 },
    { date: "Feb", value: 18700 },
    { date: "Apr", value: 20400 },
    { date: "Jun", value: 22900 },
    { date: "Jul", value: 26380 },
  ],

  "2Y": [
    { date: "2025 Q3", value: 8500 },
    { date: "2025 Q4", value: 10400 },
    { date: "2026 Q1", value: 12800 },
    { date: "2026 Q2", value: 16600 },
    { date: "2026 Q3", value: 19200 },
    { date: "2027 Q1", value: 22500 },
    { date: "Now", value: 26380 },
  ],

  "3Y": [
    { date: "2024", value: 5200 },
    { date: "2025", value: 9100 },
    { date: "2025 Q3", value: 12600 },
    { date: "2026", value: 15800 },
    { date: "2026 Q3", value: 19800 },
    { date: "2027", value: 23200 },
    { date: "Now", value: 26380 },
  ],

  ALL: [
    { date: "Start", value: 3000 },
    { date: "2023", value: 4800 },
    { date: "2024", value: 7300 },
    { date: "2025", value: 11200 },
    { date: "2026", value: 17100 },
    { date: "2027", value: 22100 },
    { date: "Now", value: 26380 },
  ],
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

type CustomTooltipProps = {
  active?: boolean
  payload?: Array<{
    value?: number
    payload?: PerformancePoint
  }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0]?.payload
  const value = payload[0]?.value

  if (!point || typeof value !== "number") {
    return null
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-lg">
      <p className="text-xs text-[var(--color-text-muted)]">
        {point.date}
      </p>

      <p className="mt-1 text-sm font-bold text-[var(--color-text-primary)]">
        {currencyFormatter.format(value)}
      </p>
    </div>
  )
}

export default function PerformanceChart() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("ALL")

  const data = performanceData[selectedPeriod]

  const performance = useMemo(() => {
    const firstValue = data[0]?.value ?? 0
    const lastValue = data[data.length - 1]?.value ?? 0
    const difference = lastValue - firstValue

    const percentage =
      firstValue > 0 ? (difference / firstValue) * 100 : 0

    return {
      currentValue: lastValue,
      difference,
      percentage,
      isPositive: difference >= 0,
    }
  }, [data])

  return (
    <article className="tharwati-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            Portfolio performance
          </h2>

          <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
            Track your portfolio performance over different periods
          </p>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <p className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
              {currencyFormatter.format(performance.currentValue)}
            </p>

            <span
              className={[
                "mb-1 rounded-full px-2.5 py-1 text-xs font-bold",
                performance.isPositive
                  ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                  : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
              ].join(" ")}
            >
              {performance.isPositive ? "+" : ""}
              {performance.percentage.toFixed(2)}%
            </span>
          </div>

          <p className="mt-2 text-sm font-medium text-[var(--color-text-muted)]">
            {performance.isPositive ? "+" : ""}
            {currencyFormatter.format(performance.difference)} during this period
          </p>
        </div>

        <div className="grid grid-cols-7 gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1">
          {periods.map((period) => {
            const isActive = selectedPeriod === period.value

            return (
              <button
                key={period.value}
                type="button"
                onClick={() => setSelectedPeriod(period.value)}
                className={[
                  "min-w-0 rounded-lg px-2 py-1.5 text-[11px] font-bold transition sm:px-2.5 sm:text-xs",
                  isActive
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]",
                ].join(" ")}
              >
                {period.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 h-[280px] w-full sm:h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 5,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient
                id="portfolioPerformanceGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--color-primary)"
                  stopOpacity={0.3}
                />

                <stop
                  offset="100%"
                  stopColor="var(--color-primary)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="4 6"
              opacity={0.55}
            />

            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "var(--color-text-muted)",
                fontSize: 12,
              }}
              tickMargin={12}
              minTickGap={24}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              width={45}
              tick={{
                fill: "var(--color-text-muted)",
                fontSize: 12,
              }}
              tickFormatter={(value: number) =>
                `$${Math.round(value / 1000)}k`
              }
              domain={["dataMin - 1000", "dataMax + 1000"]}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "var(--color-border-strong)",
                strokeDasharray: "4 4",
              }}
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-primary)"
              strokeWidth={3}
              fill="url(#portfolioPerformanceGradient)"
              activeDot={{
                r: 5,
                fill: "var(--color-primary)",
                stroke: "var(--color-surface)",
                strokeWidth: 3,
              }}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}