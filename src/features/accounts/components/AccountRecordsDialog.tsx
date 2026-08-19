import { Dialog } from "@base-ui/react/dialog"
import { ArrowLeft, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import type { AccountSummary } from "@/lib/supabase/types"
import type { AccountRecord } from "../types/account-record"

export function AccountRecordsDialog({
  account,
  records,
  isLoading,
  isError,
  onClose,
}: {
  account: AccountSummary | null
  records: AccountRecord[]
  isLoading: boolean
  isError: boolean
  onClose: () => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  return (
    <Dialog.Root
      open={account !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[80] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
          <header className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-5">
            <div>
              <Dialog.Title className="font-heading text-xl font-semibold">
                {account?.name}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {t("accounts.records.title")}
              </Dialog.Description>
            </div>
            <Dialog.Close render={<Button variant="destructive" size="icon" />}>
              <X size={18} />
            </Dialog.Close>
          </header>
          <div className="max-h-[28rem] overflow-auto px-4 py-5 sm:px-6">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : isError ? (
              <p className="py-8 text-center text-sm text-red-600">
                {t("accounts.records.error")}
              </p>
            ) : records.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("accounts.records.empty")}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-muted-foreground uppercase">
                    <th className="px-2 py-2 text-start">
                      {t("accounts.records.date")}
                    </th>
                    <th className="px-2 py-2 text-start">
                      {t("accounts.records.description")}
                    </th>
                    <th className="px-2 py-2 text-end">
                      {t("accounts.records.amount")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <td className="px-2 py-3" dir="ltr">
                        {record.occurredAt.slice(0, 10)}
                      </td>
                      <td className="px-2 py-3">
                        {record.description || record.type}
                      </td>
                      <td className="px-2 py-3 text-end tabular-nums" dir="ltr">
                        {formatPortfolioAmount(
                          record.amount,
                          record.currencyCode,
                          locale
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <footer className="flex justify-end border-t border-[var(--color-border)] px-6 py-4">
            <Button variant="secondary" onClick={onClose}>
              <ArrowLeft size={16} />
              {t("common.back")}
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
