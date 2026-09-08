import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  Landmark,
  LineChart,
  RefreshCw,
  ShieldCheck,
  Target,
  WalletCards,
  type LucideIcon,
} from "lucide-react"

import { AllocationExplorer } from "@/features/design-lab/components/AllocationExplorer"
import { HeroV3 } from "@/features/design-lab/components/HeroV3"
import { WealthInsights } from "@/features/insights/components/WealthInsights"
import type { WealthInsightSnapshot } from "@/features/insights/types/wealth-insight"

type ItemCardProps = {
  icon: LucideIcon
  eyebrow?: string
  title: string
  description: string
  meta?: string
}

const focusItems: ItemCardProps[] = [
  {
    icon: CircleDollarSign,
    eyebrow: "Due today",
    title: "Add July investment",
    description: "Keep your monthly contribution plan on track.",
    meta: "Continue",
  },
  {
    icon: RefreshCw,
    eyebrow: "2 rates pending",
    title: "Update exchange rates",
    description: "Refresh SAR and EGP rates for accurate reporting.",
    meta: "Review",
  },
  {
    icon: LineChart,
    eyebrow: "Quarterly check-in",
    title: "Review portfolio allocation",
    description: "Compare your current mix with your long-term plan.",
    meta: "Open",
  },
]

const wealthSnapshot: WealthInsightSnapshot = {
  allocation: {
    cashPercent: "32",
    preferredCashMaximumPercent: "24",
  },
  concentration: {
    holdingName: "NVIDIA",
    holdingPercent: "31",
    warningThresholdPercent: "25",
  },
  diversification: {
    sectorName: "Technology",
    equityPercent: "39",
    warningThresholdPercent: "35",
  },
  cashFlow: {
    savingsRatePercent: "24",
    targetSavingsRatePercent: "20",
  },
  goalProgress: {
    goalName: "Financial Freedom",
    monthsAhead: 14,
  },
  currencyExposure: {
    currencyCode: "USD",
    exposurePercent: "74",
    warningThresholdPercent: "60",
  },
  performance: {
    benchmarkDifferencePercent: "3.2",
  },
  idleCash: {
    amount: "180000",
    formattedAmount: "SAR 180,000",
    idleDays: 94,
    minimumIdleDays: 90,
  },
  missingData: {
    missingPriceCount: 0,
    missingExchangeRateCount: 0,
  },
}

const goals = [
  {
    name: "Financial Freedom",
    amount: "850K / 1.2M SAR",
    progress: 71,
    target: "Target 2035",
  },
  {
    name: "House",
    amount: "320K / 600K SAR",
    progress: 53,
    target: "Target 2029",
  },
  {
    name: "Emergency Fund",
    amount: "96K / 120K SAR",
    progress: 80,
    target: "10 months covered",
  },
]

const accounts = [
  {
    icon: Landmark,
    name: "Primary Bank",
    type: "Bank account",
    amount: "184,200 SAR",
  },
  {
    icon: LineChart,
    name: "International Brokerage",
    type: "Brokerage",
    amount: "612,480 USD",
  },
  {
    icon: WalletCards,
    name: "Cash Reserve",
    type: "Cash",
    amount: "72,500 SAR",
  },
  {
    icon: Building2,
    name: "Property Fund",
    type: "Investment account",
    amount: "340,000 SAR",
  },
]

const activities = [
  {
    icon: ArrowUpRight,
    title: "NVDA investment",
    account: "International Brokerage",
    date: "Today, 10:42 AM",
    amount: "-4,020 USD",
  },
  {
    icon: ArrowDownLeft,
    title: "Monthly contribution",
    account: "Primary Bank",
    date: "Yesterday",
    amount: "+12,000 SAR",
  },
  {
    icon: ArrowUpRight,
    title: "Gold investment",
    account: "International Brokerage",
    date: "Jul 21",
    amount: "-8,450 SAR",
  },
  {
    icon: ArrowDownLeft,
    title: "Dividend received",
    account: "International Brokerage",
    date: "Jul 18",
    amount: "+286 USD",
  },
  {
    icon: ArrowUpRight,
    title: "Property fund contribution",
    account: "Property Fund",
    date: "Jul 15",
    amount: "-15,000 SAR",
  },
]

function SectionHeading({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <header className="mb-6 sm:mb-8">
      <h2 className="text-2xl font-black tracking-[-0.035em] text-[var(--color-text)] sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          {description}
        </p>
      ) : null}
    </header>
  )
}

export function OverviewScreen() {
  return (
    <div className="pb-12">
      <HeroV3 />

      <section className="mt-7 sm:mt-8">
        <SectionHeading
          title="Today’s Focus"
          description="A short list of actions that keep your wealth plan current."
        />
        <div className="border-y border-[var(--color-border)]/70">
          {focusItems.map((item, index) => (
            <article
              key={item.title}
              className="grid items-center gap-4 border-b border-[var(--color-border)]/50 py-4 last:border-b-0 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]"
            >
              <span className="text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-bold tracking-[-0.015em] text-[var(--color-text)]">
                    {item.title}
                  </h3>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {item.eyebrow}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {item.description}
                </p>
              </div>
              <p className="ps-[3.5rem] text-sm font-semibold text-[var(--color-primary)] sm:ps-0">
                {item.meta} <span aria-hidden="true">→</span>
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 sm:mt-14">
        <SectionHeading
          title="Wealth Insights"
          description="Contextual observations based on your current financial picture."
        />
        <WealthInsights snapshot={wealthSnapshot} />
      </section>

      <section className="mt-16 sm:mt-20">
        <SectionHeading title="Goals" />
        <div className="grid border-y border-[var(--color-border)]/70 md:grid-cols-3">
          {goals.map((goal) => (
            <article
              key={goal.name}
              className="border-b border-[var(--color-border)]/50 px-1 py-7 last:border-b-0 md:border-b-0 md:border-e md:px-7 md:first:ps-1 md:last:border-e-0 md:last:pe-1"
            >
              <div className="flex items-center gap-2 text-[var(--color-primary)]">
                {goal.name === "Emergency Fund" ? (
                  <ShieldCheck size={17} strokeWidth={1.7} />
                ) : (
                  <Target size={17} strokeWidth={1.7} />
                )}
                <span className="text-xs font-semibold uppercase tracking-[0.13em]">
                  {goal.target}
                </span>
              </div>
              <h3 className="mt-7 text-xl font-black tracking-[-0.025em] text-[var(--color-text)]">
                {goal.name}
              </h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {goal.amount}
              </p>
              <div className="mt-8 flex items-center gap-4">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)]"
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
                <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">
                  {goal.progress}%
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16 sm:mt-20">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)]/70 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
              Analysis
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--color-text)] sm:text-3xl">
              Portfolio Snapshot
            </h2>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Current allocation · All accounts
          </p>
        </header>
        <AllocationExplorer />
      </section>

      <section className="mt-14 sm:mt-16">
        <SectionHeading title="Accounts Snapshot" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {accounts.map(({ icon: Icon, name, type, amount }) => (
            <article
              key={name}
              className="flex items-center gap-4 rounded-xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] px-4 py-4"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-primary)]">
                <Icon size={17} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[var(--color-text-secondary)]">
                  {type}
                </p>
                <h3 className="mt-0.5 truncate text-sm font-bold text-[var(--color-text)]">
                  {name}
                </h3>
              </div>
              <p className="shrink-0 text-end text-sm font-bold tracking-[-0.02em] text-[var(--color-text)]">
                {amount}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16 sm:mt-20">
        <SectionHeading title="Recent Activity" />
        <div className="relative">
          <div
            className="absolute bottom-5 start-[1.1rem] top-5 w-px bg-[var(--color-border)]/70"
            aria-hidden="true"
          />
          <div>
            {activities.map(
              ({ icon: Icon, title, account, date, amount }) => (
                <article
                  key={`${title}-${date}`}
                  className="relative flex items-center gap-4 py-4"
                >
                  <div className="z-[1] flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-secondary)]">
                    <Icon size={17} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--color-text)]">
                      {title}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
                      {account} · {date}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-[var(--color-text)]">
                    {amount}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
