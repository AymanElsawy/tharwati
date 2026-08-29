import { Dialog } from "@base-ui/react/dialog"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { GoalProgressEntryRow } from "@/lib/supabase/types"
import { today, type GoalSummary } from "../domain/goals"
import { addGoalEntry, correctGoalEntry } from "../services/goals.service"
import { useTranslation } from "@/i18n/useTranslation"
import { goalErrorMessage } from "./goal-error-message"

export function GoalEntryDialog({
  goal,
  mode,
  entry,
  onClose,
  onSaved,
}: {
  goal: GoalSummary
  mode: "progress" | "withdrawal" | "correct"
  entry?: GoalProgressEntryRow
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState(
    mode === "correct" ? (entry?.amount ?? "") : ""
  )
  const [date, setDate] = useState(
    mode === "correct" ? (entry?.effective_on ?? today()) : today()
  )
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (mode === "correct" && !window.confirm(t("goals.correct.confirm")))
      return
    setSaving(true)
    setError(null)
    try {
      if (mode === "correct" && entry)
        await correctGoalEntry(entry.id, {
          amount: amount.trim(),
          effectiveOn: date,
          note: note.trim() || null,
        })
      else
        await addGoalEntry(goal.id, {
          entryType: mode as "progress" | "withdrawal",
          amount: amount.trim(),
          effectiveOn: date,
          note: note.trim() || null,
        })
      await onSaved()
      onClose()
    } catch (cause) {
      setError(goalErrorMessage(cause, t))
    } finally {
      setSaving(false)
    }
  }
  const title =
    mode === "progress"
      ? t("goals.addProgress")
      : mode === "withdrawal"
        ? t("goals.withdraw")
        : t("goals.correctEntry")
  const input =
    "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5"
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[80] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl sm:p-7">
          <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t("goals.entryNotice")}
          </Dialog.Description>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold">
              {t("goals.amount", { currency: goal.currency_code })}
              <input
                inputMode="decimal"
                dir="ltr"
                className={input}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("goals.date")}
              <input
                type="date"
                max={today()}
                className={input}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("goals.note")}{" "}
              <span className="font-normal text-[var(--color-text-secondary)]">
                ({t("common.optional")})
              </span>
              <textarea
                className={`${input} min-h-20`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" disabled={saving} onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button disabled={saving} onClick={() => void submit()}>
              {saving ? t("goals.saving") : t("goals.saveEntry")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
