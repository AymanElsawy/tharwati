import { Dialog } from "@base-ui/react/dialog"
import {
  Banknote,
  Briefcase,
  Building2,
  Coins,
  Landmark,
  LayoutGrid,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/useTranslation"
import {
  accountTypeOptions,
  getAccountTypeLabel,
  type AccountFormValues,
  type AccountTypeCode,
} from "../types/account-form"
import { AccountForm } from "./AccountForm"

type AccountFormDialogProps = {
  defaultValues: AccountFormValues
  isOpen: boolean
  isSaving: boolean
  isCurrencyLocked?: boolean
  isOpeningBalanceLocked?: boolean
  mode: "create" | "edit"
  onClose: () => void
  onSubmit: (values: AccountFormValues) => Promise<void>
  onDirtyChange: (dirty: boolean) => void
}

const typeAccents: Record<
  AccountTypeCode,
  { icon: LucideIcon; selected: string; idle: string; iconWrap: string }
> = {
  cash: {
    icon: Banknote,
    selected: "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-emerald-400",
    iconWrap: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  },
  bank: {
    icon: Landmark,
    selected: "border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-blue-400",
    iconWrap: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  },
  brokerage: {
    icon: TrendingUp,
    selected: "border-violet-500 bg-violet-50 text-violet-900 dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-violet-400",
    iconWrap: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  },
  gold: {
    icon: Coins,
    selected: "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-amber-400",
    iconWrap: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  },
  real_estate: {
    icon: Building2,
    selected: "border-teal-500 bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-teal-400",
    iconWrap: "bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300",
  },
  business: {
    icon: Briefcase,
    selected: "border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-indigo-400",
    iconWrap: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300",
  },
  other: {
    icon: LayoutGrid,
    selected: "border-slate-500 bg-slate-50 text-slate-900 dark:border-slate-400 dark:bg-slate-800/60 dark:text-slate-100",
    idle: "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-slate-400",
    iconWrap: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
}

export function AccountFormDialog({
  defaultValues,
  isOpen,
  isSaving,
  isCurrencyLocked = false,
  isOpeningBalanceLocked = false,
  mode,
  onClose,
  onSubmit,
  onDirtyChange,
}: AccountFormDialogProps) {
  const { t } = useTranslation()
  const formId = `${mode}-account-form`
  const [creationStep, setCreationStep] = useState<"type" | "form">("type")
  const [selectedType, setSelectedType] = useState<AccountTypeCode | null>(null)

  const effectiveDefaults = useMemo(
    () => selectedType ? { ...defaultValues, accountTypeCode: selectedType } : defaultValues,
    [defaultValues, selectedType],
  )
  const choosingType = mode === "create" && creationStep === "type"
  const activeAccent = typeAccents[effectiveDefaults.accountTypeCode]

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className="bg-black/60"
          style={{ position: "fixed", inset: 0, zIndex: 70 }}
        />
        <Dialog.Popup
          className="flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-background)] outline-none shadow-2xl"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            width: "min(48rem, calc(100vw - 2rem))",
            maxHeight: "calc(100dvh - 2rem)",
            zIndex: 80,
          }}
        >
          <header
            className={`flex shrink-0 items-start justify-between gap-5 border-b border-[var(--border-subtle)] bg-gradient-to-br from-[var(--color-primary-soft)]/40 via-transparent to-transparent px-5 py-4 sm:px-7 sm:py-5`}
          >
            <div className="min-w-0">
              {!choosingType ? (
                <span
                  className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${activeAccent.iconWrap}`}
                >
                  <activeAccent.icon size={13} />
                  {getAccountTypeLabel(effectiveDefaults.accountTypeCode, t)}
                </span>
              ) : null}
              <Dialog.Title className="font-heading text-xl font-semibold">
                {t(
                  mode === "create"
                    ? choosingType ? "accounts.form.chooseTypeTitle" : "accounts.form.createTitle"
                    : "accounts.form.editTitle",
                )}
              </Dialog.Title>
              <Dialog.Description className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                {t(choosingType ? "accounts.form.chooseTypeDescription" : "accounts.form.description")}
              </Dialog.Description>
            </div>
            <Dialog.Close
              disabled={isSaving}
              render={<Button variant="ghost" size="icon" className="shrink-0" />}
            >
              <X size={18} />
              <span className="sr-only">{t("accounts.form.close")}</span>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
            {choosingType ? (
              <fieldset>
                <legend className="sr-only">{t("accounts.form.chooseTypeTitle")}</legend>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
                  {accountTypeOptions.map((option) => {
                    const accent = typeAccents[option.value]
                    const Icon = accent.icon
                    const selected = selectedType === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSelectedType(option.value)}
                        className={`flex min-h-20 items-center gap-3.5 rounded-2xl border-2 px-4 py-3.5 text-start text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${selected ? accent.selected : accent.idle}`}
                      >
                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent.iconWrap}`}>
                          <Icon size={19} />
                        </span>
                        {t(option.creationLabelKey)}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            ) : <AccountForm
              defaultValues={effectiveDefaults}
              formId={formId}
              isSaving={isSaving}
              isCurrencyLocked={isCurrencyLocked}
              isOpeningBalanceLocked={isOpeningBalanceLocked}
              onSubmit={onSubmit}
              onDirtyChange={onDirtyChange}
            />}
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--border-subtle)] bg-background px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={onClose}
            >
              {t("common.cancel")}
            </Button>
            {choosingType ? <Button type="button" disabled={selectedType === null} onClick={() => setCreationStep("form")}>
              {t("common.continue")}
            </Button> : <Button type="submit" form={formId} disabled={isSaving}>
              {isSaving
                ? t("accounts.form.saving")
                : mode === "create"
                  ? t("accounts.actions.create")
                  : t("accounts.form.saveChanges")}
            </Button>}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
