import {
  Banknote,
  Briefcase,
  Building2,
  Coins,
  Landmark,
  LayoutGrid,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"

import type { AccountTypeCode } from "./account-form"

export type AccountTypeVisual = {
  icon: LucideIcon
  selected: string
  idle: string
  iconWrap: string
}

export const accountTypeVisuals: Record<AccountTypeCode, AccountTypeVisual> = {
  cash: {
    icon: Banknote,
    selected: "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:border-emerald-400",
    iconWrap: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  },
  bank: {
    icon: Landmark,
    selected: "border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:border-blue-400",
    iconWrap: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  },
  brokerage: {
    icon: TrendingUp,
    selected: "border-violet-500 bg-violet-50 text-violet-900 dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:border-violet-400",
    iconWrap: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  },
  gold: {
    icon: Coins,
    selected: "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:border-amber-400",
    iconWrap: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  },
  real_estate: {
    icon: Building2,
    selected: "border-teal-500 bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:border-teal-400",
    iconWrap: "bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300",
  },
  business: {
    icon: Briefcase,
    selected: "border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:border-indigo-400",
    iconWrap: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300",
  },
  other: {
    icon: LayoutGrid,
    selected: "border-slate-500 bg-slate-50 text-slate-900 dark:border-slate-400 dark:bg-slate-800/60 dark:text-slate-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-primary)] hover:border-slate-400",
    iconWrap: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
}
