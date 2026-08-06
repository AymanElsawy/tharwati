import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo } from "react"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Dialog } from "@base-ui/react/dialog"
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { useTranslation } from "@/i18n/useTranslation"
import { createEditInvestmentSchema } from "../schemas/edit-investment.schema"
import { useEditInvestment } from "../hooks/useEditInvestment"
import type { EditInvestmentValues } from "../types/edit-investment"

const fieldClass = "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] disabled:opacity-60"

export function EditInvestmentDialog({ transactionId, open, onClose, onSuccess }: { transactionId: string | null; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { t } = useTranslation()
  const schema = useMemo(() => createEditInvestmentSchema(t), [t])
  const { load, save, isLoading, isSaving, error } = useEditInvestment()
  const { register, reset, handleSubmit, formState: { errors, isDirty } } = useForm<EditInvestmentValues>({ resolver: zodResolver(schema) })
  const unsaved = useUnsavedChanges(open && isDirty)
  const requestClose = () => unsaved.request(onClose)

  useEffect(() => {
    if (!open || !transactionId) return
    let active = true
    void load(transactionId).then((values) => { if (active) reset(values) }).catch(() => undefined)
    return () => { active = false }
  }, [load, open, transactionId, reset])

  return <>
    <Dialog.Root open={open} onOpenChange={(next: boolean) => { if (!next) requestClose() }}>
      <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/60" />
      <Dialog.Popup className="fixed top-1/2 start-1/2 z-[80] flex max-h-[90vh] w-[min(46rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-background outline-none rtl:translate-x-1/2">
        <header className="border-b border-[var(--border-subtle)] px-6 py-5">
          <Dialog.Title className="text-xl font-semibold">{t("investment.edit.title")}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">{t("investment.edit.description")}</Dialog.Description>
        </header>
        {isLoading ? <p role="status" className="p-6">{t("common.loading")}</p> :
          <form id="edit-investment-form" className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6" onSubmit={handleSubmit(async (values) => { await save(values); reset(values); onSuccess(); onClose() })}>
            {error ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error.message}</p> : null}
            <div className="rounded-xl border border-amber-500/30 p-4 text-sm text-amber-800 dark:text-amber-200">{t("investment.edit.correctionNotice")}</div>
            <input type="hidden" {...register("transactionId")} /><input type="hidden" {...register("accountId")} /><input type="hidden" {...register("assetId")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">{t("investment.account.section")}<input className={fieldClass} disabled {...register("accountName")} /><small className="mt-1 block text-muted-foreground">{t("investment.edit.accountLocked")}</small></label>
              <label className="text-sm font-semibold">{t("investment.asset.section")}<input className={fieldClass} disabled {...register("assetName")} /><small className="mt-1 block text-muted-foreground">{t("investment.edit.assetLocked")}</small></label>
              <Field label={t("investment.quantity")} error={errors.quantity?.message}><input className={fieldClass} dir="ltr" inputMode="decimal" disabled={isSaving} {...register("quantity")} /></Field>
              <Field label={t("investment.unitPrice")} error={errors.unitPrice?.message}><input className={fieldClass} dir="ltr" inputMode="decimal" disabled={isSaving} {...register("unitPrice")} /></Field>
              <Field label={t("investment.fees")} error={errors.fees?.message}><input className={fieldClass} dir="ltr" inputMode="decimal" disabled={isSaving} {...register("fees")} /></Field>
              <Field label={t("investment.date")} error={errors.occurredAt?.message}><input type="date" className={fieldClass} dir="ltr" disabled={isSaving} {...register("occurredAt")} /></Field>
            </div>
            <label className="block text-sm font-semibold">{t("investment.notes")}<textarea className={`${fieldClass} min-h-24`} disabled={isSaving} {...register("notes")} /></label>
          </form>}
        <footer className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-6 py-4">
          <Button type="button" variant="outline" disabled={isSaving} onClick={requestClose}>{t("common.cancel")}</Button>
          <Button type="submit" form="edit-investment-form" disabled={isSaving || isLoading}>{isSaving ? t("investment.edit.saving") : t("investment.edit.save")}</Button>
        </footer>
      </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <UnsavedChangesDialog open={unsaved.confirmationOpen} onKeepEditing={unsaved.keepEditing} onDiscard={unsaved.discard} />
  </>
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="text-sm font-semibold">{label}{children}{error ? <span className="mt-1 block text-red-600">{error}</span> : null}</label>
}
