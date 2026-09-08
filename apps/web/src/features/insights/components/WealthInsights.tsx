import {
  AlertTriangle,
  BadgeDollarSign,
  CircleDollarSign,
  Gauge,
  Globe2,
  Lightbulb,
  ShieldAlert,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"
import { useMemo } from "react"
import { Link } from "react-router-dom"

import { generateWealthInsights } from "@/features/insights/engine/wealth-insight.engine"
import type {
  WealthInsight,
  WealthInsightCategory,
  WealthInsightSeverity,
  WealthInsightSnapshot,
} from "@/features/insights/types/wealth-insight"

const categoryIcons: Record<WealthInsightCategory, LucideIcon> = {
  allocation: Gauge,
  risk: ShieldAlert,
  diversification: Globe2,
  cash_flow: CircleDollarSign,
  goals: Target,
  currency: BadgeDollarSign,
  performance: TrendingUp,
  opportunities: Lightbulb,
  warnings: AlertTriangle,
}

const categoryLabels: Record<WealthInsightCategory, string> = {
  allocation: "Allocation",
  risk: "Risk",
  diversification: "Diversification",
  cash_flow: "Cash Flow",
  goals: "Goals",
  currency: "Currency",
  performance: "Performance",
  opportunities: "Opportunities",
  warnings: "Warnings",
}

const severityLabels: Record<WealthInsightSeverity, string> = {
  info: "Info",
  good: "Good",
  warning: "Warning",
}

const severityStyles: Record<
  WealthInsightSeverity,
  {
    border: string
    icon: string
    label: string
    strokeWidth: number
  }
> = {
  info: {
    border: "border-[var(--color-border)]/50",
    icon: "text-[var(--color-primary)]",
    label: "text-[var(--color-text-muted)]",
    strokeWidth: 1.7,
  },
  good: {
    border: "border-emerald-600/35 dark:border-emerald-400/35",
    icon: "text-emerald-700 dark:text-emerald-400",
    label: "text-emerald-700 dark:text-emerald-400",
    strokeWidth: 2,
  },
  warning: {
    border: "border-amber-600/50 dark:border-amber-400/45",
    icon: "text-amber-700 dark:text-amber-400",
    label: "text-amber-800 dark:text-amber-300",
    strokeWidth: 2.2,
  },
}

function InsightCardContent({ insight }: { insight: WealthInsight }) {
  const Icon = categoryIcons[insight.category]
  const styles = severityStyles[insight.severity]

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon
            size={17}
            strokeWidth={styles.strokeWidth}
            className={styles.icon}
          />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
            {categoryLabels[insight.category]}
          </p>
        </div>
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${styles.label}`}
        >
          {severityLabels[insight.severity]}
        </span>
      </div>

      <h3 className="mt-6 text-lg font-bold leading-7 tracking-[-0.02em] text-[var(--color-text)]">
        {insight.headline}
      </h3>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        {insight.explanation}
      </p>

      {insight.action ? (
        <span className="mt-5 inline-flex text-sm font-semibold text-[var(--color-primary)] transition-opacity group-hover:opacity-70">
          {insight.action.label}
          <span className="ms-1" aria-hidden="true">
            →
          </span>
        </span>
      ) : null}
    </>
  )
}

export function WealthInsights({
  snapshot,
  maximumVisible = 3,
}: {
  snapshot: WealthInsightSnapshot
  maximumVisible?: number
}) {
  const insights = useMemo(
    () => generateWealthInsights(snapshot, maximumVisible),
    [maximumVisible, snapshot],
  )

  return <WealthInsightCards insights={insights} />
}

export function WealthInsightCards({
  insights,
}: {
  insights: WealthInsight[]
}) {
  return (
    <div className="grid gap-5 md:grid-cols-3" aria-live="polite">
      {insights.map((insight) => {
        const styles = severityStyles[insight.severity]
        const cardClasses = [
          "animate-in fade-in slide-in-from-bottom-1 rounded-xl border bg-[var(--color-surface)] px-6 py-7 duration-200",
          styles.border,
        ].join(" ")

        return insight.action ? (
          <Link
            key={insight.id}
            to={insight.action.href}
            aria-label={`${insight.headline} ${insight.action.label}`}
            className={`${cardClasses} group cursor-pointer transition-[border-color,opacity] hover:border-[var(--color-primary)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]`}
          >
            <InsightCardContent insight={insight} />
          </Link>
        ) : (
          <article key={insight.id} className={cardClasses}>
            <InsightCardContent insight={insight} />
          </article>
        )
      })}
    </div>
  )
}
