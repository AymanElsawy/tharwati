import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { CurrencySelector } from "@/features/onboarding/components/CurrencySelector"
import type { CurrencyOption } from "@/features/onboarding/data/currencies"
import { exchangeRateSchema } from "@/features/exchange-rates/schemas/exchange-rate.schema"
import type { ExchangeRateFormValues } from "@/features/exchange-rates/types/exchange-rate-form"

interface Props {
  currencies: CurrencyOption[]
  values: ExchangeRateFormValues
  mode: "create" | "edit"
  isOpen: boolean
  isSaving: boolean
  onClose: () => void
  onSubmit: (values: ExchangeRateFormValues) => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
}

export function ExchangeRateFormDialog({
  currencies,
  values,
  mode,
  isOpen,
  isSaving,
  onClose,
  onSubmit,
  onDirtyChange,
}: Props) {
  const { control, register, reset, handleSubmit, formState: { errors, isDirty } } =
    useForm<ExchangeRateFormValues>({
      resolver: zodResolver(exchangeRateSchema),
      defaultValues: values,
    })
  useEffect(() => reset(values), [reset, values])
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange])
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-3xl bg-[var(--color-background)] p-6 shadow-2xl">
        <h2 className="text-xl font-bold">{mode === "create" ? "Add Exchange Rate" : "Edit Exchange Rate"}</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Store one unit of the From currency expressed in the To currency.</p>
        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {(["fromCurrencyCode", "toCurrencyCode"] as const).map((name) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field }) => (
                <div>
                  <CurrencySelector
                    options={currencies}
                    value={currencies.find((item) => item.code === field.value) ?? null}
                    onChange={(currency) => field.onChange(currency?.code ?? "")}
                  />
                  <p className="mb-2 -mt-11 ms-32 pointer-events-none text-sm font-semibold">
                    {name === "fromCurrencyCode" ? "From currency" : "To currency"}
                  </p>
                  {errors[name] && <p className="mt-1 text-sm text-red-600">{errors[name]?.message}</p>}
                </div>
              )}
            />
          ))}
          <div>
            <label className="text-sm font-semibold" htmlFor="exchange-rate-value">Exchange rate</label>
            <input id="exchange-rate-value" inputMode="decimal" dir="ltr" className="mt-1.5 h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4" {...register("rate")} />
            {errors.rate && <p className="mt-1 text-sm text-red-600">{errors.rate.message}</p>}
          </div>
          <div>
            <label className="text-sm font-semibold" htmlFor="exchange-rate-date">Effective date</label>
            <input id="exchange-rate-date" type="datetime-local" className="mt-1.5 h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4" {...register("effectiveAt")} />
            {errors.effectiveAt && <p className="mt-1 text-sm text-red-600">{errors.effectiveAt.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save Rate"}</Button>
          </div>
        </form>
      </section>
    </div>
  )
}
