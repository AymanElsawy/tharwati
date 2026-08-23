import { Dialog } from "@base-ui/react/dialog"
import { ArrowLeft, Pencil, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import {
  holdingsRepository,
  type ExistingHoldingHistoryItem,
} from "@/features/holdings/repositories/holdings.repository"
import type { HoldingDetails } from "@/features/holdings/types/holding"
import { useTranslation } from "@/i18n/useTranslation"
import {
  formatLocalDateTime,
  formatLocalDateTimeInput,
  localDateTimeInputToIso,
} from "@/lib/formatting/local-date-time"

const fieldClass =
  "mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"

function formatAmount(value: string, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function localDateKey(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

function entryFor(item: ExistingHoldingHistoryItem, assetId: string) {
  return item.entries.find((entry) => entry.asset_id === assetId) ?? null
}

type PresentedHistoryItem = ExistingHoldingHistoryItem & {
  presentation: "current" | "updated" | "deleted"
}

function isPositiveDecimal(value: string) {
  return /^\d+(?:\.\d+)?$/.test(value.trim()) &&
    value.replace(/\D/g, "").replace(/^0+/, "") !== ""
}

export function BrokerageHoldingDetailsPage() {
  const { accountId = "", assetId = "" } = useParams()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const { language, t } = useTranslation()
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const account =
    accounts.accounts.find((item) => item.id === accountId) ?? null
  const [holding, setHolding] = useState<HoldingDetails | null>(null)
  const [history, setHistory] = useState<ExistingHoldingHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<PresentedHistoryItem | null>(null)
  const [transactionToDelete, setTransactionToDelete] =
    useState<PresentedHistoryItem | null>(null)
  const [transactionToEdit, setTransactionToEdit] =
    useState<PresentedHistoryItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!account || account.account_type_code !== "brokerage") return
    setIsLoading(true)
    setHasError(false)
    try {
      const [nextHolding, nextHistory] = await Promise.all([
        holdingsRepository.getHoldingForAccountAsset(accountId, assetId),
        holdingsRepository.getExistingHoldingHistory(accountId, assetId),
      ])
      setHolding(nextHolding)
      setHistory(nextHistory)
      return nextHolding
    } catch {
      setHolding(null)
      setHistory([])
      setHasError(true)
      return undefined
    } finally {
      setIsLoading(false)
    }
  }, [account, accountId, assetId])

  useEffect(() => {
    void load()
  }, [load])

  const reversedTransactionIds = useMemo(
    () =>
      new Set(
        history.flatMap((item) =>
          item.reverses_transaction_id ? [item.reverses_transaction_id] : []
        )
      ),
    [history]
  )
  const presentedHistory = useMemo<PresentedHistoryItem[]>(() => {
    const correctedOriginalIds = new Set(
      history.flatMap((item) =>
        item.corrects_transaction_id ? [item.corrects_transaction_id] : []
      )
    )

    return history.flatMap((item) => {
      if (item.transaction_type_code === "opening_position_reversal") {
        return []
      }
      if (
        reversedTransactionIds.has(item.id) &&
        correctedOriginalIds.has(item.id)
      ) {
        return []
      }
      return [
        {
          ...item,
          presentation: reversedTransactionIds.has(item.id)
            ? "deleted"
            : item.corrects_transaction_id
              ? "updated"
              : "current",
        },
      ]
    })
  }, [history, reversedTransactionIds])
  const dateGroups = useMemo(() => {
    const groups = new Map<string, PresentedHistoryItem[]>()
    for (const item of presentedHistory) {
      const key = localDateKey(item.occurred_at)
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    return [...groups.entries()].map(([date, transactions]) => ({
      date,
      transactions,
    }))
  }, [presentedHistory])

  const deleteTransaction = async () => {
    if (!transactionToDelete) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await holdingsRepository.reverseExistingHolding(transactionToDelete.id)
      setTransactionToDelete(null)
      setSelectedTransaction(null)
      const nextHolding = await load()
      window.dispatchEvent(new Event("tharwati:data-changed"))
      if (nextHolding === null) {
        navigate(`/accounts/${accountId}`)
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : t("brokerage.holdingDeleteError")
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const correctTransaction = async (input: {
    transactionId: string
    quantity: string
    averageCost: string
    occurredAt: string
    notes: string | null
    accountFxRate: string | null
  }) => {
    try {
      await holdingsRepository.correctExistingHolding({
        originalTransactionId: input.transactionId,
        quantity: input.quantity,
        averageCost: input.averageCost,
        occurredAt: input.occurredAt,
        notes: input.notes,
        accountFxRate: input.accountFxRate,
      })
      setTransactionToEdit(null)
      setSelectedTransaction(null)
      await load()
      window.dispatchEvent(new Event("tharwati:data-changed"))
      return null
    } catch (error) {
      await load()
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        return t("brokerage.holdingChangedError")
      }
      return error instanceof Error
        ? error.message
        : t("brokerage.holdingEditError")
    }
  }

  if (accounts.isLoading || isLoading) {
    return (
      <div className="pb-12">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }
  if (!account || account.account_type_code !== "brokerage") {
    return (
      <div className="pb-12">
        <Button variant="secondary" onClick={() => navigate("/accounts")}>
          <ArrowLeft size={16} />
          {t("common.back")}
        </Button>
      </div>
    )
  }
  if (!holding && !hasError) {
    return (
      <div className="pb-12">
        <Button
          variant="secondary"
          onClick={() => navigate(`/accounts/${account.id}`)}
        >
          <ArrowLeft size={16} />
          {t("common.back")}
        </Button>
        <p className="mt-6 text-sm text-muted-foreground">
          {t("brokerage.holdingNotFound")}
        </p>
      </div>
    )
  }
  if (hasError || !holding) {
    return (
      <div className="pb-12">
        <Button
          variant="secondary"
          onClick={() => navigate(`/accounts/${account.id}`)}
        >
          <ArrowLeft size={16} />
          {t("common.back")}
        </Button>
        <p className="mt-6 text-sm text-red-600">
          {t("brokerage.holdingHistoryError")}
        </p>
      </div>
    )
  }

  const asset = holding.asset as HoldingDetails["asset"] & {
    exchange?: string | null
  }

  return (
    <div className="pb-12">
      <Button
        variant="ghost"
        className="-ms-3 mb-3"
        onClick={() => navigate(`/accounts/${account.id}`)}
      >
        <ArrowLeft size={16} />
        {t("common.back")}
      </Button>
      <header className="border-b border-[var(--color-border)] pb-7">
        <p className="tharwati-eyebrow">{t("brokerage.holdingDetails")}</p>
        <h1 className="tharwati-page-title mt-2">{asset.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground" dir="ltr">
          {[asset.symbol, asset.exchange].filter(Boolean).join(" · ")}
        </p>
      </header>

      <section className="mt-6 grid grid-cols-1 divide-y divide-[var(--color-border)] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Value label={t("holdings.table.quantity")} value={holding.quantity} />
        <Value
          label={t("holdings.table.averageCost")}
          value={
            holding.average_cost === null
              ? "--"
              : formatAmount(
                  holding.average_cost,
                  holding.cost_currency_code,
                  locale
                )
          }
        />
        <Value
          label={t("holdings.table.totalCost")}
          value={formatAmount(
            holding.total_cost_basis,
            holding.cost_currency_code,
            locale
          )}
        />
        <Value
          label={t("brokerage.assetCurrency")}
          value={asset.currency_code}
        />
        <Value
          label={t("brokerage.accountCurrency")}
          value={holding.cost_currency_code}
        />
      </section>

      <section className="mt-8">
        <h2 className="font-heading mb-3 text-xl">
          {t("brokerage.holdingHistory")}
        </h2>
        {presentedHistory.length === 0 ? (
          <p className="border border-dashed border-[var(--color-border)] px-5 py-8 text-center text-sm text-muted-foreground">
            {t("brokerage.noHoldingHistory")}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            {dateGroups.map((group) => (
              <section key={group.date}>
                <header className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2 text-sm font-semibold">
                  {
                    formatLocalDateTime(`${group.date}T12:00:00.000Z`, locale)
                      .date
                  }
                </header>
                {group.transactions.map((item) => {
                  const entry = entryFor(item, assetId)
                  const isDeleted = item.presentation === "deleted"
                  const rowContent = (
                    <>
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <strong className="block">
                              {t("brokerage.existingHolding")}
                            </strong>
                            {isDeleted ? (
                              <span className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                                {t("brokerage.holdingDeleted")}
                              </span>
                            ) : item.presentation === "updated" ? (
                              <span className="text-xs font-medium text-muted-foreground">
                                {t("brokerage.holdingUpdated")}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {isDeleted
                              ? `${t("brokerage.holdingDeleted")} \u00b7 ${formatLocalDateTime(item.occurred_at, locale).time}`
                              : formatLocalDateTime(item.occurred_at, locale).time}
                          </span>
                        </span>
                        <span className="text-end text-sm tabular-nums">
                          {entry?.quantity_delta ?? "--"}
                        </span>
                      </span>
                      {entry ? (
                        <span className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground sm:grid-cols-4">
                          <span>
                            <span className="block">
                              {t("brokerage.historicalAverageCost")}
                            </span>
                            <strong
                              className={`block tabular-nums ${isDeleted ? "text-muted-foreground" : "text-[var(--color-text-primary)]"}`}
                              dir="ltr"
                            >
                              {entry.unit_price === null
                                ? "--"
                                : formatAmount(
                                    entry.unit_price,
                                    asset.currency_code,
                                    locale
                                  )}
                            </strong>
                          </span>
                          <span>
                            <span className="block">
                              {t("brokerage.accountCostEffect")}
                            </span>
                            <strong
                              className={`block tabular-nums ${isDeleted ? "text-muted-foreground" : "text-[var(--color-text-primary)]"}`}
                              dir="ltr"
                            >
                              {entry.account_cost_basis_delta === null
                                ? "--"
                                : formatAmount(
                                    entry.account_cost_basis_delta,
                                    holding.cost_currency_code,
                                    locale
                                  )}
                            </strong>
                          </span>
                          {asset.currency_code !== holding.cost_currency_code &&
                          entry.account_fx_rate !== null ? (
                            <span>
                              <span className="block">
                                {t("brokerage.historicalFxRate")}
                              </span>
                              <strong
                                className={`block tabular-nums ${isDeleted ? "text-muted-foreground" : "text-[var(--color-text-primary)]"}`}
                                dir="ltr"
                              >
                                {entry.account_fx_rate}
                              </strong>
                            </span>
                          ) : null}
                          {item.notes ? (
                            <span className="min-w-0">
                              <span className="block">
                                {t("investment.notes")}
                              </span>
                              <strong
                                className={`block break-words ${isDeleted ? "text-muted-foreground" : "text-[var(--color-text-primary)]"}`}
                              >
                                {item.notes}
                              </strong>
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </>
                  )
                  return (
                    isDeleted ? (
                      <div
                        key={item.id}
                        className="border-b border-[var(--color-border)] bg-muted/50 px-4 py-3 text-start text-muted-foreground last:border-b-0"
                      >
                        {rowContent}
                      </div>
                    ) : (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setSelectedTransaction(item)}
                        className="w-full border-b border-[var(--color-border)] px-4 py-3 text-start transition-colors last:border-b-0 hover:bg-[var(--color-surface-muted)] focus-visible:bg-[var(--color-surface-muted)]"
                      >
                        {rowContent}
                      </button>
                    )
                  )
                })}
              </section>
            ))}
          </div>
        )}
      </section>

      <HoldingTransactionDialog
        transaction={selectedTransaction}
        assetId={assetId}
        assetCurrency={asset.currency_code}
        accountCurrency={holding.cost_currency_code}
        locale={locale}
        presentation={selectedTransaction?.presentation}
        canDelete={
          selectedTransaction !== null &&
          selectedTransaction.presentation !== "deleted" &&
          !reversedTransactionIds.has(selectedTransaction.id)
        }
        canEdit={
          selectedTransaction !== null &&
          selectedTransaction.presentation !== "deleted" &&
          !reversedTransactionIds.has(selectedTransaction.id)
        }
        onClose={() => setSelectedTransaction(null)}
        onEdit={() =>
          selectedTransaction && setTransactionToEdit(selectedTransaction)
        }
        onDelete={() =>
          selectedTransaction && setTransactionToDelete(selectedTransaction)
        }
      />
      <EditExistingHoldingDialog
        transaction={transactionToEdit}
        assetId={assetId}
        assetCurrency={asset.currency_code}
        accountCurrency={holding.cost_currency_code}
        onClose={() => setTransactionToEdit(null)}
        onSave={correctTransaction}
      />
      <DeleteExistingHoldingDialog
        open={transactionToDelete !== null}
        isSaving={isDeleting}
        error={deleteError}
        onCancel={() => {
          if (!isDeleting) {
            setTransactionToDelete(null)
            setDeleteError(null)
          }
        }}
        onConfirm={() => void deleteTransaction()}
      />
    </div>
  )
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold break-words tabular-nums" dir="ltr">
        {value}
      </p>
    </div>
  )
}

function HoldingTransactionDialog({
  transaction,
  assetId,
  assetCurrency,
  accountCurrency,
  locale,
  presentation,
  canDelete,
  canEdit,
  onClose,
  onEdit,
  onDelete,
}: {
  transaction: PresentedHistoryItem | null
  assetId: string
  assetCurrency: string
  accountCurrency: string
  locale: string
  presentation: PresentedHistoryItem["presentation"] | undefined
  canDelete: boolean
  canEdit: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const entry = transaction ? entryFor(transaction, assetId) : null
  const isCrossCurrency = assetCurrency !== accountCurrency
  return (
    <Dialog.Root
      open={transaction !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/50" />
        <Dialog.Popup className="fixed inset-x-3 top-1/2 z-[80] mx-auto max-h-[calc(100vh-2rem)] w-auto max-w-lg -translate-y-1/2 overflow-y-auto rounded-xl bg-background p-5 shadow-xl sm:inset-x-0">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="font-heading text-xl">
              {t("brokerage.existingHolding")}
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
          {transaction && entry ? (
            <div className="mt-5 space-y-4 text-sm">
              <Detail
                label={t("accounts.records.dateTime")}
                value={[
                  formatLocalDateTime(transaction.occurred_at, locale).date,
                  formatLocalDateTime(transaction.occurred_at, locale).time,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Detail
                label={t("holdings.table.quantity")}
                value={entry.quantity_delta ?? "--"}
              />
              <Detail
                label={t("brokerage.historicalAverageCost")}
                value={
                  entry.unit_price === null
                    ? "--"
                    : formatAmount(entry.unit_price, assetCurrency, locale)
                }
              />
              <Detail
                label={t("brokerage.accountCostEffect")}
                value={
                  entry.account_cost_basis_delta === null
                    ? "--"
                    : formatAmount(
                        entry.account_cost_basis_delta,
                        accountCurrency,
                        locale
                      )
                }
              />
              {isCrossCurrency && entry.account_fx_rate !== null ? (
                <Detail
                  label={t("brokerage.historicalFxRate")}
                  value={String(entry.account_fx_rate)}
                />
              ) : null}
              {transaction.notes ? (
                <Detail
                  label={t("investment.notes")}
                  value={transaction.notes}
                />
              ) : null}
              {presentation !== "current" ? (
                <Detail
                  label={t("brokerage.holdingStatus")}
                  value={t(
                    presentation === "updated"
                      ? "brokerage.holdingUpdated"
                      : "brokerage.holdingDeleted"
                  )}
                />
              ) : null}
              <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] pt-4">
                {canEdit ? (
                  <Button variant="secondary" onClick={onEdit}>
                    <Pencil size={16} />
                    {t("accounts.actions.edit")}
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button variant="destructive" onClick={onDelete}>
                    <Trash2 size={16} />
                    {t("accounts.metalPurchase.delete")}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function EditExistingHoldingDialog({
  transaction,
  assetId,
  assetCurrency,
  accountCurrency,
  onClose,
  onSave,
}: {
  transaction: PresentedHistoryItem | null
  assetId: string
  assetCurrency: string
  accountCurrency: string
  onClose: () => void
  onSave: (input: {
    transactionId: string
    quantity: string
    averageCost: string
    occurredAt: string
    notes: string | null
    accountFxRate: string | null
  }) => Promise<string | null>
}) {
  const { t } = useTranslation()
  const entry = transaction ? entryFor(transaction, assetId) : null
  const isCrossCurrency = assetCurrency !== accountCurrency
  const [quantity, setQuantity] = useState("")
  const [averageCost, setAverageCost] = useState("")
  const [occurredAt, setOccurredAt] = useState(formatLocalDateTimeInput())
  const [notes, setNotes] = useState("")
  const [rate, setRate] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!transaction || !entry) return
    setQuantity(String(entry.quantity_delta ?? ""))
    setAverageCost(String(entry.unit_price ?? ""))
    setOccurredAt(formatLocalDateTimeInput(new Date(transaction.occurred_at)))
    setNotes(transaction.notes ?? "")
    setRate(isCrossCurrency ? String(entry.account_fx_rate ?? "") : "")
    setError(null)
  }, [entry, isCrossCurrency, transaction])

  const submit = async () => {
    if (!transaction || !entry) return
    setIsSaving(true)
    setError(null)
    try {
      const result = await onSave({
        transactionId: transaction.id,
        quantity,
        averageCost,
        occurredAt: localDateTimeInputToIso(occurredAt),
        notes: notes.trim() || null,
        accountFxRate: isCrossCurrency ? rate : null,
      })
      if (result) setError(result)
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : t("brokerage.holdingEditError")
      )
    } finally {
      setIsSaving(false)
    }
  }

  const canSave =
    isPositiveDecimal(quantity) &&
    isPositiveDecimal(averageCost) &&
    occurredAt.trim() !== "" &&
    (!isCrossCurrency || isPositiveDecimal(rate))

  return (
    <Dialog.Root
      open={transaction !== null}
      onOpenChange={(open) => !open && !isSaving && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/50" />
        <Dialog.Popup className="fixed inset-x-3 top-1/2 z-[100] mx-auto max-h-[calc(100vh-1.5rem)] w-auto max-w-lg -translate-y-1/2 overflow-y-auto rounded-xl bg-background p-5 shadow-xl sm:inset-x-0">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="font-heading text-xl">
              {t("brokerage.editExistingHolding")}
            </Dialog.Title>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("common.close")}>
              <X size={18} />
            </Button>
          </div>
          <div className="mt-5 space-y-4">
            <label>
              {t("investment.quantity")}
              <input className={fieldClass} inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
            <label>
              {t("brokerage.averageHistoricalCost")} ({assetCurrency})
              <input className={fieldClass} inputMode="decimal" value={averageCost} onChange={(event) => setAverageCost(event.target.value)} />
            </label>
            {isCrossCurrency ? (
              <label>
                {t("brokerage.historicalFxRate")}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t("brokerage.historicalFxRateHelp", { assetCurrency, accountCurrency })}
                </span>
                <input className={fieldClass} inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} />
              </label>
            ) : null}
            <label>
              {t("accounts.records.dateTime")}
              <input className={fieldClass} type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
            </label>
            <label>
              {t("investment.notes")}
              <textarea className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="w-full" disabled={isSaving || !canSave} onClick={() => void submit()}>
              {isSaving ? t("assets.form.saving") : t("brokerage.saveHolding")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
      <span className="text-muted-foreground">{label}</span>
      <strong className="max-w-60 text-end break-words tabular-nums" dir="ltr">
        {value}
      </strong>
    </div>
  )
}

function DeleteExistingHoldingDialog({
  open,
  isSaving,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean
  isSaving: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => !value && !isSaving && onCancel()}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[100] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
          <Dialog.Title className="font-heading text-xl">
            {t("brokerage.deleteHoldingTitle")}
          </Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("brokerage.deleteHoldingDescription")}
          </Dialog.Description>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <footer className="mt-6 flex justify-end gap-2">
            <Button variant="outline" disabled={isSaving} onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={isSaving}
              onClick={onConfirm}
            >
              {t(
                isSaving
                  ? "brokerage.deletingHolding"
                  : "accounts.metalPurchase.delete"
              )}
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
