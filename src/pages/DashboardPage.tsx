import { SummaryCard } from "../components/dashboard/SummaryCard"
import PerformanceChart from "../components/dashboard/PerformanceChart"

const summaryCards = [
  {
    title: "Net Worth",
    value: "$128,540",
    change: "+4.8%",
    description: "Total value of all your assets",
    changeType: "positive" as const,
    variant: "net-worth" as const,
  },
  {
    title: "Investments",
    value: "$82,350",
    change: "+$2,420",
    description: "Stocks, ETFs and bonds",
    changeType: "positive" as const,
    variant: "investments" as const,
  },
  {
    title: "Cash",
    value: "$18,690",
    change: "14.5%",
    description: "Available cash and deposits",
    changeType: "neutral" as const,
    variant: "cash" as const,
  },
  {
    title: "Monthly Change",
    value: "+$3,240",
    change: "+2.6%",
    description: "Change during this month",
    changeType: "positive" as const,
    variant: "change" as const,
  },
]

const allocationItems = [
  {
    label: "US Market",
    value: 30,
  },
  {
    label: "Growth",
    value: 32,
  },
  {
    label: "Dividend & Value",
    value: 18,
  },
  {
    label: "International",
    value: 15,
  },
  {
    label: "Bonds",
    value: 5,
  },
]

const recentActivities = [
  {
    title: "Bought VOO",
    description: "1 share added to your portfolio",
    value: "-$630.00",
    date: "Today",
  },
  {
    title: "SCHD dividend",
    description: "Dividend payment received",
    value: "+$22.40",
    date: "Yesterday",
  },
  {
    title: "Added cash",
    description: "Deposit to investment account",
    value: "+$500.00",
    date: "3 days ago",
  },
]

export function DashboardPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
          Financial overview
        </p>

        <h1 className="tharwati-page-title mt-2">
          Your wealth at a glance
        </h1>

        <p className="tharwati-page-description">
          Track your net worth, portfolio allocation and financial progress.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.title}
            title={card.title}
            value={card.value}
            change={card.change}
            description={card.description}
            changeType={card.changeType}
            variant={card.variant}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <PerformanceChart />

        <article className="tharwati-card p-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              Asset allocation
            </h2>

            <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
              Current portfolio distribution
            </p>
          </div>

          <div className="mt-7 space-y-5">
            {allocationItems.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {item.label}
                  </span>

                  <span className="text-sm font-bold text-[var(--color-text-secondary)]">
                    {item.value}%
                  </span>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)]"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="tharwati-button-secondary mt-7 w-full"
          >
            View portfolio
          </button>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <article className="tharwati-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-5">
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                Recent activity
              </h2>

              <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
                Latest changes across your accounts
              </p>
            </div>

            <button
              type="button"
              className="text-sm font-semibold text-[var(--color-primary)] hover:underline"
            >
              View all
            </button>
          </div>

          <div>
            {recentActivities.map((activity, index) => (
              <div
                key={`${activity.title}-${activity.date}`}
                className={[
                  "flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between",
                  index !== recentActivities.length - 1
                    ? "border-b border-[var(--color-border)]"
                    : "",
                ].join(" ")}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] font-bold text-[var(--color-primary)]">
                    $
                  </div>

                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">
                      {activity.title}
                    </p>

                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {activity.description}
                    </p>
                  </div>
                </div>

                <div className="pl-[60px] text-left sm:pl-0 sm:text-right">
                  <p
                    className={[
                      "font-bold",
                      activity.value.startsWith("+")
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-text-primary)]",
                    ].join(" ")}
                  >
                    {activity.value}
                  </p>

                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {activity.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="tharwati-card p-6">
          <div className="flex h-full flex-col">
            <div>
              <p className="text-sm font-semibold text-[var(--color-primary)]">
                Retirement goal
              </p>

              <h2 className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
                $1,200,000
              </h2>

              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Target net worth
              </p>
            </div>

            <div className="mt-8">
              <div className="flex items-end justify-between gap-4">
                <span className="text-4xl font-bold tracking-tight text-[var(--color-primary)]">
                  10.7%
                </span>

                <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                  $128,540 achieved
                </span>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                <div className="h-full w-[10.7%] rounded-full bg-[var(--color-primary)]" />
              </div>
            </div>

            <div className="mt-8 rounded-xl bg-[var(--color-primary-soft)] p-4">
              <p className="text-sm leading-6 text-[var(--color-primary)]">
                Continue investing consistently to increase your progress
                toward financial independence.
              </p>
            </div>

            <button
              type="button"
              className="tharwati-button-primary mt-auto w-full"
            >
              Review goals
            </button>
          </div>
        </article>
      </div>
    </section>
  )
}
