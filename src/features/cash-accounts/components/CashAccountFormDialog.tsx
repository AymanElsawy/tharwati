import { zodResolver } from "@hookform/resolvers/zod"
import { X } from "lucide-react"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { CurrencySelector } from "@/features/onboarding/components/CurrencySelector"
import type { CurrencyOption } from "@/features/onboarding/data/currencies"
import { cashAccountSchema } from "@/features/cash-accounts/schemas/cash-account.schema"
import type { CashAccountFormValues } from "@/features/cash-accounts/types/cash-account-form"

interface CashAccountFormDialogProps {
  currencyOptions: CurrencyOption[]
  defaultValues: CashAccountFormValues
  isOpen: boolean
  isSaving: boolean
  mode: "create" | "edit"
  onClose: () => void
  onSubmit: (values: CashAccountFormValues) => Promise<void>
}

const fieldClassName =
  "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-3 focus:ring-[var(--color-primary-soft)] disabled:opacity-60"

export function CashAccountFormDialog({
  currencyOptions,
  defaultValues,
  isOpen,
  isSaving,
  mode,
  onClose,
  onSubmit,
}: CashAccountFormDialogProps) {
  const formId = `${mode}-cash-account-form`
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CashAccountFormValues>({
    resolver: zodResolver(cashAccountSchema),
    defaultValues,
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  if (!isOpen) return null

  const disabled = isSaving || isSubmitting

  async function submit(values: CashAccountFormValues) {
    await onSubmit(values)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-5">
          <div>
            <h2 id={`${formId}-title`} className="text-xl font-bold text-[var(--color-text)]">
              {mode === "create" ? "Add cash account" : "Edit cash account"}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Keep your available cash balances accurate.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={disabled}
            className="rounded-xl p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </header>

        <form
          id={formId}
          className="space-y-5 px-6 py-6"
          noValidate
          onSubmit={handleSubmit(submit)}
        >
          <div>
            <label htmlFor={`${formId}-name`} className="text-sm font-semibold">
              Account Name
            </label>
            <input
              id={`${formId}-name`}
              autoComplete="off"
              disabled={disabled}
              className={fieldClassName}
              {...register("name")}
            />
            {errors.name && (
              <p className="mt-1.5 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <Controller
            control={control}
            name="currencyCode"
            render={({ field }) => (
              <div>
                <CurrencySelector
                  options={currencyOptions}
                  value={
                    currencyOptions.find((currency) => currency.code === field.value) ?? null
                  }
                  onChange={(currency) => field.onChange(currency?.code ?? "")}
                />
                {errors.currencyCode && (
                  <p className="mt-1.5 text-sm text-red-600">
                    {errors.currencyCode.message}
                  </p>
                )}
              </div>
            )}
          />

          <div>
            <label htmlFor={`${formId}-balance`} className="text-sm font-semibold">
              Current Balance
            </label>
            <input
              id={`${formId}-balance`}
              inputMode="decimal"
              dir="ltr"
              placeholder="0.00"
              disabled={disabled}
              className={fieldClassName}
              {...register("balance")}
            />
            {errors.balance && (
              <p className="mt-1.5 text-sm text-red-600">{errors.balance.message}</p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-notes`} className="text-sm font-semibold">
              Notes <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
            </label>
            <textarea
              id={`${formId}-notes`}
              disabled={disabled}
              className={`${fieldClassName} min-h-24 resize-y`}
              {...register("notes")}
            />
          </div>
        </form>

        <footer className="flex justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
          <Button type="button" variant="outline" disabled={disabled} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={disabled}>
            {disabled ? "Saving..." : mode === "create" ? "Add Account" : "Save Changes"}
          </Button>
        </footer>
      </section>
    </div>
  )
}
