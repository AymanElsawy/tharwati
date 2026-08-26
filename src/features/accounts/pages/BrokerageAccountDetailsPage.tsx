import { Dialog } from "@base-ui/react/dialog"
import { ArrowLeft, Plus, Search, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { accountBalancesRepository } from "@/features/account-balances/repositories/account-balances.repository"
import { BrokerageBuyDialog } from "@/features/accounts/components/BrokerageBuyDialog"
import { currencyOptions } from "@/features/accounts/types/account-form"
import {
  assetsRepository,
  type AssetTypeSummary,
} from "@/features/assets/repositories/assets.repository"
import { holdingsRepository } from "@/features/holdings/repositories/holdings.repository"
import type { BrokerageActivityItem } from "@/features/holdings/repositories/holdings.repository"
import type { HoldingDetails } from "@/features/holdings/types/holding"
import { useTranslation } from "@/i18n/useTranslation"
import type { TranslationKey } from "@/i18n/en/translations"
import { formatLocalDateTimeInput } from "@/lib/formatting/local-date-time"
import { supabase } from "@/lib/supabase/client"
import type { AccountSummary, AssetSummary } from "@/lib/supabase/types"
import { addDecimals, compareDecimals } from "@/lib/financial-calculations/decimal"
import { formatLocalDateTime } from "@/lib/formatting/local-date-time"
import {
  assetSearchService,
  type ExternalAssetSearchResult,
} from "@/services/asset-search/asset-search.service"

const fieldClass =
  "mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"

const preferredAssetTypeCodes = [
  "stock",
  "etf",
  "mutual_fund",
  "bond",
  "cryptocurrency",
  "other",
]

function formatAmount(
  value: string | number,
  currency: string,
  locale: string
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

type PresentedActivity = BrokerageActivityItem & {
  presentation: "current" | "updated" | "deleted"
}

function localDateKey(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-")
}

function hasPositive(value: string | null) {
  return value !== null && compareDecimals(value, "0") === 1
}

function absolute(value: string) {
  return value.startsWith("-") ? value.slice(1) : value
}

function sumEntries(
  entries: BrokerageActivityItem["entries"],
  memo: string,
  field: "transaction_amount" | "account_amount" | "cost_basis_delta" | "account_cost_basis_delta"
) {
  return entries.filter((entry) => entry.memo === memo).reduce<string | null>((total, entry) => {
    const value = entry[field]
    if (value === null) return total
    return total === null ? value : addDecimals(total, value)
  }, null)
}

function activityAssetEntry(activity: BrokerageActivityItem) {
  return activity.entries.find((entry) =>
    entry.memo === "brokerage_buy_asset" || entry.memo === "brokerage_sell_asset"
  ) ?? activity.entries.find((entry) => entry.asset_id !== null && entry.quantity_delta !== null && compareDecimals(entry.quantity_delta, "0") !== 0)
}

export function BrokerageAccountDetailsPage({
  account,
}: {
  account: AccountSummary
}) {
  const navigate = useNavigate()
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const [holdings, setHoldings] = useState<HoldingDetails[]>([])
  const [cash, setCash] = useState<string | null>(null)
  const [isHoldingsLoading, setIsHoldingsLoading] = useState(true)
  const [isCashLoading, setIsCashLoading] = useState(true)
  const [holdingsError, setHoldingsError] = useState(false)
  const [cashError, setCashError] = useState(false)
  const [activity, setActivity] = useState<BrokerageActivityItem[]>([])
  const [isActivityLoading, setIsActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<PresentedActivity | null>(null)
  const [isExistingHoldingOpen, setIsExistingHoldingOpen] = useState(false)
  const [isBuyOpen, setIsBuyOpen] = useState(false)

  const load = useCallback(async () => {
    setIsHoldingsLoading(true)
    setIsCashLoading(true)
    setHoldingsError(false)
    setCashError(false)
    setIsActivityLoading(true)
    setActivityError(false)

    await Promise.all([
      holdingsRepository
        .getHoldingsForAccount(account.id)
        .then(setHoldings)
        .catch(() => {
          setHoldings([])
          setHoldingsError(true)
        })
        .finally(() => setIsHoldingsLoading(false)),
      accountBalancesRepository
        .getAccountBalances([account.id])
        .then((balances) => setCash(balances[0]?.currentBalance ?? null))
        .catch(() => {
          setCash(null)
          setCashError(true)
        })
        .finally(() => setIsCashLoading(false)),
      holdingsRepository
        .getBrokerageAccountActivity(account.id)
        .then(setActivity)
        .catch(() => {
          setActivity([])
          setActivityError(true)
        })
        .finally(() => setIsActivityLoading(false)),
    ])
  }, [account.id])

  useEffect(() => {
    void load()
  }, [load])

  const presentedActivity = useMemo<PresentedActivity[]>(() => {
    const reversedIds = new Set(activity.flatMap((item) =>
      item.reverses_transaction_id ? [item.reverses_transaction_id] : []
    ))
    const correctedOriginalIds = new Set(activity.flatMap((item) =>
      item.corrects_transaction_id ? [item.corrects_transaction_id] : []
    ))

    return activity.flatMap((item) => {
      if (item.transaction_type_code === "opening_position_reversal") return []
      if (reversedIds.has(item.id) && correctedOriginalIds.has(item.id)) return []
      return [{
        ...item,
        presentation: reversedIds.has(item.id)
          ? "deleted"
          : item.corrects_transaction_id
            ? "updated"
            : "current",
      }]
    })
  }, [activity])
  const activityGroups = useMemo(() => {
    const groups = new Map<string, PresentedActivity[]>()
    for (const item of presentedActivity) {
      const key = localDateKey(item.occurred_at)
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    return [...groups.entries()].map(([date, items]) => ({ date, items }))
  }, [presentedActivity])

  return (
    <div className="pb-12">
      <Button
        variant="ghost"
        className="-ms-3 mb-3"
        onClick={() => navigate("/accounts")}
      >
        <ArrowLeft size={16} />
        {t("common.back")}
      </Button>

      <header className="border-b border-[var(--color-border)] pb-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="tharwati-eyebrow">{t("accounts.type.brokerage")}</p>
            <h1 className="tharwati-page-title mt-2">{account.name}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("brokerage.availableCash")}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums" dir="ltr">
              {isCashLoading || cash === null
                ? "--"
                : formatAmount(cash, account.currency_code, locale)}
            </p>
            {cashError ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("brokerage.availableCashError")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setIsExistingHoldingOpen(true)}>
              <Plus size={16} />
              {t("brokerage.addExistingHolding")}
            </Button>
            <Button onClick={() => setIsBuyOpen(true)}>
              <Plus size={16} />
              {t("brokerage.buy")}
            </Button>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="font-heading mb-3 text-xl">{t("brokerage.holdings")}</h2>
        {isHoldingsLoading ? (
          <div className="h-28 animate-pulse rounded-lg bg-muted" />
        ) : holdingsError ? (
          <div className="border border-dashed border-[var(--color-border)] px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t("brokerage.holdingsError")}
            </p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => void load()}
            >
              {t("assets.actions.tryAgain")}
            </Button>
          </div>
        ) : holdings.length === 0 ? (
          <div className="border border-dashed border-[var(--color-border)] px-5 py-10 text-center">
            <p className="font-medium">{t("brokerage.noInvestments")}</p>
            <Button
              className="mt-4"
              onClick={() => setIsExistingHoldingOpen(true)}
            >
              <Plus size={16} />
              {t("brokerage.addExistingHolding")}
            </Button>
          </div>
        ) : (
          <div className="divide-y border-y border-[var(--color-border)]">
            {holdings.map((holding) => (
              <HoldingRow key={holding.id} holding={holding} locale={locale} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-heading mb-3 text-xl">{t("brokerage.activity")}</h2>
        {isActivityLoading ? (
          <div className="h-28 animate-pulse rounded-lg bg-muted" />
        ) : activityError ? (
          <div className="border border-dashed border-[var(--color-border)] px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t("brokerage.activityError")}</p>
            <Button variant="secondary" className="mt-3" onClick={() => void load()}>{t("assets.actions.tryAgain")}</Button>
          </div>
        ) : activityGroups.length === 0 ? (
          <p className="border border-dashed border-[var(--color-border)] px-5 py-8 text-center text-sm text-muted-foreground">{t("brokerage.noActivity")}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            {activityGroups.map((group) => (
              <section key={group.date}>
                <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2 text-sm font-semibold">
                  {formatLocalDateTime(`${group.date}T12:00:00.000Z`, locale).date}
                </header>
                {group.items.map((item) => (
                  <BrokerageActivityRow
                    key={item.id}
                    item={item}
                    accountId={account.id}
                    accountCurrency={account.currency_code}
                    locale={locale}
                    t={t}
                    onOpen={() => setSelectedActivity(item)}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </section>

      <ExistingHoldingDialog
        account={isExistingHoldingOpen ? account : null}
        onClose={() => setIsExistingHoldingOpen(false)}
        onSaved={async () => {
          setIsExistingHoldingOpen(false)
          await load()
        }}
      />
      <BrokerageBuyDialog
        account={isBuyOpen ? account : null}
        availableCash={cash}
        onClose={() => setIsBuyOpen(false)}
        onSaved={async () => {
          setIsBuyOpen(false)
          await load()
          window.dispatchEvent(new Event("tharwati:data-changed"))
        }}
      />
      <BrokerageActivityDialog
        activity={selectedActivity}
        accountCurrency={account.currency_code}
        locale={locale}
        onClose={() => setSelectedActivity(null)}
      />
    </div>
  )
}

function HoldingRow({
  holding,
  locale,
}: {
  holding: HoldingDetails
  locale: string
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const asset = holding.asset as HoldingDetails["asset"] & {
    exchange?: string | null
  }

  return (
    <button
      type="button"
      className="grid w-full gap-3 py-4 text-start hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto]"
      aria-label={asset.name}
      onClick={() =>
        navigate(`/accounts/${holding.account_id}/holdings/${holding.asset_id}`)
      }
    >
      <span className="min-w-0">
        <strong className="block truncate">{asset.name}</strong>
        <span className="text-sm text-muted-foreground">
          {[asset.symbol, asset.exchange].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="grid grid-cols-3 gap-2 text-end text-sm tabular-nums sm:gap-4">
        <span>
          <b className="block break-words">{holding.quantity}</b>
          <small>{t("holdings.table.quantity")}</small>
        </span>
        <span>
          <b className="block break-words">
            {holding.average_cost === null
              ? "--"
              : formatAmount(
                  holding.average_cost,
                  holding.cost_currency_code,
                  locale
                )}
          </b>
          <small>{t("holdings.table.averageCost")}</small>
        </span>
        <span>
          <b className="block break-words">
            {formatAmount(
              holding.total_cost_basis,
              holding.cost_currency_code,
              locale
            )}
          </b>
          <small>{t("holdings.table.totalCost")}</small>
        </span>
      </span>
    </button>
  )
}

function activityLabel(item: BrokerageActivityItem, accountId: string, t: (key: TranslationKey) => string) {
  if (item.transaction_type_code === "buy") return t("brokerage.buy")
  if (item.transaction_type_code === "sell") return t("brokerage.sell")
  if (item.transaction_type_code === "opening_position") return t("brokerage.existingHolding")
  if (item.transaction_type_code === "dividend") return t("brokerage.dividend")
  const accountEntry = item.entries.find((entry) => entry.account_id === accountId && entry.asset_id === null)
  return accountEntry?.entry_side === "debit" ? t("brokerage.transferIn") : t("brokerage.transferOut")
}

function BrokerageActivityRow({
  item,
  accountId,
  accountCurrency,
  locale,
  t,
  onOpen,
}: {
  item: PresentedActivity
  accountId: string
  accountCurrency: string
  locale: string
  t: (key: TranslationKey) => string
  onOpen: () => void
}) {
  const assetEntry = activityAssetEntry(item)
  const isDeleted = item.presentation === "deleted"
  const transferEntry = item.entries.find((entry) => entry.account_id === accountId && entry.asset_id === null)
  const label = activityLabel(item, accountId, t)
  const hasDetails = assetEntry !== undefined
  const content = <>
    <span className="min-w-0">
      <span className="flex flex-wrap items-center gap-2">
        <strong>{label}</strong>
        {item.presentation === "updated" ? <span className="text-xs font-medium text-muted-foreground">{t("brokerage.holdingUpdated")}</span> : null}
        {isDeleted ? <span className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{t("brokerage.holdingDeleted")}</span> : null}
      </span>
      {assetEntry?.asset ? <span className="mt-1 block text-sm text-muted-foreground" dir="ltr">{[assetEntry.asset.symbol, assetEntry.asset.exchange].filter(Boolean).join(" · ") || assetEntry.asset.name}</span> : null}
      <span className="mt-1 block text-sm text-muted-foreground">
        {isDeleted ? `${t("brokerage.holdingDeleted")} · ${formatLocalDateTime(item.occurred_at, locale).time}` : formatLocalDateTime(item.occurred_at, locale).time}
      </span>
    </span>
    <span className="text-end text-sm tabular-nums" dir="ltr">
      {assetEntry?.quantity_delta ? absolute(assetEntry.quantity_delta) : transferEntry ? formatAmount(transferEntry.account_amount, accountCurrency, locale) : "--"}
    </span>
  </>

  if (isDeleted || !hasDetails) {
    return <div className={`flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 ${isDeleted ? "bg-muted/50 text-muted-foreground" : ""}`}>{content}</div>
  }
  return <button type="button" onClick={onOpen} className="flex w-full items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3 text-start transition-colors last:border-b-0 hover:bg-[var(--color-surface-muted)] focus-visible:bg-[var(--color-surface-muted)]">{content}</button>
}

function BrokerageActivityDialog({
  activity,
  accountCurrency,
  locale,
  onClose,
}: {
  activity: PresentedActivity | null
  accountCurrency: string
  locale: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const assetEntry = activity ? activityAssetEntry(activity) : undefined
  const isSell = activity?.transaction_type_code === "sell"
  const isBuy = activity?.transaction_type_code === "buy"
  const fees = activity && (isBuy || isSell)
    ? sumEntries(activity.entries, isBuy ? "brokerage_buy_fee" : "brokerage_sell_fee", "transaction_amount")
    : null
  const cash = activity && isSell
    ? sumEntries(activity.entries, "brokerage_sell_cash", "account_amount")
    : null
  const accountCost = activity && isBuy
    ? activity.entries.filter((entry) => entry.asset_id === assetEntry?.asset_id).reduce<string | null>((total, entry) => entry.account_cost_basis_delta === null ? total : total === null ? entry.account_cost_basis_delta : addDecimals(total, entry.account_cost_basis_delta), null)
    : assetEntry?.account_cost_basis_delta ?? null
  const asset = assetEntry?.asset ?? null
  const isCrossCurrency = !!asset && asset.currency_code !== accountCurrency

  return <Dialog.Root open={activity !== null} onOpenChange={(open) => !open && onClose()}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/50" />
      <Dialog.Popup className="fixed inset-x-3 top-1/2 z-[80] mx-auto max-h-[calc(100vh-2rem)] w-auto max-w-lg -translate-y-1/2 overflow-y-auto rounded-xl bg-background p-5 shadow-xl sm:inset-x-0">
        <div className="flex items-center justify-between gap-3">
          <Dialog.Title className="font-heading text-xl">{activity ? activityLabel(activity, activity.entries.find((entry) => entry.account_id)?.account_id ?? "", t) : ""}</Dialog.Title>
          <Button variant="ghost" size="icon" aria-label={t("common.close")} onClick={onClose}><X size={18} /></Button>
        </div>
        {activity && assetEntry ? <div className="mt-5 space-y-4 text-sm">
          {asset ? <ActivityDetail label={t("investment.asset.section")} value={[asset.name, asset.symbol, asset.exchange].filter(Boolean).join(" · ")} /> : null}
          <ActivityDetail label={t("accounts.records.dateTime")} value={[formatLocalDateTime(activity.occurred_at, locale).date, formatLocalDateTime(activity.occurred_at, locale).time].join(", ")} />
          <ActivityDetail label={t("holdings.table.quantity")} value={assetEntry.quantity_delta === null ? "--" : absolute(assetEntry.quantity_delta)} />
          <ActivityDetail label={isBuy || isSell ? t("brokerage.unitPrice") : t("brokerage.historicalAverageCost")} value={assetEntry.unit_price === null || !asset ? "--" : formatAmount(assetEntry.unit_price, asset.currency_code, locale)} />
          {hasPositive(fees) && asset ? <ActivityDetail label={t("investment.fees")} value={formatAmount(fees!, asset.currency_code, locale)} /> : null}
          {isSell && asset ? <ActivityDetail label={t("brokerage.netProceeds")} value={cash === null ? "--" : formatAmount(sumEntries(activity.entries, "brokerage_sell_cash", "transaction_amount")!, asset.currency_code, locale)} /> : null}
          <ActivityDetail label={isSell ? t("brokerage.cashProceeds") : t("brokerage.accountCostEffect")} value={(isSell ? cash : accountCost) === null ? "--" : formatAmount((isSell ? cash : accountCost)!, accountCurrency, locale)} />
          {isCrossCurrency && assetEntry.account_fx_rate !== null ? <ActivityDetail label={t("brokerage.historicalFxRate")} value={assetEntry.account_fx_rate} /> : null}
          {activity.notes ? <ActivityDetail label={t("investment.notes")} value={activity.notes} /> : null}
        </div> : null}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}

function ActivityDetail({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4"><span className="text-muted-foreground">{label}</span><strong className="max-w-60 text-end break-words tabular-nums" dir="ltr">{value}</strong></div>
}

function ExistingHoldingDialog({
  account,
  onClose,
  onSaved,
}: {
  account: AccountSummary | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [assetTypes, setAssetTypes] = useState<AssetTypeSummary[]>([])
  const [assetId, setAssetId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [averageCost, setAverageCost] = useState("")
  const [occurredAt, setOccurredAt] = useState(formatLocalDateTimeInput())
  const [notes, setNotes] = useState("")
  const [rate, setRate] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false)
  const [externalSearchQuery, setExternalSearchQuery] = useState("")
  const [externalResults, setExternalResults] = useState<ExternalAssetSearchResult[]>([])
  const [isExternalSearchLoading, setIsExternalSearchLoading] = useState(false)
  const [isExternalSearchUnavailable, setIsExternalSearchUnavailable] = useState(false)
  const [selectedExternalResult, setSelectedExternalResult] = useState<ExternalAssetSearchResult | null>(null)
  const [resolvingExternalIdentity, setResolvingExternalIdentity] = useState<string | null>(null)
  const [resolvedExternalAssetId, setResolvedExternalAssetId] = useState<string | null>(null)
  const [externalResolutionError, setExternalResolutionError] = useState(false)

  useEffect(() => {
    if (!account) return

    void Promise.all([
      assetsRepository.searchAssets("", 100),
      assetsRepository.getActiveAssetTypes(),
    ])
      .then(([nextAssets, nextTypes]) => {
        setAssets(nextAssets)
        setAssetTypes(nextTypes)
      })
      .catch(() => {
        setAssets([])
        setAssetTypes([])
      })
  }, [account])

  useEffect(() => {
    const query = externalSearchQuery.trim()
    if (query.length < 2) {
      setExternalResults([])
      setIsExternalSearchLoading(false)
      setIsExternalSearchUnavailable(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setIsExternalSearchLoading(true)
      setIsExternalSearchUnavailable(false)
      void assetSearchService.search(query)
        .then((results) => {
          if (!cancelled) setExternalResults(results)
        })
        .catch(() => {
          if (!cancelled) {
            setExternalResults([])
            setIsExternalSearchUnavailable(true)
          }
        })
        .finally(() => {
          if (!cancelled) setIsExternalSearchLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [externalSearchQuery])

  const selected = useMemo(
    () => assets.find((asset) => asset.id === assetId) ?? null,
    [assets, assetId]
  )
  const isCrossCurrency =
    selected?.currency_code !== undefined &&
    selected.currency_code !== account?.currency_code
  const sortedAssetTypes = useMemo(
    () =>
      [...assetTypes].sort((left, right) => {
        const leftIndex = preferredAssetTypeCodes.indexOf(left.code)
        const rightIndex = preferredAssetTypeCodes.indexOf(right.code)
        const priority =
          (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
          (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)

        return priority || left.name.localeCompare(right.name)
      }),
    [assetTypes]
  )

  const save = async () => {
    if (!account || !selected) return

    setSaving(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc("add_existing_holding", {
      p_account_id: account.id,
      p_asset_id: selected.id,
      p_quantity: quantity,
      p_average_cost: averageCost,
      p_occurred_at: new Date(occurredAt).toISOString(),
      p_notes: notes.trim() || null,
      p_account_fx_rate: isCrossCurrency ? rate : null,
    })
    setSaving(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    await onSaved()
  }

  const handleAssetCreated = (asset: AssetSummary) => {
    setAssets((current) =>
      [...current, asset].sort((left, right) =>
        left.name.localeCompare(right.name)
      )
    )
    setAssetId(asset.id)
    setIsAssetDialogOpen(false)
  }

  const handleExternalResultSelected = async (result: ExternalAssetSearchResult) => {
    const identity = `${result.micCode}:${result.symbol}`
    setSelectedExternalResult(result)
    setResolvingExternalIdentity(identity)
    setResolvedExternalAssetId(null)
    setExternalResolutionError(false)

    try {
      const asset = await assetSearchService.resolve(result)
      setAssets((current) => {
        const next = current.filter((candidate) => candidate.id !== asset.id)
        return [...next, asset].sort((left, right) => left.name.localeCompare(right.name))
      })
      setAssetId(asset.id)
      setResolvedExternalAssetId(asset.id)
    } catch {
      setExternalResolutionError(true)
    } finally {
      setResolvingExternalIdentity(null)
    }
  }

  return (
    <>
      <Dialog.Root
        open={account !== null}
        onOpenChange={(value) => {
          if (!value && !saving) onClose()
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Popup className="fixed inset-x-3 top-1/2 z-50 mx-auto max-h-[calc(100vh-1.5rem)] w-auto max-w-lg -translate-y-1/2 overflow-y-auto rounded-xl bg-background p-5 shadow-xl sm:inset-x-0">
            <div className="flex items-center justify-between gap-3">
              <Dialog.Title className="font-heading text-xl">
                {t("brokerage.addExistingHolding")}
              </Dialog.Title>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common.close")}
                onClick={onClose}
              >
                <X size={18} />
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <section className="space-y-3 border-b border-[var(--color-border)] pb-4">
                <label className="block">
                  {t("brokerage.searchExternalAssets")}
                  <div className="relative mt-1">
                    <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      className={`${fieldClass} mt-0 ps-9`}
                      type="search"
                      value={externalSearchQuery}
                      onChange={(event) => {
                        setExternalSearchQuery(event.target.value)
                        setSelectedExternalResult(null)
                        setResolvedExternalAssetId(null)
                        setExternalResolutionError(false)
                      }}
                      placeholder={t("brokerage.searchExternalAssetsPlaceholder")}
                      autoComplete="off"
                    />
                  </div>
                </label>
                {externalSearchQuery.trim().length > 0 && externalSearchQuery.trim().length < 2 ? (
                  <p className="text-xs text-muted-foreground">{t("brokerage.searchExternalAssetsMinimum")}</p>
                ) : null}
                {isExternalSearchLoading ? (
                  <p className="text-sm text-muted-foreground">{t("brokerage.searchExternalAssetsLoading")}</p>
                ) : null}
                {isExternalSearchUnavailable ? (
                  <p className="text-sm text-muted-foreground">{t("brokerage.searchExternalAssetsUnavailable")}</p>
                ) : null}
                {externalResults.length > 0 ? (
                  <div className="divide-y rounded-lg border border-[var(--color-border)]">
                    {externalResults.map((result) => {
                      const isSelected = selectedExternalResult?.symbol === result.symbol && selectedExternalResult.micCode === result.micCode
                      return (
                        <button
                          key={`${result.micCode}:${result.symbol}`}
                          type="button"
                          className={`w-full px-3 py-2.5 text-start transition-colors hover:bg-muted/50 disabled:cursor-wait disabled:opacity-60 ${isSelected ? "bg-muted/50" : ""}`}
                          disabled={resolvingExternalIdentity !== null}
                          onClick={() => void handleExternalResultSelected(result)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <strong className="min-w-0 break-words">{result.name}</strong>
                            <span className="shrink-0 text-xs font-medium text-muted-foreground" dir="ltr">
                              {result.instrumentType}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span dir="ltr"><span className="font-medium">{t("assets.table.symbol")}: </span>{result.symbol}</span>
                            <span><span className="font-medium">{t("assets.table.exchange")}: </span>{result.exchange}</span>
                            <span><span className="font-medium">{t("brokerage.externalAssetCountry")}: </span>{result.country}</span>
                            <span dir="ltr"><span className="font-medium">{t("assets.table.currency")}: </span>{result.currencyCode}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
                {resolvingExternalIdentity ? (
                  <p className="text-xs text-muted-foreground">
                    {t("brokerage.externalAssetResolving")}
                  </p>
                ) : null}
                {!resolvingExternalIdentity && resolvedExternalAssetId ? (
                  <p className="text-xs text-muted-foreground">
                    {t("brokerage.externalAssetSelected")}
                  </p>
                ) : null}
                {externalResolutionError ? (
                  <p className="text-xs text-destructive">
                    {t("brokerage.externalAssetResolveError")}
                  </p>
                ) : null}
              </section>

              {assets.length === 0 ? (
                <div className="border border-dashed border-[var(--color-border)] px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("brokerage.noAssets")}
                  </p>
                  <Button
                    className="mt-4"
                    variant="secondary"
                    onClick={() => setIsAssetDialogOpen(true)}
                  >
                    <Plus size={16} />
                    {t("brokerage.addAssetManually")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    {t("investment.asset.section")}
                    <select
                      className={fieldClass}
                      value={assetId}
                      onChange={(event) => setAssetId(event.target.value)}
                    >
                      <option value="">{t("investment.asset.select")}</option>
                      {assets.map((asset) => (
                        <option value={asset.id} key={asset.id}>
                          {asset.name}
                          {asset.symbol ? ` (${asset.symbol})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAssetDialogOpen(true)}
                    >
                      <Plus size={16} />
                      {t("brokerage.addAssetManually")}
                    </Button>
                  </div>
                </div>
              )}

              <label>
                {t("investment.quantity")}
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </label>
              <label>
                {t("brokerage.averageHistoricalCost")}
                {selected ? ` (${selected.currency_code})` : ""}
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  value={averageCost}
                  onChange={(event) => setAverageCost(event.target.value)}
                />
              </label>
              {isCrossCurrency ? (
                <label>
                  {t("brokerage.historicalFxRate")}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t("brokerage.historicalFxRateHelp", {
                      assetCurrency: selected?.currency_code ?? "",
                      accountCurrency: account?.currency_code ?? "",
                    })}
                  </span>
                  <input
                    className={fieldClass}
                    inputMode="decimal"
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                  />
                </label>
              ) : null}
              <label>
                {t("investment.date")}
                <input
                  className={fieldClass}
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(event) => setOccurredAt(event.target.value)}
                />
              </label>
              <label>
                {t("investment.notes")}
                <textarea
                  className={fieldClass}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button
                className="w-full"
                disabled={
                  saving ||
                  !assetId ||
                  !quantity ||
                  !averageCost ||
                  (isCrossCurrency && !rate)
                }
                onClick={() => void save()}
              >
                {saving ? t("assets.form.saving") : t("brokerage.saveHolding")}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <ManualAssetDialog
        open={isAssetDialogOpen}
        assetTypes={sortedAssetTypes}
        assets={assets}
        onClose={() => setIsAssetDialogOpen(false)}
        onCreated={handleAssetCreated}
      />
    </>
  )
}

function ManualAssetDialog({
  open,
  assetTypes,
  assets,
  onClose,
  onCreated,
}: {
  open: boolean
  assetTypes: AssetTypeSummary[]
  assets: AssetSummary[]
  onClose: () => void
  onCreated: (asset: AssetSummary) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [symbol, setSymbol] = useState("")
  const [exchange, setExchange] = useState("")
  const [assetTypeCode, setAssetTypeCode] = useState("")
  const [currencyCode, setCurrencyCode] = useState("USD")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const identityExists = assets.some(
    (asset) =>
      asset.symbol?.trim().toLocaleLowerCase() ===
        symbol.trim().toLocaleLowerCase() &&
      asset.exchange?.trim().toLocaleLowerCase() ===
        exchange.trim().toLocaleLowerCase()
  )
  const canSave =
    !!name.trim() &&
    !!symbol.trim() &&
    !!exchange.trim() &&
    !!assetTypeCode &&
    !identityExists

  const create = async () => {
    if (!canSave) return

    setSaving(true)
    setError(null)
    try {
      const created = await assetsRepository.createCustomAsset({
        name: name.trim(),
        symbol: symbol.trim(),
        exchange: exchange.trim(),
        assetTypeCode,
        currencyCode,
      })
      onCreated(created)
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : t("assets.error.unexpected")
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value && !saving) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/40" />
        <Dialog.Popup className="fixed inset-x-3 top-1/2 z-[60] mx-auto max-h-[calc(100vh-1.5rem)] w-auto max-w-lg -translate-y-1/2 overflow-y-auto rounded-xl bg-background p-5 shadow-xl sm:inset-x-0">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="font-heading text-xl">
              {t("brokerage.addAssetManually")}
            </Dialog.Title>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.close")}
              onClick={onClose}
            >
              <X size={18} />
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("brokerage.manualAssetDescription")}
          </p>

          <div className="mt-5 space-y-4">
            <label>
              {t("assets.form.name")}
              <input
                className={fieldClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              {t("assets.form.symbol")}
              <input
                className={fieldClass}
                dir="ltr"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
              />
            </label>
            <label>
              {t("assets.form.exchange")}
              <input
                className={fieldClass}
                value={exchange}
                onChange={(event) => setExchange(event.target.value)}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                {t("assets.form.assetType")}
                <select
                  className={fieldClass}
                  value={assetTypeCode}
                  onChange={(event) => setAssetTypeCode(event.target.value)}
                >
                  <option value="">{t("investment.common.choose")}</option>
                  {assetTypes.map((assetType) => (
                    <option key={assetType.code} value={assetType.code}>
                      {assetType.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("assets.form.currency")}
                <select
                  className={fieldClass}
                  value={currencyCode}
                  onChange={(event) => setCurrencyCode(event.target.value)}
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {t(currency.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {identityExists ? (
              <p className="text-sm text-red-600">
                {t("brokerage.assetIdentityExists")}
              </p>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button
              className="w-full"
              disabled={saving || !canSave}
              onClick={() => void create()}
            >
              {saving ? t("assets.form.saving") : t("brokerage.createAsset")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
