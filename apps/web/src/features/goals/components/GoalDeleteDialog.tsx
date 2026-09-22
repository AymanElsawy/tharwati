import { Dialog } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/useTranslation"

export function GoalDeleteDialog({
  goalName,
  deleting,
  onCancel,
  onConfirm,
}: {
  goalName: string
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !deleting) onCancel()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[80] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl sm:p-7">
          <Dialog.Title className="text-xl font-semibold">
            {t("goals.deleteTitle")}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            {t("goals.deletePrompt", { goalName })}
          </Dialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={deleting} onClick={onCancel}>
              {t("goals.keepGoal")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={onConfirm}
              data-goal-delete-confirm
            >
              {t("goals.delete")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
