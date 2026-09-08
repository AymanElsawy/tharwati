import { useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AccountDeletionError, accountDeletionService, exitDeletedAccount } from "@/features/privacy/services/account-deletion.service"
import { useTranslation } from "@/i18n/useTranslation"
import { canPermanentlyDelete, closedDeleteAccountFlow, confirmReauthentication, openDeleteAccountFlow, resetDeleteAccountFlow } from "./delete-account-flow"

interface DeleteAccountDialogProps {
  email: string
  onDownloadData: () => void
  downloadDisabled: boolean
}

export function DeleteAccountDialog({ email, onDownloadData, downloadDisabled }: DeleteAccountDialogProps) {
  const { t } = useTranslation()
  const [flow, setFlow] = useState(closedDeleteAccountFlow)
  const [status, setStatus] = useState<"idle" | "working" | "reauthentication_failed" | "deletion_failed">("idle")
  const isOpen = flow.step !== "closed"

  function open() {
    setFlow(openDeleteAccountFlow())
    setStatus("idle")
  }

  function close() {
    if (status === "working") return
    setFlow(resetDeleteAccountFlow())
    setStatus("idle")
  }

  async function reauthenticate(event: React.FormEvent) {
    event.preventDefault()
    setStatus("working")
    try {
      await accountDeletionService.reauthenticate(flow.password)
      setFlow(confirmReauthentication(flow.password))
      setStatus("idle")
    } catch {
      setFlow(openDeleteAccountFlow())
      setStatus("reauthentication_failed")
    }
  }

  async function permanentlyDelete(event: React.FormEvent) {
    event.preventDefault()
    if (!canPermanentlyDelete(flow, email)) return
    const password = flow.password
    setStatus("working")
    try {
      await accountDeletionService.deleteCurrentAccount(password)
      setFlow(resetDeleteAccountFlow())
      await exitDeletedAccount(() => accountDeletionService.clearLocalSession(), () => window.location.replace("/login"))
    } catch (error) {
      setFlow(openDeleteAccountFlow())
      setStatus(error instanceof AccountDeletionError && error.code === "reauthentication_failed" ? "reauthentication_failed" : "deletion_failed")
    }
  }

  return <>
    <button type="button" onClick={open} className="mt-5 flex min-h-11 items-center rounded-xl border border-red-300 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20">{t("settings.delete.action")}</button>
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/60" />
        <Dialog.Popup className="fixed inset-x-3 top-1/2 z-[100] mx-auto max-h-[calc(100dvh-2rem)] w-auto max-w-md -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-start shadow-2xl sm:inset-x-0 sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><Dialog.Title className="text-xl font-bold text-red-800 dark:text-red-300">{t("settings.delete.dialogTitle")}</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{flow.step === "password" ? t("settings.delete.passwordDescription") : t("settings.delete.confirmDescription")}</Dialog.Description></div><Dialog.Close disabled={status === "working"} render={<Button variant="ghost" size="icon" aria-label={t("common.close")} />}><X className="size-5" /></Dialog.Close></div>
          <button type="button" onClick={onDownloadData} disabled={downloadDisabled || status === "working"} className="mt-5 flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-primary)] disabled:opacity-60"><Download className="size-4" />{t("settings.delete.downloadFirst")}</button>
          {flow.step === "password" ? <form className="mt-4 space-y-4" onSubmit={(event) => void reauthenticate(event)}><label className="block text-sm font-semibold">{t("settings.delete.passwordLabel")}<input autoFocus required type="password" autoComplete="current-password" value={flow.password} onChange={(event) => setFlow({ ...flow, password: event.target.value })} className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5" /></label>{status === "reauthentication_failed" ? <p role="alert" className="text-sm text-red-700">{t("settings.delete.passwordError")}</p> : null}{status === "deletion_failed" ? <p role="alert" className="text-sm text-red-700">{t("settings.delete.failure")}</p> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="tharwati-button-secondary min-h-11">{t("common.cancel")}</button><button type="submit" disabled={status === "working" || flow.password.length === 0} className="tharwati-button-primary min-h-11">{status === "working" ? t("settings.delete.checking") : t("common.continue")}</button></div></form> : null}
          {flow.step === "confirmation" ? <form className="mt-4 space-y-4" onSubmit={(event) => void permanentlyDelete(event)}><div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{t("settings.delete.permanentWarning")}</div><label className="block text-sm font-semibold">{t("settings.delete.confirmLabel")}<span className="mt-1 block font-normal text-[var(--color-text-secondary)]" dir="ltr">{email}</span><input autoFocus required type="email" dir="ltr" autoComplete="off" value={flow.confirmation} onChange={(event) => setFlow({ ...flow, confirmation: event.target.value })} className="mt-1.5 w-full rounded-xl border border-red-300 bg-[var(--color-surface)] px-3.5 py-2.5" /></label><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="tharwati-button-secondary min-h-11">{t("common.cancel")}</button><button type="submit" disabled={status === "working" || !canPermanentlyDelete(flow, email)} className="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">{status === "working" ? t("settings.delete.deleting") : t("settings.delete.permanentAction")}</button></div></form> : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </>
}
