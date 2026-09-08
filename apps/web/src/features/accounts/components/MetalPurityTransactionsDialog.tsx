import { Dialog } from "@base-ui/react/dialog"
import { ArrowLeft, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  formatPortfolioAmount,
  formatPortfolioDecimal,
} from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import type { AccountSummary } from "@/lib/supabase/types"
import { getPurityOptions } from "../types/account-form"
import type { ValuedMetalPurchaseTransaction } from "../types/metal-purchase"

function purityLabel(
  metalType: "gold" | "silver",
  purity: string,
  t: ReturnType<typeof useTranslation>["t"]
) {
  const option = getPurityOptions(metalType).find(
    (item) => item.value === purity
  )
  return option?.label ?? (option?.labelKey ? t(option.labelKey) : purity)
}

function formatPurchaseDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value
}

export function MetalPurityTransactionsDialog({
  account,
  purity,
  purchases,
  onBack,
  onClose,
}: {
  account: AccountSummary | null
  purity: string | null
  purchases: ValuedMetalPurchaseTransaction[]
  onBack: () => void
  onClose: () => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const metalType = account?.metal_type === "silver" ? "silver" : "gold"

  return (
    <Dialog.Root
      open={account !== null && purity !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[90] w-[min(52rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
          <header className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-5">
            <div>
              <Dialog.Title className="font-heading text-xl font-semibold">
                {purity ? purityLabel(metalType, purity, t) : ""}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {account?.currency_code}
              </Dialog.Description>
            </div>
            <Dialog.Close render={<Button variant="destructive" size="icon" />}>
              <X size={18} />
            </Dialog.Close>
          </header>
          <div className="max-h-[28rem] overflow-y-auto px-4 py-5 sm:px-6">
            <table className="w-full table-fixed text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  <th className="w-[18%] px-1 py-2 text-start sm:px-2">
                    {t("accounts.metalPurchaseHistory.date")}
                  </th>
                  <th className="w-[16%] px-1 py-2 text-end sm:px-2">
                    {t("accounts.metalPurchaseHistory.quantity")}
                  </th>
                  <th className="w-[22%] px-1 py-2 text-end sm:px-2">
                    {t("accounts.metalPurchaseHistory.costPerUnit")}
                  </th>
                  <th className="w-[22%] px-1 py-2 text-end sm:px-2">
                    {t("accounts.metalPurchaseHistory.totalCost")}
                  </th>
                  <th className="w-[22%] px-1 py-2 text-end sm:px-2">
                    {t("accounts.metalPurchaseHistory.currentValue")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <td className="px-1 py-3 tabular-nums sm:px-2" dir="ltr">
                      {formatPurchaseDate(purchase.purchaseDate)}
                    </td>
                    <td
                      className="px-1 py-3 text-end tabular-nums sm:px-2"
                      dir="ltr"
                    >
                      {formatPortfolioDecimal(purchase.unitsGrams, locale, 3)} g
                    </td>
                    <td
                      className="px-1 py-3 text-end break-words tabular-nums sm:px-2"
                      dir="ltr"
                    >
                      {formatPortfolioAmount(
                        purchase.costPerUnit,
                        account?.currency_code ?? "USD",
                        locale
                      )}
                    </td>
                    <td
                      className="px-1 py-3 text-end font-medium break-words tabular-nums sm:px-2"
                      dir="ltr"
                    >
                      {formatPortfolioAmount(
                        purchase.totalAmount,
                        account?.currency_code ?? "USD",
                        locale
                      )}
                    </td>
                    <td
                      className="px-1 py-3 text-end font-medium break-words tabular-nums sm:px-2"
                      dir="ltr"
                    >
                      {purchase.currentValue === null
                        ? "—"
                        : formatPortfolioAmount(
                            purchase.currentValue,
                            account?.currency_code ?? "USD",
                            locale
                          )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="flex justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-4">
            <Button variant="secondary" onClick={onBack}>
              <ArrowLeft size={16} />
              {t("common.back")}
            </Button>
            <Button variant="destructive" onClick={onClose}>
              {t("common.close")}
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
