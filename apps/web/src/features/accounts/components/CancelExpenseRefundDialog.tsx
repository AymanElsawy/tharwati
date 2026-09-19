import { Dialog } from "@base-ui/react/dialog"

import { Button } from "@/components/ui/button"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"

export function CancelExpenseRefundDialog({
  open,
  amount,
  currencyCode,
  destinationAccountName,
  isSaving,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean
  amount: string
  currencyCode: string
  destinationAccountName: string
  isSaving: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const formattedAmount = formatPortfolioAmount(amount, currencyCode, locale)
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => !next && !isSaving && onCancel()}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[130] bg-black/60" />
        <Dialog.Popup
          className="fixed top-1/2 left-1/2 z-[140] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"
          dir={language === "ar" ? "rtl" : "ltr"}
        >
          <Dialog.Title className="font-heading text-xl font-semibold">
            {t("accounts.records.cancelRefundTitle")}
          </Dialog.Title>
          <Dialog.Description className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
            <p>
              {t("accounts.records.cancelRefundQuestion", {
                amount: formattedAmount,
              })}
            </p>
            <p>
              {t("accounts.records.cancelRefundDescription", {
                amount: formattedAmount,
                destination: destinationAccountName,
              })}
            </p>
          </Dialog.Description>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <footer className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              {t("accounts.records.keepRefund")}
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isSaving}
            >
              {t("accounts.records.cancelRefund")}
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
