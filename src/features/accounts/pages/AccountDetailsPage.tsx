import { ArrowLeft, Plus, Tag } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { AccountValue } from "@/features/accounts/components/AccountValue"
import { AccountValuationDialog } from "@/features/accounts/components/AccountValuationDialog"
import { AccountDisposalDialog } from "@/features/accounts/components/AccountDisposalDialog"
import { MetalPurchaseHistoryContent } from "@/features/accounts/components/MetalPurchaseHistoryContent"
import { MetalPurchaseEntryDialog } from "@/features/accounts/components/MetalPurchaseDialog"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import { useAccountCurrentValues } from "@/features/accounts/hooks/useAccountCurrentValues"
import { getBusinessTypeLabel, getIndustryLabel, getPropertyTypeLabel } from "@/features/accounts/types/account-form"
import { attributableValuation, getEffectiveAccountValuations } from "@/features/accounts/services/account-valuations.service"
import { getAccountCurrentOwnership, getAccountDisposals } from "@/features/accounts/services/account-disposals.service"
import type { AccountDisposal, AccountOwnershipProjection } from "@/features/accounts/types/account-disposal"
import { AccountRecordsPage } from "@/features/accounts/pages/AccountRecordsPage"
import { BrokerageAccountDetailsPage } from "@/features/accounts/pages/BrokerageAccountDetailsPage"
import {
  aggregateValuedMetalPurchasesByPurity,
  getMetalAccountCurrentPrices,
  getMetalPurchases,
  valueMetalPurchases,
} from "@/features/accounts/services/metal-purchases.service"
import type { MetalPurchaseTransaction } from "@/features/accounts/types/metal-purchase"
import { useTranslation } from "@/i18n/useTranslation"
import { formatPortfolioPercent } from "@/features/portfolio/utils/portfolio-formatters"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"

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
  if (account.account_type_code === "brokerage") return <BrokerageAccountDetailsPage account={account} brokerageValue={accountValues.brokerageValues.get(account.id) ?? null} isBrokerageValueLoading={accountValues.isLoading} />

  if (account.account_type_code === "real_estate" || account.account_type_code === "business") return <ValuedAccountDetailsPage account={account} />
  return <div className="pb-12">
    <Button variant="ghost" className="-ms-3 mb-3" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button>
    <p className="tharwati-eyebrow">{t("accounts.page.eyebrow")}</p>
    <h1 className="tharwati-page-title mt-2">{account.name}</h1>
    <AccountValue value={accountValue} currencyCode={account.currency_code} locale={locale} isLoading={accountValues.isLoading} />
  </div>
}

function ValuedAccountDetailsPage({ account }: { account: AccountSummary }) {
  const navigate = useNavigate(); const { t, language } = useTranslation()
  const [valuations, setValuations] = useState<Awaited<ReturnType<typeof getEffectiveAccountValuations>>>([])
  const [disposals, setDisposals] = useState<AccountDisposal[]>([])
  const [ownership, setOwnership] = useState<AccountOwnershipProjection | null>(null)
  const [isLoading, setIsLoading] = useState(true); const [isDialogOpen, setIsDialogOpen] = useState(false); const [isDisposalOpen, setIsDisposalOpen] = useState(false)
  const load = useCallback(async () => { setIsLoading(true); try { const [nextValuations, nextOwnership, nextDisposals] = await Promise.all([getEffectiveAccountValuations([account.id]), getAccountCurrentOwnership([account.id]), getAccountDisposals([account.id])]); setValuations(nextValuations); setOwnership(nextOwnership[0] ?? null); setDisposals(nextDisposals) } finally { setIsLoading(false) } }, [account.id])
  useEffect(() => { const timeoutId = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeoutId) }, [load])
  const latest = valuations[0] ?? null; const value = attributableValuation(latest, ownership?.ownershipPercentage ?? null)
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const isSold = account.closed_reason === "sold" || ownership?.isSold === true
  const sale = disposals.find((disposal) => disposal.isEffective) ?? null
  const currentOwnership = ownership?.ownershipPercentage === null
    ? "—"
    : ownership
      ? formatPortfolioPercent(ownership.ownershipPercentage, locale)
      : "—"
  const metadata = account.account_type_code === "business"
    ? [
        { label: t("accounts.form.businessType"), value: getBusinessTypeLabel(account.business_type, t) },
        { label: t("accounts.form.industry"), value: getIndustryLabel(account.industry, t) },
        { label: t("accounts.form.ownershipPercentage"), value: currentOwnership },
        ...(account.notes ? [{ label: t("accounts.form.notes"), value: account.notes }] : []),
      ]
    : [
        { label: t("accounts.form.propertyType.label"), value: getPropertyTypeLabel(account.property_type, t) },
        { label: t("accounts.form.ownershipPercentage"), value: currentOwnership },
        ...(account.location ? [{ label: t("accounts.form.location"), value: account.location }] : []),
        ...(account.notes ? [{ label: t("accounts.form.notes"), value: account.notes }] : []),
      ]

  return <div className="pb-12"><Button variant="ghost" className="-ms-3 mb-3" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button><header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] pb-7"><div><p className="tharwati-eyebrow">{t("accounts.page.eyebrow")}</p><div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="tharwati-page-title">{account.name}</h1>{isSold ? <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{t("accounts.disposal.sold")}</span> : null}</div>{isSold ? <p className="mt-2 text-sm text-muted-foreground">{t("accounts.disposal.saleDate")}: {account.closed_on ?? sale?.disposedOn ?? "—"}</p> : null}<p className="mt-3 text-sm text-muted-foreground">{t("accounts.valuation.attributableValue")}</p><AccountValue value={value} currencyCode={account.currency_code} locale={locale} isLoading={isLoading} /></div>{!isSold ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setIsDisposalOpen(true)}><Tag size={16} />{t(account.account_type_code === "real_estate" ? "accounts.disposal.markSold" : "accounts.disposal.sellOwnership")}</Button><Button onClick={() => setIsDialogOpen(true)}><Plus size={16} />{t("accounts.valuation.updateValue")}</Button></div> : null}</header><section className="mt-5 rounded-2xl border border-[var(--color-border)] p-5"><h2 className="font-heading text-lg font-semibold">{t("accounts.details.metadata")}</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{metadata.map((item) => <div key={item.label}><dt className="text-xs font-medium text-muted-foreground">{item.label}</dt><dd className="mt-1 text-sm font-medium whitespace-pre-wrap">{item.value}</dd></div>)}</dl></section><section className="mt-7 rounded-2xl border border-[var(--color-border)] p-5"><h2 className="font-heading text-lg font-semibold">{t("accounts.valuation.history")}</h2>{valuations.length === 0 && !isLoading ? <p className="mt-3 text-sm text-muted-foreground">{t("accounts.currentValueUnavailable")}</p> : <div className="mt-4 space-y-3">{valuations.map((valuation) => <div key={valuation.id} className="rounded-xl bg-[var(--color-surface-muted)] p-3"><div className="flex justify-between gap-3"><span>{valuation.valuedOn}</span><span dir="ltr">{t("accounts.valuation.fullValue")}: {valuation.valuationAmount} {account.currency_code}</span></div>{valuation.valuationMethod ? <p className="mt-1 text-sm text-muted-foreground">{valuation.valuationMethod}</p> : null}{valuation.notes ? <p className="mt-1 text-sm text-muted-foreground">{valuation.notes}</p> : null}</div>)}</div>}</section>{disposals.length > 0 ? <section className="mt-5 rounded-2xl border border-[var(--color-border)] p-5"><h2 className="font-heading text-lg font-semibold">{t("accounts.disposal.history")}</h2><div className="mt-4 space-y-3">{disposals.map((disposal) => <div key={disposal.id} className="rounded-xl bg-[var(--color-surface-muted)] p-3"><div className="flex justify-between gap-3"><span>{disposal.disposedOn}</span><span dir="ltr">{disposal.saleAmount} {disposal.saleCurrencyCode}</span></div><p className="mt-1 text-sm text-muted-foreground">{disposal.ownershipPercentageSold}%</p>{disposal.notes ? <p className="mt-1 text-sm text-muted-foreground">{disposal.notes}</p> : null}</div>)}</div></section> : null}<AccountValuationDialog account={isDialogOpen ? account : null} onClose={() => setIsDialogOpen(false)} onSaved={load} /><AccountDisposalDialog account={isDisposalOpen ? account : null} currentOwnership={ownership?.ownershipPercentage ?? null} onClose={() => setIsDisposalOpen(false)} onSaved={load} /></div>
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

  useEffect(() => { const timeoutId = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeoutId) }, [load])

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
