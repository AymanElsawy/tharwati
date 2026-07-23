type SummaryCardVariant =
  | "net-worth"
  | "investments"
  | "cash"
  | "change"

type SummaryCardProps = {
  title: string
  value: string
  change: string
  description: string
  changeType?: "positive" | "neutral" | "negative"
  variant?: SummaryCardVariant
}

const variantBackgrounds: Record<SummaryCardVariant, string> = {
  "net-worth": "var(--color-card-net-worth)",
  investments: "var(--color-card-investments)",
  cash: "var(--color-card-cash)",
  change: "var(--color-card-change)",
}

export function SummaryCard({
  title,
  value,
  change,
  description,
  changeType = "neutral",
  variant = "net-worth",
}: SummaryCardProps) {
  const changeStyles = {
    positive:
      "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    neutral:
      "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]",
    negative:
      "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  }

  return (
    <article
      className="tharwati-card tharwati-card-hover p-6"
      style={{
        background: variantBackgrounds[variant],
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="font-semibold text-[var(--color-text-secondary)]">
          {title}
        </p>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${changeStyles[changeType]}`}
        >
          {change}
        </span>
      </div>

      <p className="mt-5 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
        {value}
      </p>

      <p className="mt-2 text-sm font-medium leading-6 text-[var(--color-text-muted)]">
        {description}
      </p>
    </article>
  )
}