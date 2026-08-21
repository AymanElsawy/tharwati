import { Dialog } from "@base-ui/react/dialog"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/useTranslation"

export function DeleteAccountRecordDialog({ open, isSaving, error, onCancel, onConfirm }: { open: boolean; isSaving: boolean; error: string | null; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  return <Dialog.Root open={open} onOpenChange={(next) => !next && !isSaving && onCancel()}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-[110] bg-black/60" /><Dialog.Popup className="fixed top-1/2 left-1/2 z-[120] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"><Dialog.Title className="font-heading text-xl font-semibold">{t("accounts.records.deleteTitle")}</Dialog.Title><Dialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">{t("accounts.records.deleteDescription")}</Dialog.Description>{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}<footer className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onCancel} disabled={isSaving}>{t("common.cancel")}</Button><Button variant="destructive" onClick={onConfirm} disabled={isSaving}>{t(isSaving ? "accounts.records.deleting" : "accounts.records.delete")}</Button></footer></Dialog.Popup></Dialog.Portal></Dialog.Root>
}
