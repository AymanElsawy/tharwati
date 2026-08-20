import {
  formatPortfolioAmount,
  formatPortfolioDecimal,
} from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import type { AccountSummary } from "@/lib/supabase/types"
import { getPurityOptions } from "../types/account-form"
import type { ValuedMetalPurityAggregate } from "../types/metal-purchase"

function purityLabel(
  metalType: "gold" | "silver",
  purity: string,
  t: ReturnType<typeof useTranslation>["t"]
) {
  const option = getPurityOptions(metalType).find((item) => item.value === purity)
  return option?.label ?? (option?.labelKey ? t(option.labelKey) : purity)
}

export function MetalPurchaseHistoryContent({
  account,
  purities,
  isLoading,
  isError,
  onOpenPurity,
}: {
  account: AccountSummary
  purities: ValuedMetalPurityAggregate[]
  isLoading: boolean
  isError: boolean
  onOpenPurity: (purity: string) => void
}) {
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const metalType = account.metal_type === "silver" ? "silver" : "gold"

  if (isLoading) return <div className="space-y-3" role="status" aria-label={t("common.loading")}>{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
  if (isError) return <p className="py-8 text-center text-sm text-red-600 dark:text-red-400">{t("accounts.metalPurchaseHistory.error")}</p>
  if (purities.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{t("accounts.metalPurchaseHistory.empty")}</p>

  return <div className="w-full">
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1.15fr)] gap-2 border-b border-[var(--color-border)] px-1 py-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase sm:gap-3 sm:px-3 sm:text-xs sm:tracking-[0.08em]">
      <span className="min-w-0">{t("accounts.metalPurchaseHistory.purity")}</span>
      <span className="min-w-0 text-end break-words">{t("accounts.metalPurchaseHistory.totalQuantity")}</span>
      <span className="min-w-0 text-end break-words">{t("accounts.metalPurchaseHistory.totalCost")}</span>
      <span className="min-w-0 text-end break-words">{t("accounts.metalPurchaseHistory.currentValue")}</span>
    </div>
    {purities.map((purity) => <button key={purity.purity} type="button" className="grid w-full grid-cols-[minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,1.15fr)] gap-2 border-b border-[var(--color-border)] px-1 py-3 text-start text-xs transition-colors last:border-b-0 hover:bg-[var(--color-surface-muted)] sm:gap-3 sm:px-3 sm:text-sm" onClick={() => onOpenPurity(purity.purity)}>
      <span className="min-w-0 font-medium">{purityLabel(metalType, purity.purity, t)}</span>
      <span className="min-w-0 text-end break-words text-muted-foreground tabular-nums" dir="ltr">{formatPortfolioDecimal(purity.totalUnitsGrams, locale, 3)} g</span>
      <span className="min-w-0 text-end font-medium break-words tabular-nums" dir="ltr">{formatPortfolioAmount(purity.totalAmount, account.currency_code, locale)}</span>
      <span className="min-w-0 text-end font-medium break-words tabular-nums" dir="ltr">{purity.currentValue === null ? "—" : formatPortfolioAmount(purity.currentValue, account.currency_code, locale)}</span>
    </button>)}
  </div>
}
