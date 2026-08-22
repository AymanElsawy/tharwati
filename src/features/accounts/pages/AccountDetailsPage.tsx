import { ArrowLeft, Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { AccountValue } from "@/features/accounts/components/AccountValue"
import { MetalPurchaseHistoryContent } from "@/features/accounts/components/MetalPurchaseHistoryContent"
import { MetalPurchaseEntryDialog } from "@/features/accounts/components/MetalPurchaseDialog"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import { useAccountCurrentValues } from "@/features/accounts/hooks/useAccountCurrentValues"
import { AccountRecordsPage } from "@/features/accounts/pages/AccountRecordsPage"
import {
  aggregateValuedMetalPurchasesByPurity,
  getMetalAccountCurrentPrices,
  getMetalPurchases,
  valueMetalPurchases,
} from "@/features/accounts/services/metal-purchases.service"
import type { MetalPurchaseTransaction } from "@/features/accounts/types/metal-purchase"
import { useTranslation } from "@/i18n/useTranslation"
import type { Decimal } from "@/lib/supabase/types"

export function AccountDetailsPage() {
  const { accountId = "" } = useParams()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const { t, language } = useTranslation()
  const account = accounts.accounts.find((item) => item.id === accountId) ?? null
  const accountsToValue = useMemo(() => account ? [account] : [], [account])
  const accountValues = useAccountCurrentValues(accountsToValue)
  const accountValue = account ? accountValues.values.get(account.id) ?? null : null
  const locale = language === "ar" ? "ar-SA" : "en-US"

  if (accounts.isLoading) return <div className="pb-12"><div className="h-9 w-56 animate-pulse rounded-lg bg-muted" /></div>
  if (!account) return <div className="pb-12"><Button variant="secondary" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button></div>
  if (account.account_type_code === "cash" || account.account_type_code === "bank") return <AccountRecordsPage accountValue={accountValue} isAccountValueLoading={accountValues.isLoading} />
  if (account.account_type_code === "gold") return <MetalAccountDetailsPage accountId={account.id} accountValue={accountValue} isAccountValueLoading={accountValues.isLoading} onAccountValueRefresh={accountValues.refresh} />

  return <div className="pb-12">
    <Button variant="ghost" className="-ms-3 mb-3" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button>
    <p className="tharwati-eyebrow">{t("accounts.page.eyebrow")}</p>
    <h1 className="tharwati-page-title mt-2">{account.name}</h1>
    <AccountValue value={accountValue} currencyCode={account.currency_code} locale={locale} isLoading={accountValues.isLoading} />
  </div>
}

function MetalAccountDetailsPage({ accountId, accountValue, isAccountValueLoading, onAccountValueRefresh }: { accountId: string; accountValue: Decimal | null; isAccountValueLoading: boolean; onAccountValueRefresh: () => Promise<void> }) {
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const accounts = useAccounts()
  const account = accounts.accounts.find((item) => item.id === accountId) ?? null
  const [purchases, setPurchases] = useState<MetalPurchaseTransaction[]>([])
  const [price, setPrice] = useState<Decimal | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false)

  const load = useCallback(async () => {
    if (!account) return
    setIsLoading(true)
    setIsError(false)
    try {
      const [rows, prices] = await Promise.all([
        getMetalPurchases([account.id]),
        getMetalAccountCurrentPrices([account]),
      ])
      setPurchases(rows)
      setPrice(prices.get(account.id) ?? null)
    } catch {
      setIsError(true)
      setPurchases([])
    } finally {
      setIsLoading(false)
    }
  }, [account])

  useEffect(() => { void load() }, [load])

  const valuedPurchases = useMemo(() => valueMetalPurchases(purchases, price), [purchases, price])
  const purities = useMemo(() => aggregateValuedMetalPurchasesByPurity(valuedPurchases), [valuedPurchases])
  const locale = language === "ar" ? "ar-SA" : "en-US"

  if (!account) return null
  return <div className="pb-12">
    <Button variant="ghost" className="-ms-3 mb-3" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button>
    <header className="border-b border-[var(--color-border)] pb-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="tharwati-eyebrow">{t("accounts.metalPurchaseHistory.title", { name: account.name })}</p>
          <h1 className="tharwati-page-title mt-2">{account.name}</h1>
          <AccountValue value={accountValue} currencyCode={account.currency_code} locale={locale} isLoading={isAccountValueLoading} />
        </div>
        <Button onClick={() => setIsPurchaseOpen(true)}><Plus size={16} />{t("accounts.metalPurchase.add")}</Button>
      </div>
    </header>
    <section className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-6">
      <MetalPurchaseHistoryContent account={account} purities={purities} isLoading={isLoading} isError={isError} onOpenPurity={(purity) => navigate(`/accounts/${account.id}/purities/${encodeURIComponent(purity)}`)} />
    </section>
    <MetalPurchaseEntryDialog
      account={isPurchaseOpen ? account : null}
      accounts={accounts.accounts}
      onClose={() => setIsPurchaseOpen(false)}
      onSaved={async () => {
        await Promise.all([load(), onAccountValueRefresh()])
      }}
    />
  </div>
}
