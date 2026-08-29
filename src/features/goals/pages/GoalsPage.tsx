import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Archive,
  Check,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Target,
  Undo2,
  WalletCards,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { useTranslation } from "@/i18n/useTranslation"
import { compareDecimals } from "@/lib/financial-calculations/decimal"
import { formatPortfolioPercent } from "@/features/portfolio/utils/portfolio-formatters"
import type { GoalStatus } from "@/lib/supabase/types"
import { goalErrorMessage } from "../components/goal-error-message"
import { GoalEntryDialog } from "../components/GoalEntryDialog"
import { GoalFormDialog } from "../components/GoalFormDialog"
import { GoalMoney } from "../components/GoalMoney"
import { formatGoalMoney } from "../components/goal-money"
import type { GoalSummary } from "../domain/goals"
import {
  correctGoalEntry,
  groupGoalHistoryEntries,
  loadGoals,
  setGoalArchived,
  setGoalStatus,
  type GoalHistoryEntry,
  type GoalsReadModel,
} from "../services/goals.service"

export function GoalsPage() {
  const { t, language } = useTranslation()
  const [model, setModel] = useState<GoalsReadModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formGoal, setFormGoal] = useState<GoalSummary | null | undefined>(
    undefined
  )
  const [entryDialog, setEntryDialog] = useState<{
    mode: "progress" | "withdrawal" | "correct"
    entry?: GoalHistoryEntry
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    try {
      setModel(await loadGoals())
      setError(null)
    } catch {
      setError(t("goals.error.load"))
    } finally {
      setLoading(false)
    }
  }, [t])
  useEffect(() => {
    async function initialize() {
      await load()
    }
    void initialize()
  }, [load])
  const visible = useMemo(
    () =>
      model?.goals
        .filter((goal) =>
          showArchived ? goal.archived_at !== null : goal.archived_at === null
        )
        .sort((a, b) =>
          a.status === "active" && b.status !== "active"
            ? -1
            : a.status !== "active" && b.status === "active"
              ? 1
              : 0
        ) ?? [],
    [model, showArchived]
  )
  const selected = model?.goals.find((goal) => goal.id === selectedId) ?? null
  const typeLabel = (goal: GoalSummary) =>
    goal.goal_type === "other"
      ? (goal.custom_type_name ?? t("goals.type.other"))
      : t(`goals.type.${goal.goal_type}`)
  const moneyLocale = language === "ar" ? "ar-SA" : "en-US"
  const formatMoney = (value: string, currency: string) =>
    formatGoalMoney(value, currency, moneyLocale)
  const formatPercent = (value: string) =>
    formatPortfolioPercent(value, language === "ar" ? "ar-SA" : "en-US")
  const entries =
    selected && model ? (model.entriesByGoal.get(selected.id) ?? []) : []
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]))
  const reversedIds = new Set(
    entries
      .filter((e) => e.entry_type === "reversal" && e.reverses_entry_id)
      .map((e) => e.reverses_entry_id!)
  )
  const historyGroups = groupGoalHistoryEntries(entries)
  const historyEntryType = (entry: GoalHistoryEntry) => {
    const original = entry.reverses_entry_id
      ? entriesById.get(entry.reverses_entry_id)
      : entry.replacement_for_entry_id
        ? entriesById.get(entry.replacement_for_entry_id)
        : entry
    return original?.entry_type === "withdrawal" ? "withdrawal" : "progress"
  }
  const historyRoleLabel = (
    type: "progress" | "withdrawal",
    role:
      | "originalCorrected"
      | "originalReversed"
      | "correctionRecorded"
      | "reversalRecorded"
      | "replacement"
  ) => {
    if (role === "originalCorrected")
      return type === "withdrawal"
        ? t("goals.entry.originalWithdrawalCorrected")
        : t("goals.entry.originalProgressCorrected")
    if (role === "originalReversed")
      return type === "withdrawal"
        ? t("goals.entry.originalWithdrawalReversed")
        : t("goals.entry.originalProgressReversed")
    if (role === "correctionRecorded")
      return type === "withdrawal"
        ? t("goals.entry.withdrawalCorrectionRecorded")
        : t("goals.entry.progressCorrectionRecorded")
    if (role === "reversalRecorded")
      return type === "withdrawal"
        ? t("goals.entry.withdrawalReversalRecorded")
        : t("goals.entry.progressReversalRecorded")
    return type === "withdrawal"
      ? t("goals.entry.updatedWithdrawal")
      : t("goals.entry.updatedProgress")
  }
  const historyLabel = (entry: GoalHistoryEntry) => {
    const type = historyEntryType(entry)
    if (entry.entry_type === "reversal")
      return historyRoleLabel(
        type,
        entriesById.get(entry.reverses_entry_id ?? "")?.replacementEntryId
          ? "correctionRecorded"
          : "reversalRecorded"
      )
    if (entry.replacement_for_entry_id)
      return historyRoleLabel(type, "replacement")
    if (reversedIds.has(entry.id))
      return historyRoleLabel(
        type,
        entry.replacementEntryId ? "originalCorrected" : "originalReversed"
      )
    return type === "withdrawal"
      ? t("goals.entry.withdrawal")
      : t("goals.entry.progress")
  }
  const historySign = (entry: GoalHistoryEntry): "+" | "−" =>
    entry.entry_type === "progress"
      ? "+"
      : entry.entry_type === "withdrawal"
        ? "−"
        : historyEntryType(entry) === "withdrawal"
          ? "+"
          : "−"
  const historyRelationship = (entry: GoalHistoryEntry): string | null => {
    if (entry.reverses_entry_id) {
      const original = entriesById.get(entry.reverses_entry_id)
      if (!original) return null
      return original.entry_type === "progress"
        ? t("goals.history.reversesProgress", { date: original.effective_on })
        : t("goals.history.reversesWithdrawal", { date: original.effective_on })
    }
    if (entry.replacement_for_entry_id) {
      const original = entriesById.get(entry.replacement_for_entry_id)
      if (!original) return null
      return t("goals.history.replacementFor", {
        type:
          original.entry_type === "withdrawal"
            ? t("goals.entry.withdrawal")
            : t("goals.entry.progress"),
        date: original.effective_on,
      })
    }
    if (entry.reversedByEntryId) {
      const replacement = entry.replacementEntryId
        ? entriesById.get(entry.replacementEntryId)
        : null
      return replacement
        ? t("goals.history.originalCorrected", {
            replacement: formatMoney(
              replacement.amount,
              selected?.currency_code ?? "USD"
            ),
            date: replacement.effective_on,
          })
        : t("goals.history.originalReversed")
    }
    return null
  }
  const mutate = async (action: () => Promise<unknown>) => {
    setSaving(true)
    try {
      await action()
      await load()
    } catch (cause) {
      setError(goalErrorMessage(cause, t))
    } finally {
      setSaving(false)
    }
  }
  const changeStatus = (status: GoalStatus) =>
    selected && mutate(() => setGoalStatus(selected.id, status))
  const archive = () =>
    selected &&
    mutate(() => setGoalArchived(selected.id, selected.archived_at === null))
  const reverse = (entry: GoalHistoryEntry) => {
    if (window.confirm(t("goals.reverse.confirm")))
      void mutate(() =>
        correctGoalEntry(entry.id, {
          amount: null,
          effectiveOn: null,
          note: t("goals.reverse.note"),
        })
      )
  }
  if (loading)
    return (
      <p className="text-[var(--color-text-secondary)]">{t("goals.loading")}</p>
    )
  return (
    <section>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[var(--color-primary)]">
            {t("goals.eyebrow")}
          </p>
          <h2 className="mt-1 text-3xl font-bold">{t("pages.goals.title")}</h2>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            {t("goals.description")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
            <Archive size={17} />
            {showArchived ? t("goals.showCurrent") : t("goals.showArchived")}
          </Button>
          <Button onClick={() => setFormGoal(null)}>
            <Plus size={17} />
            {t("goals.add")}
          </Button>
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className="space-y-3">
          {visible.length === 0 ? (
            <div className="tharwati-card p-6 text-center text-[var(--color-text-secondary)]">
              {t("goals.noGoals", {
                scope: showArchived ? t("goals.archived") : t("goals.current"),
              })}
            </div>
          ) : (
            visible.map((goal) => (
              <button
                key={goal.id}
                onClick={() => setSelectedId(goal.id)}
                className={`tharwati-card w-full p-4 text-start transition ${selectedId === goal.id ? "ring-2 ring-[var(--color-primary)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{goal.name}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)] capitalize">
                      {typeLabel(goal)} · {t(`goals.status.${goal.status}`)}
                    </p>
                  </div>
                  <Target className="text-[var(--color-primary)]" size={20} />
                </div>
                <div className="mt-4 flex justify-between text-sm">
                  <span>
                    <GoalMoney value={goal.fundedAmount} currencyCode={goal.currency_code} locale={moneyLocale} />
                  </span>
                  <span>
                    <GoalMoney value={goal.target_amount} currencyCode={goal.currency_code} locale={moneyLocale} />
                  </span>
                </div>
                <Progress
                  className="mt-2"
                  value={Math.min(100, Number(goal.displayPercent))}
                />
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  {t("goals.fundedPercent", {
                    percent: formatPercent(goal.progressPercent),
                  })}
                </p>
              </button>
            ))
          )}
        </div>
        <div>
          {selected ? (
            <div className="tharwati-card p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-4 sm:flex-row">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold">{selected.name}</h3>
                    <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-semibold capitalize">
                      {t(`goals.status.${selected.status}`)}
                    </span>
                    {selected.archived_at ? (
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs">
                        {t("goals.archivedBadge")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[var(--color-text-secondary)] capitalize">
                    {typeLabel(selected)}
                    {selected.target_date
                      ? ` · ${t("goals.targetOn", { date: selected.target_date })}`
                      : ""}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setFormGoal(selected)}>
                  {t("goals.edit")}
                </Button>
              </div>
              <div className="mt-6 rounded-2xl bg-[var(--color-primary-soft)] p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("goals.fundedAmount")}
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      <GoalMoney value={selected.fundedAmount} currencyCode={selected.currency_code} locale={moneyLocale} />
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("goals.target")}
                    </p>
                    <p className="mt-1 font-semibold">
                      <GoalMoney value={selected.target_amount} currencyCode={selected.currency_code} locale={moneyLocale} />
                    </p>
                  </div>
                </div>
                <Progress
                  className="mt-4"
                  value={Math.min(100, Number(selected.displayPercent))}
                />
                <p className="mt-2 text-sm">
                  {formatPercent(selected.progressPercent)}
                  {compareDecimals(selected.surplusAmount, "0") === 1
                    ? ` · ${t("goals.overTarget", { amount: formatMoney(selected.surplusAmount, selected.currency_code) })}`
                    : ""}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {selected.status === "active" && !selected.archived_at ? (
                  <>
                    <Button
                      onClick={() => setEntryDialog({ mode: "progress" })}
                    >
                      <Plus size={16} />
                      {t("goals.addProgress")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEntryDialog({ mode: "withdrawal" })}
                    >
                      <WalletCards size={16} />
                      {t("goals.withdraw")}
                    </Button>
                  </>
                ) : (
                  <Button className="hidden sm:inline-flex" variant="outline" disabled={Boolean(selected.archived_at)} onClick={() => void changeStatus("active")}>
                    <RotateCcw size={16} /> {t("goals.reopen")}
                  </Button>
                )}
                {selected.status === "active" && !selected.archived_at ? (
                  <div className="hidden gap-2 sm:flex">
                    <Button variant="outline" onClick={() => void changeStatus("completed")}><Check size={16} />{t("goals.complete")}</Button>
                    <Button variant="outline" onClick={() => void changeStatus("cancelled")}>{t("goals.cancelGoal")}</Button>
                  </div>
                ) : null}
                <Button className="hidden sm:inline-flex" variant="outline" disabled={saving} onClick={() => void archive()}>
                  {selected.archived_at ? t("goals.unarchive") : t("goals.archive")}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded-lg border border-[var(--color-border)] p-2 sm:hidden" aria-label={t("goals.moreActions")}>
                    <MoreHorizontal size={18} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {selected.status === "active" && !selected.archived_at ? (
                      <>
                        <DropdownMenuItem onClick={() => void changeStatus("completed")}>{t("goals.complete")}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void changeStatus("cancelled")}>{t("goals.cancelGoal")}</DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem disabled={Boolean(selected.archived_at)} onClick={() => void changeStatus("active")}>{t("goals.reopen")}</DropdownMenuItem>
                    )}
                    <DropdownMenuItem disabled={saving} onClick={() => void archive()}>{selected.archived_at ? t("goals.unarchive") : t("goals.archive")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-8">
                <h4 className="text-lg font-semibold">{t("goals.history")}</h4>
                <div className="mt-3 space-y-3">
                  {entries.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("goals.noHistory")}
                    </p>
                  ) : (
                    historyGroups.map(({ root, related }) => (
                      <div key={root.id} className="overflow-hidden rounded-xl border border-[var(--color-border)]">
                        {[root, ...related].map((entry, index) => (
                          <div
                            key={entry.id}
                            className={`p-4 ${index > 0 ? "border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 ps-7" : ""} ${entry.entry_type === "reversal" || reversedIds.has(entry.id) ? "opacity-70" : ""}`}
                          >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{historyLabel(entry)}</p>
                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                              <span dir="ltr">{entry.effective_on}</span>
                              {entry.note ? ` · ${entry.note}` : ""}
                            </p>
                            {historyRelationship(entry) ? (
                              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                {historyRelationship(entry)}
                              </p>
                            ) : null}
                          </div>
                          <GoalMoney
                            className="font-semibold"
                            value={entry.amount}
                            currencyCode={selected.currency_code}
                            locale={moneyLocale}
                            sign={historySign(entry)}
                          />
                        </div>
                        {entry.entry_type !== "reversal" &&
                        !reversedIds.has(entry.id) &&
                        selected.status === "active" &&
                        !selected.archived_at ? (
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setEntryDialog({ mode: "correct", entry })
                              }
                            >
                              {t("goals.correct")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => reverse(entry)}
                            >
                              <Undo2 size={15} />
                              {t("goals.reverse")}
                            </Button>
                          </div>
                        ) : null}
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="tharwati-card flex min-h-64 items-center justify-center p-8 text-center text-[var(--color-text-secondary)]">
              {t("goals.selectPrompt")}
            </div>
          )}
        </div>
      </div>
      {formGoal !== undefined ? (
        <GoalFormDialog
          goal={formGoal}
          onClose={() => setFormGoal(undefined)}
          onSaved={load}
        />
      ) : null}
      {selected && entryDialog ? (
        <GoalEntryDialog
          goal={selected}
          mode={entryDialog.mode}
          entry={entryDialog.entry}
          onClose={() => setEntryDialog(null)}
          onSaved={load}
        />
      ) : null}
    </section>
  )
}
