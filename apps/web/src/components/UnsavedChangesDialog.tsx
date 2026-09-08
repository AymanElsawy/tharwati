import { Dialog } from "@base-ui/react/dialog"
import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/useTranslation"

export function UnsavedChangesDialog({ open, onKeepEditing, onDiscard }: { open: boolean; onKeepEditing: () => void; onDiscard: () => void }) {
  const { t } = useTranslation()
  const keepEditingButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) keepEditingButton.current?.focus()
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onKeepEditing() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/55" />
        <Dialog.Popup className="fixed top-1/2 start-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-background)] text-start outline-none rtl:translate-x-1/2">
          <div className="px-6 pt-6 pb-5 sm:px-7 sm:pt-7">
            <Dialog.Title className="text-lg font-semibold leading-7">{t("unsaved.title")}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">{t("unsaved.description")}</Dialog.Description>
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
            <Button ref={keepEditingButton} variant="outline" onClick={onKeepEditing}>{t("unsaved.keepEditing")}</Button>
            <Button variant="destructive" onClick={onDiscard}>{t("unsaved.discard")}</Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
