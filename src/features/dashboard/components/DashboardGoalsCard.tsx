import { CalendarDays } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { GoalMoney } from "@/features/goals/components/GoalMoney"
import { formatGoalMoney } from "@/features/goals/components/goal-money"
import { compareDecimals } from "@/lib/financial-calculations/decimal"
import { formatLocalCalendarDate } from "@/lib/formatting/local-date-time"
import { formatPortfolioPercent } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import { useDashboardGoals } from "../hooks/useDashboardGoals"

function SkeletonRows() {
  return (
    <div className="divide-y divide-[var(--border-quiet)]" role="status">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)_minmax(10rem,0.55fr)] lg:items-center">
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-[var(--color-surface-hover)]" />
            <div className="h-3 w-28 animate-pulse rounded bg-[var(--color-surface-hover)]" />
          </div>
          <div className="h-3 w-44 max-w-full animate-pulse rounded bg-[var(--color-surface-hover)]" />
          <div className="h-1 w-32 max-w-full animate-pulse rounded bg-[var(--color-surface-hover)]" />
        </div>
      ))}
    </div>
  )
}

export function DashboardGoalsCard() {
  const { t, language } = useTranslation()
  const { model, isLoading, isError, retry } = useDashboardGoals()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const today = new Date().toISOString().slice(0, 10)

  return (
    <section className="tharwati-card p-5 sm:p-6" aria-labelledby="dashboard-goals-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="dashboard-goals-title" className="tharwati-section-title">
            {t("dashboard.goals.title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.goals.manualTracking")}
          </p>
        </div>
        <Link
          to="/goals"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary)] hover:underline"
        >
          {t("dashboard.goals.viewAll")}
        </Link>
      </div>

      <div className="mt-3 sm:mt-5">
        {isLoading ? (
          <SkeletonRows />
        ) : isError || !model ? (
          <div className="rounded-2xl bg-[var(--color-surface-muted)] p-5 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("dashboard.goals.unavailable")}
            </p>
            <Button className="mt-3 min-h-11" variant="outline" onClick={() => void retry()}>
              {t("dashboard.goals.retry")}
            </Button>
          </div>
        ) : model.goals.length === 0 ? (
          <div className="rounded-2xl bg-[var(--color-surface-muted)] p-5 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t(model.hasAnyGoals ? "dashboard.goals.noActive" : "dashboard.goals.empty")}
            </p>
            <Link
              to="/goals"
              className="mt-3 inline-flex min-h-11 items-center font-semibold text-[var(--color-primary)] hover:underline"
            >
              {t(model.hasAnyGoals ? "dashboard.goals.viewAll" : "dashboard.goals.createFirst")}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-quiet)]">
            {model.goals.map((goal) => {
              const isOverdue = goal.target_date !== null && goal.target_date < today
              return (
                <li key={goal.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,auto)] lg:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)_minmax(10rem,0.55fr)] lg:items-center">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold">{goal.name}</h3>
                      {goal.target_date ? (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                          <CalendarDays aria-hidden="true" size={14} />
                          <span>
                            {t(isOverdue ? "dashboard.goals.overdue" : "dashboard.goals.due", {
                              date: formatLocalCalendarDate(goal.target_date, locale),
                            })}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <div className="min-w-0 text-sm text-[var(--color-text-secondary)]">
                      <p dir="ltr">
                        <GoalMoney value={goal.fundedAmount} currencyCode={goal.currency_code} locale={locale} />
                        {" / "}
                        <GoalMoney value={goal.target_amount} currencyCode={goal.currency_code} locale={locale} />
                      </p>
                      {compareDecimals(goal.surplusAmount, "0") === 1 ? (
                        <p className="mt-1 text-xs font-semibold text-[var(--color-primary)]">
                          {t("dashboard.goals.overTarget", {
                            amount: formatGoalMoney(
                              goal.surplusAmount,
                              goal.currency_code,
                              locale
                            ),
                          })}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 items-center gap-3 sm:col-span-2 lg:col-span-1">
                      <span className="shrink-0 text-sm font-bold tabular-nums" dir="ltr">
                        {formatPortfolioPercent(goal.progressPercent, locale)}
                      </span>
                      <Progress className="min-w-0 flex-1" value={Number(goal.displayPercent)} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
