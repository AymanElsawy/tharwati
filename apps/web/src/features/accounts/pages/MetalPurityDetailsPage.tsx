import { ArrowLeft, ChevronDown, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteMetalPurchaseDialog } from "@/features/accounts/components/DeleteMetalPurchaseDialog"
import {
  MetalPurchaseDialog,
  MetalPurchaseEntryDialog,
} from "@/features/accounts/components/MetalPurchaseDialog"
import {
  formatPortfolioAmount,
  formatPortfolioDecimal,
} from "@/features/portfolio/utils/portfolio-formatters"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import { useAccountCurrentValues } from "@/features/accounts/hooks/useAccountCurrentValues"
import {
  aggregateValuedMetalPurchasesByPurity,
  correctMetalPurchase,
  getEligibleMetalFundingAccounts,
  getMetalAccountCurrentPrices,
  getMetalPurchases,
  reverseMetalPurchase,
  valueMetalPurchases,
} from "@/features/accounts/services/metal-purchases.service"
import type {
  MetalPurchaseFormValues,
  ValuedMetalPurchaseTransaction,
} from "@/features/accounts/types/metal-purchase"
import { useTranslation } from "@/i18n/useTranslation"
import {
  formatLocalCalendarDate,
  formatLocalDateTime,
  formatLocalDateTimeInput,
} from "@/lib/formatting/local-date-time"
import { multiplyDecimals } from "@/lib/financial-calculations/decimal"

type PurchaseDateGroup = {
  date: string
  purchases: ValuedMetalPurchaseTransaction[]
}

function groupPurchasesByDate(
  purchases: readonly ValuedMetalPurchaseTransaction[]
): PurchaseDateGroup[] {
  const groups = new Map<string, ValuedMetalPurchaseTransaction[]>()
  for (const purchase of purchases) {
    const timestamp = new Date(purchase.purchaseDate)
    const date = Number.isNaN(timestamp.getTime())
      ? purchase.purchaseDate
      : [
          timestamp.getFullYear(),
          String(timestamp.getMonth() + 1).padStart(2, "0"),
          String(timestamp.getDate()).padStart(2, "0"),
        ].join("-")
    const group = groups.get(date) ?? []
    group.push(purchase)
    groups.set(date, group)
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, groupedPurchases]) => ({
      date,
      purchases: [...groupedPurchases].sort((left, right) =>
        right.purchaseDate.localeCompare(left.purchaseDate)
      ),
    }))
}

function SummaryValue({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5">
      <p className="text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p className="mt-1 break-words font-semibold tabular-nums" dir="ltr">
        {value}
      </p>
    </div>
  )
}

function PurchaseActionMenu({
  onEdit,
  onDelete,
  menuLabel,
  editLabel,
  deleteLabel,
}: {
  onEdit: () => void
  onDelete: () => void
  menuLabel: string
  editLabel: string
  deleteLabel: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-11 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] sm:size-auto sm:p-1.5"
        aria-label={menuLabel}
      >
        <MoreHorizontal size={17} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          {editLabel}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 size={14} />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function toMetalPurchaseFormValues(
  purchase: ValuedMetalPurchaseTransaction
): MetalPurchaseFormValues {
  return {
    purity: purchase.purity,
    purchaseDate: formatLocalDateTimeInput(new Date(purchase.purchaseDate)),
    unitsGrams: purchase.unitsGrams,
    costPerUnit: purchase.costPerUnit,
    fees: purchase.fees,
    paidFromAccount: purchase.fundingMode === "cash_account",
    fundingAccountId: purchase.fundingAccountId ?? "",
    notes: purchase.notes ?? "",
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function MetalPurityDetailsPage() {
  const { accountId = "", purity = "" } = useParams()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const { t, language } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const account = accounts.accounts.find((item) => item.id === accountId) ?? null
  const accountsToValue = useMemo(() => account ? [account] : [], [account])
  const accountValues = useAccountCurrentValues(accountsToValue)
  const [purchases, setPurchases] = useState<ValuedMetalPurchaseTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<ValuedMetalPurchaseTransaction | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [purchaseToDelete, setPurchaseToDelete] = useState<ValuedMetalPurchaseTransaction | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [expandedPurchaseIds, setExpandedPurchaseIds] = useState<Set<string>>(
    () => new Set()
  )

  const load = useCallback(async () => {
    if (!account || account.account_type_code !== "gold") return
    setIsLoading(true)
    setIsError(false)
    try {
      const [history, prices] = await Promise.all([
        getMetalPurchases([account.id]),
        getMetalAccountCurrentPrices([account]),
      ])
      setPurchases(valueMetalPurchases(history, prices.get(account.id) ?? null))
    } catch {
      setIsError(true)
      setPurchases([])
    } finally {
      setIsLoading(false)
    }
  }, [account])

  useEffect(() => {
    void load()
  }, [load])

  const purityPurchases = useMemo(
    () => purchases.filter((purchase) => purchase.purity === purity),
    [purchases, purity]
  )
  const summary = useMemo(
    () => aggregateValuedMetalPurchasesByPurity(purityPurchases)[0] ?? null,
    [purityPurchases]
  )
  const dateGroups = useMemo(
    () => groupPurchasesByDate(purityPurchases),
    [purityPurchases]
  )
  const editInitialValues = useMemo(
    () => editingPurchase ? toMetalPurchaseFormValues(editingPurchase) : undefined,
    [editingPurchase]
  )

  const deletePurchase = async () => {
    if (!purchaseToDelete) return

    setIsDeleting(true)
    setDeleteError(null)
    try {
      await reverseMetalPurchase(purchaseToDelete.id)
      await Promise.all([load(), accountValues.refresh()])
      if (editingPurchase?.id === purchaseToDelete.id) setEditingPurchase(null)
      setPurchaseToDelete(null)
      window.dispatchEvent(new Event("tharwati:data-changed"))
    } catch {
      setDeleteError(t("accounts.metalPurchase.deleteError"))
    } finally {
      setIsDeleting(false)
    }
  }

  const openDeleteConfirmation = (purchase: ValuedMetalPurchaseTransaction) => {
    setDeleteError(null)
    setPurchaseToDelete(purchase)
  }

  const openPurchaseEditor = (purchase: ValuedMetalPurchaseTransaction) => {
    setEditError(null)
    setEditingPurchase(purchase)
  }

  const savePurchase = async (values: MetalPurchaseFormValues) => {
    if (!editingPurchase) return

    setIsEditing(true)
    setEditError(null)
    try {
      await correctMetalPurchase(editingPurchase.id, accountId, values)
      await Promise.all([load(), accountValues.refresh()])
      setEditingPurchase(null)
      window.dispatchEvent(new Event("tharwati:data-changed"))
    } catch (error) {
      setEditError(errorMessage(error, t("accounts.metalPurchase.editError")))
    } finally {
      setIsEditing(false)
    }
  }

  if (accounts.isLoading) {
    return <div className="pb-12"><div className="h-9 w-56 animate-pulse rounded-lg bg-muted" /></div>
  }

  if (!account || account.account_type_code !== "gold") {
    return <div className="pb-12"><Button variant="secondary" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button></div>
  }

  const backToAccount = () => navigate(`/accounts/${account.id}`)
  const totalQuantity = summary?.totalUnitsGrams ?? "0"
  const totalCost = summary?.totalAmount ?? "0"
  const currentPricePerGram = summary?.currentPricePerGram ?? null
  const currentValue = summary?.currentValue ?? null

  return (
    <div className="pb-12">
      <Button variant="ghost" className="-ms-3 mb-3" onClick={backToAccount}>
        <ArrowLeft size={16} />
        {t("common.back")}
      </Button>

      <header className="border-b border-[var(--color-border)] pb-7">
        <p className="tharwati-eyebrow">
          {t("accounts.metalPurchaseHistory.title", { name: account.name })}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <h1 className="tharwati-page-title min-w-0" dir="ltr">{purity}</h1>
          <div className="ms-auto min-w-0 text-end">
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t("accounts.metalPurchaseHistory.pricePerGram")}
            </p>
            <p className="mt-1 break-words font-semibold tabular-nums" dir="ltr">
              {currentPricePerGram === null
                ? "—"
                : formatPortfolioAmount(
                    currentPricePerGram,
                    account.currency_code,
                    locale
                  )}
            </p>
          </div>
          <Button onClick={() => setIsPurchaseOpen(true)}><Plus size={16} />{t("accounts.metalPurchase.add")}</Button>
        </div>
      </header>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="grid grid-cols-1 divide-y divide-[var(--color-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <SummaryValue
            label={t("accounts.metalPurchaseHistory.totalQuantity")}
            value={`${formatPortfolioDecimal(totalQuantity, locale, 3)} g`}
          />
          <SummaryValue
            label={t("accounts.metalPurchaseHistory.totalCost")}
            value={formatPortfolioAmount(totalCost, account.currency_code, locale)}
          />
          <SummaryValue
            label={t("accounts.metalPurchaseHistory.totalCurrentValue")}
            value={currentValue === null ? "-" : formatPortfolioAmount(currentValue, account.currency_code, locale)}
          />
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {isLoading ? (
          <div className="space-y-3 p-4 sm:p-6" role="status" aria-label={t("common.loading")}>
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : isError ? (
          <p className="px-4 py-8 text-center text-sm text-red-600 dark:text-red-400">{t("accounts.metalPurchaseHistory.error")}</p>
        ) : dateGroups.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("accounts.metalPurchaseHistory.empty")}</p>
        ) : (
          <>
            <div className="hidden min-[560px]:grid grid-cols-[0.8fr_1fr_1.2fr_1fr_1.2fr] gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 px-5 py-2 text-xs font-medium text-[var(--color-text-secondary)] sm:px-6">
              <span>{t("accounts.metalPurchaseHistory.time")}</span>
              <span className="text-end">{t("accounts.metalPurchaseHistory.quantity")}</span>
              <span className="text-end">{t("accounts.metalPurchaseHistory.costPerGram")}</span>
              <span className="text-end">{t("accounts.metalPurchaseHistory.fees")}</span>
              <span className="text-end">{t("accounts.metalPurchaseHistory.totalCost")}</span>
            </div>
            {dateGroups.map((group) => (
              <section key={group.date}>
                <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 px-4 py-2.5 sm:px-6">
                  <h2 className="text-sm font-medium text-[var(--color-text-secondary)]" dir="ltr">
                    {formatLocalCalendarDate(group.date, locale)}
                  </h2>
                </header>
                <div className="hidden min-[560px]:block">
                  {group.purchases.map((purchase) => (
                    <div key={purchase.id} role="button" tabIndex={0} onClick={() => openPurchaseEditor(purchase)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openPurchaseEditor(purchase) } }} className="relative grid cursor-pointer grid-cols-[0.8fr_1fr_1.2fr_1fr_1.2fr] gap-3 border-b border-[var(--color-border)] px-5 py-3 pe-14 text-sm outline-none transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:bg-[var(--color-surface-muted)] last:border-b-0 sm:px-6 sm:pe-16" aria-label={t("accounts.metalPurchase.edit")}>
                      <span className="min-w-0 break-words tabular-nums" dir="ltr">{formatLocalDateTime(purchase.purchaseDate, locale).time}</span>
                      <span className="min-w-0 break-words text-end tabular-nums" dir="ltr">{formatPortfolioDecimal(purchase.unitsGrams, locale, 3)} g</span>
                      <span className="min-w-0 break-words text-end tabular-nums" dir="ltr">{formatPortfolioAmount(purchase.costPerUnit, account.currency_code, locale)}</span>
                      <span className="min-w-0 break-words text-end tabular-nums" dir="ltr">{formatPortfolioAmount(purchase.fees, account.currency_code, locale)}</span>
                      <span className="min-w-0 break-words text-end font-medium tabular-nums" dir="ltr">{formatPortfolioAmount(purchase.totalAmount, account.currency_code, locale)}</span>
                      <div className="absolute top-1/2 end-3 -translate-y-1/2 sm:end-4" onClick={(event) => event.stopPropagation()}>
                        <PurchaseActionMenu
                          menuLabel={t("accounts.metalPurchase.actions")}
                          editLabel={t("accounts.metalPurchase.edit")}
                          deleteLabel={t("accounts.metalPurchase.delete")}
                          onEdit={() => openPurchaseEditor(purchase)}
                          onDelete={() => openDeleteConfirmation(purchase)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="min-[560px]:hidden">
                  {group.purchases.map((purchase) => {
                    const isExpanded = expandedPurchaseIds.has(purchase.id)
                    const detailsId = `metal-purchase-details-${purchase.id}`
                    const purchaseCost = multiplyDecimals(
                      purchase.unitsGrams,
                      purchase.costPerUnit
                    )

                    return (
                    <div key={purchase.id} className="border-b border-[var(--color-border)] last:border-b-0">
                      <div className="flex items-start gap-1 px-3 py-2.5">
                        <button
                          type="button"
                          className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2 text-start text-xs"
                          aria-expanded={isExpanded}
                          aria-controls={detailsId}
                          onClick={() => setExpandedPurchaseIds((current) => {
                            const next = new Set(current)
                            if (next.has(purchase.id)) next.delete(purchase.id)
                            else next.add(purchase.id)
                            return next
                          })}
                        >
                          <span className="min-w-0">
                            <span className="block text-[10px] text-[var(--color-text-secondary)]">{t("accounts.metalPurchaseHistory.time")}</span>
                            <span className="font-medium tabular-nums" dir="ltr">{formatLocalDateTime(purchase.purchaseDate, locale).time}</span>
                          </span>
                          <span className="min-w-0 text-end">
                            <span className="block text-[10px] text-[var(--color-text-secondary)]">{t("accounts.metalPurchaseHistory.status")}</span>
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">{t("accounts.metalPurchaseHistory.posted")}</span>
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[10px] text-[var(--color-text-secondary)]">{t("accounts.metalPurchaseHistory.quantity")}</span>
                            <span className="break-words tabular-nums" dir="ltr">{formatPortfolioDecimal(purchase.unitsGrams, locale, 3)} g</span>
                          </span>
                          <span className="min-w-0 text-end">
                            <span className="block text-[10px] text-[var(--color-text-secondary)]">{t("accounts.metalPurchaseHistory.totalCost")}</span>
                            <span className="break-words font-semibold tabular-nums" dir="ltr">{formatPortfolioAmount(purchase.totalAmount, account.currency_code, locale)}</span>
                          </span>
                        </button>
                        <ChevronDown size={16} className={`mt-4 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                        <div className="shrink-0">
                        <PurchaseActionMenu
                          menuLabel={t("accounts.metalPurchase.actions")}
                          editLabel={t("accounts.metalPurchase.edit")}
                          deleteLabel={t("accounts.metalPurchase.delete")}
                          onEdit={() => openPurchaseEditor(purchase)}
                          onDelete={() => openDeleteConfirmation(purchase)}
                        />
                      </div>
                      </div>
                      {isExpanded ? (
                        <div id={detailsId} className="grid grid-cols-2 gap-x-3 gap-y-3 bg-[var(--color-surface-muted)]/45 px-3 py-3 text-xs">
                          {[
                            [t("accounts.metalPurchaseHistory.purchaseCost"), purchaseCost],
                            [t("accounts.metalPurchaseHistory.fees"), purchase.fees],
                            [t("accounts.metalPurchaseHistory.totalCost"), purchase.totalAmount],
                            [t("accounts.metalPurchaseHistory.costPerGram"), purchase.costPerUnit],
                          ].map(([label, value]) => (
                            <div key={label} className="min-w-0">
                              <span className="block text-[var(--color-text-secondary)]">{label}</span>
                              <span className="mt-0.5 block break-words font-medium tabular-nums" dir="ltr">{formatPortfolioAmount(value, account.currency_code, locale)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </section>
      <MetalPurchaseEntryDialog
        account={isPurchaseOpen ? account : null}
        accounts={accounts.accounts}
        initialPurity={purity}
        onClose={() => setIsPurchaseOpen(false)}
        onSaved={async () => {
          await Promise.all([load(), accountValues.refresh()])
        }}
      />
      <MetalPurchaseDialog
        account={editingPurchase ? account : null}
        fundingAccounts={getEligibleMetalFundingAccounts(accounts.accounts, account.currency_code)}
        initialValues={editInitialValues}
        isSaving={isEditing}
        error={editError}
        onClose={() => {
          if (!isEditing) {
            setEditError(null)
            setEditingPurchase(null)
          }
        }}
        onSubmit={savePurchase}
        onDelete={() => editingPurchase && openDeleteConfirmation(editingPurchase)}
      />
      <DeleteMetalPurchaseDialog
        open={purchaseToDelete !== null}
        isSaving={isDeleting}
        error={deleteError}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteError(null)
            setPurchaseToDelete(null)
          }
        }}
        onConfirm={() => void deletePurchase()}
      />
    </div>
  )
}
