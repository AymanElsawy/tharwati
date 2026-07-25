import type { LucideIcon } from "lucide-react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

interface GoalCardProps {
  icon: LucideIcon
  isSelected: boolean
  label: string
  onToggle: () => void
}

export function GoalCard({
  icon: Icon,
  isSelected,
  label,
  onToggle,
}: GoalCardProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={cn(
        "group relative flex min-h-28 flex-col items-start justify-between rounded-2xl border p-4 text-start transition duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--color-primary-soft)]",
        isSelected
          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] shadow-sm"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-md",
      )}
      onClick={onToggle}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl transition",
          isSelected
            ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
            : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]",
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>

      <span className="mt-4 pe-7 text-sm font-semibold text-[var(--color-text)] sm:text-base">
        {label}
      </span>

      {isSelected && (
        <span className="absolute end-3 top-3 flex size-6 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
          <Check aria-hidden="true" className="size-3.5" />
        </span>
      )}
    </button>
  )
}
