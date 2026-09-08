import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  goalTypes,
  isGoalCurrencyLocked,
  showsCustomGoalType,
  today,
  type GoalFormInput,
  type GoalSummary,
} from "../domain/goals"
import { saveGoal } from "../services/goals.service"
import { useTranslation } from "@/i18n/useTranslation"
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser"
import { getProfileCurrencyDefault } from "@/features/profile/domain/currency-default"
import { goalErrorMessage } from "./goal-error-message"

const currencies = ["USD", "SAR", "EGP", "EUR", "GBP"]
export function GoalFormDialog({
  goal,
  onClose,
  onSaved,
}: {
  goal: GoalSummary | null | undefined
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { t } = useTranslation()
  const { baseCurrencyCode } = useCurrentUser()
  const editing = goal !== undefined && goal !== null
  const [name, setName] = useState(goal?.name ?? "")
  const [type, setType] = useState<GoalFormInput["goalType"]>(
    goal?.goal_type ?? "buy_home"
  )
  const [customType, setCustomType] = useState(goal?.custom_type_name ?? "")
  const currencyLocked = isGoalCurrencyLocked(Boolean(goal?.hasHistory))
  const [target, setTarget] = useState(goal?.target_amount ?? "")
  const [currency, setCurrency] = useState(
    goal?.currency_code ?? getProfileCurrencyDefault(baseCurrencyCode)
  )
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "")
  const [saved, setSaved] = useState("")
  const [savedOn, setSavedOn] = useState(today())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveGoal(
        {
          name: name.trim(),
          goalType: type,
          customTypeName: showsCustomGoalType(type) ? customType.trim() : null,
          targetAmount: target.trim(),
          currencyCode: currency,
          targetDate: targetDate || null,
          savedSoFar: !editing && saved.trim() ? saved.trim() : null,
          savedOn: !editing && saved.trim() ? savedOn : null,
        },
        goal?.id
      )
      await onSaved()
      onClose()
    } catch (cause) {
      setError(goalErrorMessage(cause, t))
    } finally {
      setSaving(false)
    }
  }
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
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[80] max-h-[calc(100vh-2rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl sm:p-7">
          <div className="flex justify-between gap-3">
            <div>
              <Dialog.Title className="text-xl font-semibold">
                {editing ? t("goals.edit") : t("goals.add")}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t("goals.trackingNotice")}
              </Dialog.Description>
            </div>
            <Dialog.Close render={<Button variant="ghost" size="icon" />}>
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">
              {t("goals.name")}
              <input
                className={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="text-sm font-semibold">
              {t("goals.type")}
              <select
                className={input}
                value={type}
                onChange={(e) =>
                  setType(e.target.value as GoalFormInput["goalType"])
                }
              >
                {goalTypes.map((value) => (
                  <option key={value} value={value}>
                    {t(`goals.type.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            {showsCustomGoalType(type) ? (
              <label className="text-sm font-semibold">
                {t("goals.customType")}
                <input
                  className={input}
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                />
              </label>
            ) : null}
            <label className="text-sm font-semibold">
              {t("goals.targetAmount")}
              <input
                inputMode="decimal"
                dir="ltr"
                className={input}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            <label className="text-sm font-semibold">
              {t("goals.currency")}
              <select
                disabled={currencyLocked}
                className={input}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {currencies.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              {currencyLocked ? (
                <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                  {t("goals.currencyLocked")}
                </span>
              ) : null}
            </label>
            <label className="text-sm font-semibold">
              {t("goals.targetDate")}{" "}
              <span className="font-normal text-[var(--color-text-secondary)]">
                ({t("common.optional")})
              </span>
              <input
                type="date"
                className={input}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </label>
            {!editing ? (
              <>
                <label className="text-sm font-semibold">
                  {t("goals.savedSoFar")}{" "}
                  <span className="font-normal text-[var(--color-text-secondary)]">
                    ({t("common.optional")})
                  </span>
                  <input
                    inputMode="decimal"
                    dir="ltr"
                    className={input}
                    value={saved}
                    onChange={(e) => setSaved(e.target.value)}
                  />
                </label>
                {saved ? (
                  <label className="text-sm font-semibold">
                    {t("goals.savedDate")}
                    <input
                      type="date"
                      max={today()}
                      className={input}
                      value={savedOn}
                      onChange={(e) => setSavedOn(e.target.value)}
                    />
                  </label>
                ) : null}
              </>
            ) : null}
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
              {saving ? t("goals.saving") : t("goals.save")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
