import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { MetalPurchaseHistoryContent } from "@/features/accounts/components/MetalPurchaseHistoryContent"
import { MetalPurityTransactionsDialog } from "@/features/accounts/components/MetalPurityTransactionsDialog"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
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
  const { t } = useTranslation()
  const account = accounts.accounts.find((item) => item.id === accountId) ?? null

  if (accounts.isLoading) return <div className="pb-12"><div className="h-9 w-56 animate-pulse rounded-lg bg-muted" /></div>
  if (!account) return <div className="pb-12"><Button variant="secondary" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button></div>
  if (account.account_type_code === "cash" || account.account_type_code === "bank") return <AccountRecordsPage />
  if (account.account_type_code === "gold") return <MetalAccountDetailsPage accountId={account.id} />

  return <div className="pb-12">
    <Button variant="ghost" className="-ms-3 mb-3" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button>
    <p className="tharwati-eyebrow">{t("accounts.page.eyebrow")}</p>
    <h1 className="tharwati-page-title mt-2">{account.name}</h1>
    <p className="tharwati-page-description mt-2">{account.currency_code}</p>
  </div>
}

function MetalAccountDetailsPage({ accountId }: { accountId: string }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const accounts = useAccounts()
  const account = accounts.accounts.find((item) => item.id === accountId) ?? null
  const [purchases, setPurchases] = useState<MetalPurchaseTransaction[]>([])
  const [price, setPrice] = useState<Decimal | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [purity, setPurity] = useState<string | null>(null)

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
  const purityPurchases = useMemo(() => purity ? valuedPurchases.filter((purchase) => purchase.purity === purity) : [], [purity, valuedPurchases])

  if (!account) return null
  return <div className="pb-12">
    <Button variant="ghost" className="-ms-3 mb-3" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button>
    <header className="border-b border-[var(--color-border)] pb-7">
      <p className="tharwati-eyebrow">{t("accounts.metalPurchaseHistory.title", { name: account.name })}</p>
      <h1 className="tharwati-page-title mt-2">{account.name}</h1>
      <p className="tharwati-page-description mt-2">{account.currency_code}</p>
    </header>
    <section className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-6">
      <MetalPurchaseHistoryContent account={account} purities={purities} isLoading={isLoading} isError={isError} onOpenPurity={setPurity} />
    </section>
    <MetalPurityTransactionsDialog account={account} purity={purity} purchases={purityPurchases} onBack={() => setPurity(null)} onClose={() => setPurity(null)} />
  </div>
}
