import { Dialog } from "@base-ui/react/dialog"
import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  formatPortfolioAmount,
  formatPortfolioDecimal,
} from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import type { AccountSummary } from "@/lib/supabase/types"
import { getPurityOptions } from "../types/account-form"
import type { MetalPurityAggregate } from "../types/metal-purchase"

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
  purities,
  isLoading,
  isError,
  onClose,
  onAdd,
  onOpenPurity,
}: {
  account: AccountSummary | null
  purities: MetalPurityAggregate[]
  isLoading: boolean
  isError: boolean
  onClose: () => void
  onAdd: () => void
  onOpenPurity: (purity: string) => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const metalType = account?.metal_type === "silver" ? "silver" : "gold"

  return (
    <Dialog.Root
      open={account !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[80] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
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
          <div className="max-h-[28rem] overflow-auto px-4 py-5 sm:px-6">
            {isLoading ? (
              <div className="space-y-3" role="status" aria-label={t("common.loading")}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : isError ? (
              <p className="py-8 text-center text-sm text-red-600 dark:text-red-400">
                {t("accounts.metalPurchaseHistory.error")}
              </p>
            ) : purities.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("accounts.metalPurchaseHistory.empty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[32rem]">
                  <div className="grid grid-cols-[minmax(8rem,1fr)_minmax(9rem,0.9fr)_minmax(10rem,1fr)] gap-4 border-b border-[var(--color-border)] px-4 py-2 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    <span>{t("accounts.metalPurchaseHistory.purity")}</span>
                    <span className="text-end">{t("accounts.metalPurchaseHistory.totalQuantity")}</span>
                    <span className="text-end">{t("accounts.metalPurchaseHistory.totalValue")}</span>
                  </div>
                  {purities.map((purity) => (
                    <button
                      key={purity.purity}
                      type="button"
                      className="grid w-full grid-cols-[minmax(8rem,1fr)_minmax(9rem,0.9fr)_minmax(10rem,1fr)] gap-4 border-b border-[var(--color-border)] px-4 py-3 text-start transition-colors last:border-b-0 hover:bg-[var(--color-surface-muted)]"
                      onClick={() => onOpenPurity(purity.purity)}
                    >
                      <span className="font-medium">
                        {purityLabel(metalType, purity.purity, t)}
                      </span>
                      <span className="text-end text-sm text-muted-foreground tabular-nums" dir="ltr">
                        {formatPortfolioDecimal(purity.totalUnitsGrams, locale, 3)} g
                      </span>
                      <span className="text-end font-medium tabular-nums" dir="ltr">
                        {formatPortfolioAmount(
                          purity.totalAmount,
                          account?.currency_code ?? "USD",
                          locale
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <footer className="flex justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-4">
            <Button onClick={onAdd}>
              <Plus size={16} />
              {t("accounts.metalPurchase.add")}
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
