import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/i18n/useTranslation"
import type { AccountSummary, MetalPurchaseRecord } from "@/lib/supabase/types"
import { formatPortfolioAmount, formatPortfolioDecimal } from "@/features/portfolio/utils/portfolio-formatters"
import { getPurityOptions } from "../types/account-form"

function purityLabel(
  metalType: "gold" | "silver",
  purity: string,
  t: ReturnType<typeof useTranslation>["t"]
) {
  const option = getPurityOptions(metalType).find(
    (item) => item.value === purity
  )
  if (!option) return purity
  return option.label ?? t(option.labelKey!)
}

export function MetalPurchaseHistoryDialog({
  account,
  purchases,
  fundingAccounts,
  isLoading,
  isError,
  onClose,
}: {
  account: AccountSummary | null
  purchases: MetalPurchaseRecord[]
  fundingAccounts: AccountSummary[]
  isLoading: boolean
  isError: boolean
  onClose: () => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const metalType = account?.metal_type === "silver" ? "silver" : "gold"
  const fundingAccountsById = new Map(
    fundingAccounts.map((fundingAccount) => [fundingAccount.id, fundingAccount])
  )

  return (
    <Dialog.Root
      open={account !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[80] w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
          <header className="flex items-start justify-between border-b border-[var(--color-border)] px-6 py-5">
            <div>
              <Dialog.Title className="font-heading text-xl font-semibold">
                {t("accounts.metalPurchaseHistory.title", {
                  name: account?.name ?? "",
                })}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {account?.currency_code}
              </Dialog.Description>
            </div>
            <Dialog.Close render={<Button variant="destructive" size="icon" />}>
              <X size={18} />
            </Dialog.Close>
          </header>
          <div className="max-h-[28rem] overflow-auto px-6 py-5">
            {isLoading ? (
              <div
                className="space-y-3"
                role="status"
                aria-label={t("common.loading")}
              >
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-16 flex-1 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <p className="py-8 text-center text-sm text-red-600 dark:text-red-400">
                {t("accounts.metalPurchaseHistory.error")}
              </p>
            ) : purchases.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("accounts.metalPurchaseHistory.empty")}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase">
                    <th className="px-2 py-2 text-start">
                      {t("accounts.form.purchaseDate")}
                    </th>
                    <th className="px-2 py-2 text-start">
                      {t("accounts.form.purity.label")}
                    </th>
                    <th className="px-2 py-2 text-end">
                      {t("accounts.form.balanceGrams")}
                    </th>
                    <th className="px-2 py-2 text-end">
                      {t("accounts.form.costPerUnit")}
                    </th>
                    <th className="px-2 py-2 text-end">
                      {t("accounts.form.totalAmount")}
                    </th>
                    <th className="px-2 py-2 text-start">
                      {t("accounts.metalPurchase.paidFrom")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => {
                    const total = (
                      Number(purchase.quantity_grams) *
                        Number(purchase.cost_per_unit) +
                      Number(purchase.fees)
                    ).toFixed(2)
                    const fundingAccount = purchase.funding_account_id
                      ? fundingAccountsById.get(purchase.funding_account_id)
                      : null

                    return (
                      <tr
                        key={purchase.id}
                        className="border-b border-[var(--color-border)] last:border-b-0"
                      >
                        <td className="px-2 py-2" dir="ltr">
                          {purchase.purchased_at}
                        </td>
                        <td className="px-2 py-2">
                          {purityLabel(metalType, purchase.purity, t)}
                        </td>
                        <td className="px-2 py-2 text-end tabular-nums" dir="ltr">
                          {formatPortfolioDecimal(
                            purchase.quantity_grams,
                            locale,
                            3
                          )}{" "}
                          g
                        </td>
                        <td className="px-2 py-2 text-end tabular-nums" dir="ltr">
                          {formatPortfolioAmount(
                            purchase.cost_per_unit,
                            account?.currency_code ?? "USD",
                            locale
                          )}
                        </td>
                        <td className="px-2 py-2 text-end tabular-nums" dir="ltr">
                          {formatPortfolioAmount(
                            total,
                            account?.currency_code ?? "USD",
                            locale
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {fundingAccount
                            ? fundingAccount.name
                            : t("accounts.metalPurchaseHistory.external")}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          <footer className="flex justify-end border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-4">
            <Button variant="destructive" onClick={onClose}>
              {t("common.close")}
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
