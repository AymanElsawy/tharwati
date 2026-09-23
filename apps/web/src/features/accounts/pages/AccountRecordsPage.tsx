import { ArrowLeft, Filter, Plus, X } from "lucide-react"
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { AccountValue } from "@/features/accounts/components/AccountValue"
import { BankCreditSummary } from "@/features/accounts/components/BankCreditSummary"
import { AccountRecordFormDialog } from "@/features/accounts/components/AccountRecordFormDialog"
import { CancelExpenseRefundDialog } from "@/features/accounts/components/CancelExpenseRefundDialog"
import { ExpenseRefundDialog } from "@/features/accounts/components/ExpenseRefundDialog"
import { DeleteAccountRecordDialog } from "@/features/accounts/components/DeleteAccountRecordDialog"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import { useAccountCurrentValues } from "@/features/accounts/hooks/useAccountCurrentValues"
import {
  addAccountRecord,
  correctAccountRecord,
  getAccountRecordCategoryLabel,
  getAccountRecordCategoryPath,
  getAccountRecordHistoryPage,
  getEditableAccountRecord,
  getRecordAccounts,
  groupAccountRecordsByLocalDate,
  reverseAccountRecord,
  addExpenseRefund,
  cancelExpenseRefund,
  eligibleRefundAccounts,
  getExpenseRefundSummary,
} from "@/features/accounts/services/account-records.service"
import { getVisibleRecordCategoryTree } from "@/features/accounts/services/record-categories.service"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import { compareDecimals } from "@/lib/financial-calculations/decimal"
import { useTranslation } from "@/i18n/useTranslation"
import {
  formatLocalCalendarDate,
  formatLocalDateTime,
  getRuntimeTimeZone,
} from "@/lib/formatting/local-date-time"
import { observeAccountRecordsHistoryEnd } from "./account-records-infinite-scroll"
import type { AccountRecordHistoryCursor } from "../repositories/account-records.repository"
import {
  emptyAccountRecordHistoryFilters,
  type AccountRecord,
  type AccountRecordFormValues,
  type AccountRecordHistoryFilters,
  type EditableAccountRecord,
  type ExpenseRefundSummary,
} from "../types/account-record"
import type { VisibleRecordMainCategory } from "../types/record-category"
import type { Decimal } from "@/lib/supabase/types"
import { runMutationThenRefresh } from "@/lib/mutations/mutation-refresh"
import {
  refundSubmissionFingerprint,
  resolveSubmissionAttempt,
  type SubmissionAttempt,
} from "../utils/refund-submission"

const historyPageSize = 50

function recordColor(type: string) {
  return type === "income"
    ? "text-emerald-700 dark:text-emerald-400"
    : type === "expense"
      ? "text-red-700 dark:text-red-400"
      : ""
}
function netColor(amount: string) {
  return amount.startsWith("-")
    ? "text-red-700 dark:text-red-400"
    : amount === "0"
      ? "text-muted-foreground"
      : "text-emerald-700 dark:text-emerald-400"
}
function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function MobileAccountRecordRow({
  record,
  category,
  locale,
  editLabel,
  refundLabel,
  labelDirection,
  onEdit,
}: {
  record: AccountRecord
  category: string | null
  locale: string
  editLabel: string
  refundLabel: string
  labelDirection: "ltr" | "rtl"
  onEdit: () => void
}) {
  const dateTime = formatLocalDateTime(record.occurredAt, locale)
  const content = (
    <>
      <span
        className="flex items-start justify-between gap-3 whitespace-nowrap"
        dir="ltr"
      >
        <span className="shrink-0 tabular-nums">{dateTime.time}</span>
        <span className="shrink-0 text-end font-medium tabular-nums">
          {formatPortfolioAmount(record.amount, record.currencyCode, locale)}
          {record.type === "refund" && (
            <span
              className="mt-0.5 block text-xs font-medium text-[var(--color-text-secondary)]"
              dir={labelDirection}
            >
              {refundLabel}
            </span>
          )}
        </span>
      </span>
      <span className="mt-1 block text-start font-medium break-words whitespace-normal">
        {category}
      </span>
      <span className="mt-0.5 block text-sm break-words text-[var(--color-text-secondary)]">
        {record.notes || "—"}
      </span>
    </>
  )
  const className = `block w-full border-b border-[var(--color-border)] px-3 py-2.5 text-start ${recordColor(record.type)}`
  return record.isEditable || record.type === "refund" ? (
    <button
      type="button"
      onClick={onEdit}
      className={`${className} transition-colors outline-none hover:bg-[var(--color-surface-muted)] focus-visible:bg-[var(--color-surface-muted)]`}
      aria-label={record.type === "refund" ? "Cancel refund" : editLabel}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}

export function AccountRecordsPage({
  accountValue,
  isAccountValueLoading,
}: {
  accountValue?: Decimal | null
  isAccountValueLoading?: boolean
} = {}) {
  const { accountId = "" } = useParams()
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const accounts = useAccounts()
  const [records, setRecords] = useState<AccountRecord[]>([])
  const [filters, setFilters] = useState<AccountRecordHistoryFilters>(
    emptyAccountRecordHistoryFilters
  )
  const [nextCursor, setNextCursor] =
    useState<AccountRecordHistoryCursor | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [categories, setCategories] = useState<VisibleRecordMainCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isError, setIsError] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRecord, setEditingRecord] =
    useState<EditableAccountRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [refundSummary, setRefundSummary] =
    useState<ExpenseRefundSummary | null>(null)
  const [refundExpense, setRefundExpense] =
    useState<EditableAccountRecord | null>(null)
  const [refundToCancel, setRefundToCancel] = useState<AccountRecord | null>(
    null
  )
  const [refundCancellationError, setRefundCancellationError] = useState<
    string | null
  >(null)
  const [refreshStale, setRefreshStale] = useState(false)
  const [loadMoreTarget, setLoadMoreTarget] = useState<HTMLDivElement | null>(
    null
  )
  const [observerGeneration, setObserverGeneration] = useState(0)
  const isPageRequestInFlight = useRef(false)
  const historyRequestVersion = useRef(0)
  const refundAttempt = useRef<SubmissionAttempt | null>(null)
  const cancellationAttempt = useRef<SubmissionAttempt | null>(null)
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const deferredFilters = useDeferredValue(filters)
  const account =
    accounts.accounts.find((item) => item.id === accountId) ?? null
  const accountsToValue = useMemo(
    () => (accountValue === undefined && account ? [account] : []),
    [account, accountValue]
  )
  const resolvedAccountValues = useAccountCurrentValues(accountsToValue)
  const resolvedAccountValue =
    accountValue === undefined
      ? account
        ? (resolvedAccountValues.values.get(account.id) ?? null)
        : null
      : accountValue
  const resolvedAccountValueLoading =
    accountValue === undefined
      ? resolvedAccountValues.isLoading
      : (isAccountValueLoading ?? false)
  const recordAccounts = useMemo(
    () => getRecordAccounts(accounts.accounts),
    [accounts.accounts]
  )
  const groups = useMemo(
    () => groupAccountRecordsByLocalDate(records),
    [records]
  )
  const availableSubcategories = useMemo(() => {
    if (!filters.mainCategoryId)
      return categories.flatMap((main) =>
        main.subcategories.map((subcategory) => ({
          ...subcategory,
          mainId: main.id,
          mainName: main.name,
        }))
      )
    const main = categories.find((item) => item.id === filters.mainCategoryId)
    return (
      main?.subcategories.map((subcategory) => ({
        ...subcategory,
        mainId: main.id,
        mainName: main.name,
      })) ?? []
    )
  }, [categories, filters.mainCategoryId])
  const activeFilterChips = useMemo(() => {
    const main = categories.find((item) => item.id === filters.mainCategoryId)
    const subcategory = availableSubcategories.find(
      (item) => item.id === filters.subcategoryId
    )
    return [
      filters.search && {
        key: "search",
        label: `${t("accounts.records.search")}: ${filters.search}`,
      },
      filters.fromDate && {
        key: "fromDate",
        label: `${t("accounts.records.from")}: ${filters.fromDate}`,
      },
      filters.toDate && {
        key: "toDate",
        label: `${t("accounts.records.to")}: ${filters.toDate}`,
      },
      filters.recordType && {
        key: "recordType",
        label: t(`accounts.records.${filters.recordType}`),
      },
      main && { key: "mainCategoryId", label: main.name },
      subcategory && {
        key: "subcategoryId",
        label: `${subcategory.mainName} → ${subcategory.name}`,
      },
      filters.minAmount && {
        key: "minAmount",
        label: `${t("accounts.records.minAmount")}: ${filters.minAmount}`,
      },
      filters.maxAmount && {
        key: "maxAmount",
        label: `${t("accounts.records.maxAmount")}: ${filters.maxAmount}`,
      },
    ].filter(Boolean) as Array<{
      key: keyof AccountRecordHistoryFilters
      label: string
    }>
  }, [availableSubcategories, categories, filters, t])

  const updateFilters = useCallback(
    (next: Partial<AccountRecordHistoryFilters>) => {
      setFilters((current) => ({ ...current, ...next }))
    },
    []
  )

  const loadInitialRecords = useCallback(
    async (preserveOnError = false) => {
      if (!accountId) return
      const requestVersion = ++historyRequestVersion.current
      if (!preserveOnError) setIsLoading(true)
      if (!preserveOnError) setIsError(false)
      setPageError(null)
      try {
        const page = await getAccountRecordHistoryPage(
          accountId,
          null,
          historyPageSize,
          getRuntimeTimeZone(),
          deferredFilters
        )
        if (requestVersion !== historyRequestVersion.current) return
        setRecords(page.records)
        setNextCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setRefreshStale(false)
        try {
          const visibleCategories = await getVisibleRecordCategoryTree()
          if (requestVersion === historyRequestVersion.current)
            setCategories(visibleCategories)
        } catch {
          if (requestVersion === historyRequestVersion.current)
            setCategories([])
        }
      } catch (error) {
        if (requestVersion !== historyRequestVersion.current) return
        if (preserveOnError) {
          setRefreshStale(true)
        } else {
          setRecords([])
          setNextCursor(null)
          setHasMore(false)
          setIsError(true)
        }
        throw error
      } finally {
        if (requestVersion === historyRequestVersion.current)
          setIsLoading(false)
      }
    },
    [accountId, deferredFilters]
  )

  const loadNextPage = useCallback(
    async (isRetry = false) => {
      if (
        !accountId ||
        !nextCursor ||
        !hasMore ||
        isPageRequestInFlight.current ||
        isLoadingMore ||
        (!isRetry && pageError)
      )
        return
      isPageRequestInFlight.current = true
      const requestVersion = historyRequestVersion.current
      setIsLoadingMore(true)
      try {
        const page = await getAccountRecordHistoryPage(
          accountId,
          nextCursor,
          historyPageSize,
          getRuntimeTimeZone(),
          deferredFilters
        )
        if (requestVersion !== historyRequestVersion.current) return
        setRecords((current) => [...current, ...page.records])
        setNextCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setObserverGeneration((current) => current + 1)
      } catch (error) {
        if (requestVersion === historyRequestVersion.current)
          setPageError(errorMessage(error, t("accounts.records.error")))
      } finally {
        isPageRequestInFlight.current = false
        setIsLoadingMore(false)
      }
    },
    [
      accountId,
      deferredFilters,
      hasMore,
      isLoadingMore,
      nextCursor,
      pageError,
      t,
    ]
  )

  useEffect(() => {
    async function initialize() {
      await loadInitialRecords().catch(() => undefined)
    }
    void initialize()
  }, [loadInitialRecords])
  useEffect(() => {
    if (
      !loadMoreTarget ||
      !hasMore ||
      isLoadingMore ||
      pageError ||
      isPageRequestInFlight.current ||
      typeof IntersectionObserver === "undefined"
    )
      return
    return observeAccountRecordsHistoryEnd(
      loadMoreTarget,
      () =>
        hasMore &&
        !isLoadingMore &&
        !isPageRequestInFlight.current &&
        pageError === null,
      () => {
        void loadNextPage()
      }
    )
  }, [
    hasMore,
    isLoadingMore,
    loadMoreTarget,
    loadNextPage,
    observerGeneration,
    pageError,
  ])

  const closeForm = useCallback(() => {
    setIsFormOpen(false)
    setEditingRecord(null)
    setFormError(null)
    setIsDeleteOpen(false)
    setDeleteError(null)
  }, [])

  const openRecordEditor = useCallback(
    async (recordId: string) => {
      const record = records.find((item) => item.id === recordId)
      if (record?.type === "refund") {
        setRefundCancellationError(null)
        setRefundToCancel(record)
        return
      }
      if (!record?.isEditable) return
      setFormError(null)
      try {
        setEditingRecord(await getEditableAccountRecord(recordId))
      } catch (error) {
        setFormError(errorMessage(error, t("accounts.records.error")))
      }
    },
    [records, t]
  )

  const confirmRefundCancellation = useCallback(async () => {
    if (!refundToCancel) return
    setIsSaving(true)
    setRefundCancellationError(null)
    const attempt = resolveSubmissionAttempt(
      cancellationAttempt.current,
      refundToCancel.id
    )
    cancellationAttempt.current = attempt
    const outcome = await runMutationThenRefresh({
      mutate: () =>
        cancelExpenseRefund(refundToCancel.id, attempt.idempotencyKey),
      onCommitted: () => {
        cancellationAttempt.current = null
        setRefundToCancel(null)
        window.dispatchEvent(new Event("tharwati:data-changed"))
      },
      refresh: () => loadInitialRecords(true),
    })
    if (outcome.mutation === "rejected")
      setRefundCancellationError(
        errorMessage(outcome.error, t("accounts.records.error"))
      )
    setIsSaving(false)
  }, [loadInitialRecords, refundToCancel, t])

  const submitRecord = useCallback(
    async (values: AccountRecordFormValues) => {
      setIsSaving(true)
      setFormError(null)
      const outcome = await runMutationThenRefresh({
        mutate: () =>
          editingRecord
            ? correctAccountRecord(editingRecord.id, values)
            : addAccountRecord(values),
        onCommitted: () => {
          closeForm()
          window.dispatchEvent(new Event("tharwati:data-changed"))
        },
        refresh: () => loadInitialRecords(true),
      })
      if (outcome.mutation === "rejected")
        setFormError(errorMessage(outcome.error, t("accounts.records.error")))
      setIsSaving(false)
    },
    [closeForm, editingRecord, loadInitialRecords, t]
  )

  const deleteRecord = useCallback(async () => {
    if (!editingRecord) return
    setIsSaving(true)
    setDeleteError(null)
    const outcome = await runMutationThenRefresh({
      mutate: () => reverseAccountRecord(editingRecord.id),
      onCommitted: () => {
        closeForm()
        window.dispatchEvent(new Event("tharwati:data-changed"))
      },
      refresh: () => loadInitialRecords(true),
    })
    if (outcome.mutation === "rejected")
      setDeleteError(errorMessage(outcome.error, t("accounts.records.error")))
    setIsSaving(false)
  }, [closeForm, editingRecord, loadInitialRecords, t])

  const openRefund = useCallback(async () => {
    if (!editingRecord || editingRecord.values.type !== "expense") return
    try {
      const summary = await getExpenseRefundSummary(editingRecord.id)
      if ((compareDecimals(summary.remainingRefundableAmount, "0") ?? 0) > 0) {
        setRefundExpense(editingRecord)
        setRefundSummary(summary)
      }
    } catch (error) {
      setFormError(errorMessage(error, t("accounts.records.error")))
    }
  }, [editingRecord, t])
  const submitRefund = useCallback(
    async (values: {
      amount: string
      destinationAccountId: string
      occurredAt: string
      notes: string
    }) => {
      if (!refundExpense) return
      setIsSaving(true)
      setFormError(null)
      const input = {
        expenseTransactionId: refundExpense.id,
        ...values,
      }
      const attempt = resolveSubmissionAttempt(
        refundAttempt.current,
        refundSubmissionFingerprint(input)
      )
      refundAttempt.current = attempt
      const outcome = await runMutationThenRefresh({
        mutate: () =>
          addExpenseRefund({
            ...input,
            idempotencyKey: attempt.idempotencyKey,
          }),
        onCommitted: () => {
          refundAttempt.current = null
          setRefundExpense(null)
          setRefundSummary(null)
          closeForm()
          window.dispatchEvent(new Event("tharwati:data-changed"))
        },
        refresh: () => loadInitialRecords(true),
      })
      if (outcome.mutation === "rejected")
        setFormError(errorMessage(outcome.error, t("accounts.records.error")))
      setIsSaving(false)
    },
    [closeForm, loadInitialRecords, refundExpense, t]
  )

  const filterControls = (
    <div className="grid gap-3">
      <label className="text-xs font-medium text-muted-foreground">
        <span>{t("accounts.records.type")}</span>
        <select
          value={filters.recordType}
          onChange={(event) =>
            updateFilters({
              recordType: event.target
                .value as AccountRecordHistoryFilters["recordType"],
            })
          }
          className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
        >
          <option value="">{t("accounts.records.allTypes")}</option>
          <option value="income">{t("accounts.records.income")}</option>
          <option value="expense">{t("accounts.records.expense")}</option>
          <option value="transfer">{t("accounts.records.transfer")}</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3 min-[1180px]:grid-cols-1">
        <label className="text-xs font-medium text-muted-foreground">
          <span>{t("accounts.records.from")}</span>
          <input
            type="date"
            value={filters.fromDate}
            max={filters.toDate || undefined}
            onChange={(event) =>
              updateFilters({ fromDate: event.target.value })
            }
            className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          <span>{t("accounts.records.to")}</span>
          <input
            type="date"
            value={filters.toDate}
            min={filters.fromDate || undefined}
            onChange={(event) => updateFilters({ toDate: event.target.value })}
            className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
          />
        </label>
      </div>
      <label className="text-xs font-medium text-muted-foreground">
        <span>{t("accounts.records.mainCategory")}</span>
        <select
          value={filters.mainCategoryId}
          onChange={(event) =>
            updateFilters({
              mainCategoryId: event.target.value,
              subcategoryId: "",
            })
          }
          className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
        >
          <option value="">{t("accounts.records.allCategories")}</option>
          {categories.map((main) => (
            <option key={main.id} value={main.id}>
              {main.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-muted-foreground">
        <span>{t("accounts.records.subcategory")}</span>
        <select
          value={filters.subcategoryId}
          onChange={(event) => {
            const selected = availableSubcategories.find(
              (item) => item.id === event.target.value
            )
            updateFilters({
              subcategoryId: event.target.value,
              mainCategoryId: selected?.mainId ?? filters.mainCategoryId,
            })
          }}
          className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
        >
          <option value="">{t("accounts.records.allSubcategories")}</option>
          {availableSubcategories.map((subcategory) => (
            <option key={subcategory.id} value={subcategory.id}>
              {filters.mainCategoryId
                ? subcategory.name
                : `${subcategory.mainName} â†’ ${subcategory.name}`}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3 min-[1180px]:grid-cols-1">
        <label className="text-xs font-medium text-muted-foreground">
          <span>{t("accounts.records.minAmount")}</span>
          <input
            inputMode="decimal"
            value={filters.minAmount}
            onChange={(event) =>
              updateFilters({ minAmount: event.target.value })
            }
            placeholder={account?.currency_code}
            className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
            dir="ltr"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          <span>{t("accounts.records.maxAmount")}</span>
          <input
            inputMode="decimal"
            value={filters.maxAmount}
            onChange={(event) =>
              updateFilters({ maxAmount: event.target.value })
            }
            placeholder={account?.currency_code}
            className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
            dir="ltr"
          />
        </label>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="justify-start text-xs"
        disabled={activeFilterChips.length === 0}
        onClick={() => setFilters(emptyAccountRecordHistoryFilters)}
      >
        {t("accounts.records.clearAll")}
      </Button>
    </div>
  )

  if (accounts.isLoading)
    return (
      <div className="pb-12">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  if (!account || !["cash", "bank"].includes(account.account_type_code))
    return (
      <div className="pb-12">
        <Button variant="secondary" onClick={() => navigate("/accounts")}>
          <ArrowLeft size={16} />
          {t("common.back")}
        </Button>
      </div>
    )

  const isBankCredit =
    account.account_type_code === "bank" && account.bank_subtype === "credit"
  return (
    <div className="pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] pb-7">
        <div>
          <Button
            variant="ghost"
            className="-ms-3 mb-3"
            onClick={() => navigate("/accounts")}
          >
            <ArrowLeft size={16} />
            {t("common.back")}
          </Button>
          <p className="tharwati-eyebrow">{t("accounts.records.title")}</p>
          <h1 className="tharwati-page-title mt-2">{account.name}</h1>
          {isBankCredit ? (
            <BankCreditSummary
              creditCardLimit={account.credit_card_limit}
              currentBalance={resolvedAccountValue}
              dueDayOfMonth={account.due_day_of_month}
              currencyCode={account.currency_code}
              locale={locale}
              isLoading={resolvedAccountValueLoading}
            />
          ) : (
            <AccountValue
              value={resolvedAccountValue}
              currencyCode={account.currency_code}
              locale={locale}
              isLoading={resolvedAccountValueLoading}
            />
          )}
        </div>
        <Button
          onClick={() => {
            setFormError(null)
            setIsFormOpen(true)
          }}
          disabled={!account.is_active}
        >
          <Plus size={16} />
          {t("accounts.records.add")}
        </Button>
      </header>
      {formError && !editingRecord && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {formError}
        </p>
      )}
      {refreshStale && (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <span>{t("accounts.records.savedRefreshFailed")}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadInitialRecords(true).catch(() => undefined)}
          >
            {t("accounts.records.refreshData")}
          </Button>
        </div>
      )}
      <div className="mt-6 min-[1180px]:grid min-[1180px]:grid-cols-[15rem_minmax(0,1fr)] min-[1180px]:gap-6">
        <aside className="hidden min-[1180px]:block">
          <div className="sticky top-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <h2 className="text-sm font-semibold">
              {t("accounts.records.filters")}
            </h2>
            <div className="mt-4">{filterControls}</div>
          </div>
        </aside>
        <div className="min-w-0">
          <section>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[14rem] flex-1">
                <span className="sr-only">{t("accounts.records.search")}</span>
                <Filter
                  aria-hidden="true"
                  size={16}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(event) =>
                    updateFilters({ search: event.target.value })
                  }
                  placeholder={t("accounts.records.search")}
                  className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] ps-9 pe-3 text-sm transition-colors outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-[1180px]:hidden"
                onClick={() => setIsFiltersOpen(true)}
              >
                <Filter size={14} />
                {t("accounts.records.filters")}
              </Button>
            </div>
            <div className="hidden">
              <label className="text-xs font-medium text-muted-foreground">
                <span>{t("accounts.records.type")}</span>
                <select
                  value={filters.recordType}
                  onChange={(event) =>
                    updateFilters({
                      recordType: event.target
                        .value as AccountRecordHistoryFilters["recordType"],
                    })
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
                >
                  <option value="">{t("accounts.records.allTypes")}</option>
                  <option value="income">{t("accounts.records.income")}</option>
                  <option value="expense">
                    {t("accounts.records.expense")}
                  </option>
                  <option value="transfer">
                    {t("accounts.records.transfer")}
                  </option>
                </select>
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                <span>{t("accounts.records.from")}</span>
                <input
                  type="date"
                  value={filters.fromDate}
                  max={filters.toDate || undefined}
                  onChange={(event) =>
                    updateFilters({ fromDate: event.target.value })
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                <span>{t("accounts.records.to")}</span>
                <input
                  type="date"
                  value={filters.toDate}
                  min={filters.fromDate || undefined}
                  onChange={(event) =>
                    updateFilters({ toDate: event.target.value })
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                <span>{t("accounts.records.mainCategory")}</span>
                <select
                  value={filters.mainCategoryId}
                  onChange={(event) =>
                    updateFilters({
                      mainCategoryId: event.target.value,
                      subcategoryId: "",
                    })
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
                >
                  <option value="">
                    {t("accounts.records.allCategories")}
                  </option>
                  {categories.map((main) => (
                    <option key={main.id} value={main.id}>
                      {main.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                <span>{t("accounts.records.subcategory")}</span>
                <select
                  value={filters.subcategoryId}
                  onChange={(event) => {
                    const selected = availableSubcategories.find(
                      (item) => item.id === event.target.value
                    )
                    updateFilters({
                      subcategoryId: event.target.value,
                      mainCategoryId:
                        selected?.mainId ?? filters.mainCategoryId,
                    })
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
                >
                  <option value="">
                    {t("accounts.records.allSubcategories")}
                  </option>
                  {availableSubcategories.map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {filters.mainCategoryId
                        ? subcategory.name
                        : `${subcategory.mainName} → ${subcategory.name}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                <span>{t("accounts.records.minAmount")}</span>
                <input
                  inputMode="decimal"
                  value={filters.minAmount}
                  onChange={(event) =>
                    updateFilters({ minAmount: event.target.value })
                  }
                  placeholder={account.currency_code}
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
                  dir="ltr"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                <span>{t("accounts.records.maxAmount")}</span>
                <input
                  inputMode="decimal"
                  value={filters.maxAmount}
                  onChange={(event) =>
                    updateFilters({ maxAmount: event.target.value })
                  }
                  placeholder={account.currency_code}
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
                  dir="ltr"
                />
              </label>
            </div>
            {activeFilterChips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() =>
                      updateFilters(
                        chip.key === "mainCategoryId"
                          ? { mainCategoryId: "", subcategoryId: "" }
                          : { [chip.key]: "" }
                      )
                    }
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--color-surface-muted)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                  >
                    <span className="truncate">{chip.label}</span>
                    <X size={13} />
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="mt-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
            {isLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : isError ? (
              <p className="py-12 text-center text-sm text-red-600">
                {t("accounts.records.error")}
              </p>
            ) : records.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("accounts.records.empty")}
              </p>
            ) : (
              <>
                <table className="hidden w-full table-fixed text-sm min-[480px]:table">
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-1/4" />
                    <col className="w-[45%]" />
                    <col className="w-1/5" />
                  </colgroup>
                  {groups.map((group) => (
                    <tbody key={group.date}>
                      <tr className="border-y border-[var(--color-border)] bg-[var(--color-surface-muted)]/60">
                        <th
                          colSpan={3}
                          className="px-3 py-2 text-start text-xs font-medium text-[var(--color-text-secondary)]"
                          dir="ltr"
                        >
                          {formatLocalCalendarDate(group.date, locale)}
                        </th>
                        <td
                          className={`px-3 py-2 text-end text-xs font-medium whitespace-nowrap tabular-nums ${netColor(group.dailyNet)}`}
                          dir="ltr"
                        >
                          {formatPortfolioAmount(
                            group.dailyNet,
                            group.currencyCode,
                            locale
                          )}
                        </td>
                      </tr>
                      {group.records.map((record) => {
                        const dateTime = formatLocalDateTime(
                          record.occurredAt,
                          locale
                        )
                        const category =
                          record.type === "transfer"
                            ? t("accounts.records.transfer")
                            : getAccountRecordCategoryLabel(record, categories)
                        return (
                          <tr
                            key={record.id}
                            tabIndex={0}
                            onClick={() => void openRecordEditor(record.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                void openRecordEditor(record.id)
                              }
                            }}
                            className={`cursor-pointer border-b border-[var(--color-border)] transition-colors outline-none last:border-b-0 hover:bg-[var(--color-surface-muted)] focus-visible:bg-[var(--color-surface-muted)] ${recordColor(record.type)}`}
                            aria-label={t("accounts.records.edit")}
                          >
                            <td
                              className="px-3 py-3 whitespace-nowrap tabular-nums"
                              dir="ltr"
                            >
                              {dateTime.time}
                            </td>
                            <td className="truncate px-3 py-3 font-medium">
                              {category}
                            </td>
                            <td
                              className="truncate px-3 py-3 text-[var(--color-text-secondary)]"
                              title={record.notes ?? undefined}
                            >
                              {record.notes || "—"}
                            </td>
                            <td
                              className="px-3 py-3 text-end font-medium whitespace-nowrap tabular-nums"
                              dir="ltr"
                            >
                              {formatPortfolioAmount(
                                record.amount,
                                record.currencyCode,
                                locale
                              )}
                              {record.type === "refund" && (
                                <span
                                  className="mt-0.5 block text-xs font-medium text-[var(--color-text-secondary)]"
                                  dir={language === "ar" ? "rtl" : "ltr"}
                                >
                                  {t("accounts.records.refund")}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  ))}
                </table>
                <div className="min-[480px]:hidden">
                  {groups.map((group) => (
                    <section key={group.date}>
                      <header className="flex items-center justify-between gap-3 border-y border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 px-3 py-2">
                        <h2
                          className="text-xs font-medium text-[var(--color-text-secondary)]"
                          dir="ltr"
                        >
                          {formatLocalCalendarDate(group.date, locale)}
                        </h2>
                        <span
                          className={`text-xs font-medium whitespace-nowrap tabular-nums ${netColor(group.dailyNet)}`}
                          dir="ltr"
                        >
                          {formatPortfolioAmount(
                            group.dailyNet,
                            group.currencyCode,
                            locale
                          )}
                        </span>
                      </header>
                      {group.records.map((record) => (
                        <MobileAccountRecordRow
                          key={record.id}
                          record={record}
                          category={
                            record.type === "transfer"
                              ? t("accounts.records.transfer")
                              : getAccountRecordCategoryLabel(
                                  record,
                                  categories
                                )
                          }
                          locale={locale}
                          editLabel={t("accounts.records.edit")}
                          refundLabel={t("accounts.records.refund")}
                          labelDirection={language === "ar" ? "rtl" : "ltr"}
                          onEdit={() => void openRecordEditor(record.id)}
                        />
                      ))}
                    </section>
                  ))}
                </div>
              </>
            )}
            {!isLoading && !isError && hasMore && (
              <div ref={setLoadMoreTarget} className="flex justify-center py-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-xs text-muted-foreground"
                  disabled={isLoadingMore || pageError !== null}
                  onClick={() => void loadNextPage()}
                >
                  {isLoadingMore
                    ? t("common.loading")
                    : t("accounts.records.loadMore")}
                </Button>
              </div>
            )}
            {!isLoading && !isError && pageError && (
              <div className="flex items-center justify-center gap-2 px-4 py-3 text-sm text-red-600">
                <span>{pageError}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPageError(null)
                    void loadNextPage(true)
                  }}
                >
                  {t("portfolio.error.retry")}
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
      <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <SheetContent
          side="right"
          className="w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-0"
        >
          <SheetHeader className="border-b border-[var(--color-border)]">
            <SheetTitle>{t("accounts.records.filters")}</SheetTitle>
          </SheetHeader>
          <div className="p-4">{filterControls}</div>
        </SheetContent>
      </Sheet>
      <AccountRecordFormDialog
        open={isFormOpen || editingRecord !== null}
        initialAccount={editingRecord ? null : account}
        initialValues={editingRecord?.values}
        accounts={recordAccounts}
        isSaving={isSaving}
        error={formError}
        onClose={closeForm}
        onSubmit={submitRecord}
        onDelete={
          editingRecord
            ? () => {
                setDeleteError(null)
                setIsDeleteOpen(true)
              }
            : undefined
        }
        onRecordRefund={
          editingRecord?.values.type === "expense"
            ? () => void openRefund()
            : undefined
        }
      />
      <ExpenseRefundDialog
        key={`${refundExpense?.id ?? "none"}:${refundSummary?.remainingRefundableAmount ?? "closed"}`}
        open={refundSummary !== null}
        summary={refundSummary}
        accounts={eligibleRefundAccounts(
          recordAccounts,
          refundSummary?.currencyCode ?? account.currency_code
        )}
        originalAccountId={refundExpense?.values.accountId ?? account.id}
        category={
          refundExpense
            ? (getAccountRecordCategoryPath(
                {
                  id: refundExpense.id,
                  type: "expense",
                  occurredAt: "",
                  isEditable: true,
                  description: "",
                  notes: null,
                  mainCategoryId: refundExpense.values.mainCategoryId,
                  subcategoryId: refundExpense.values.subcategoryId,
                  amount: "",
                  currencyCode: account.currency_code,
                  localDate: "",
                  dailyNet: "",
                },
                categories
              ) ?? t("accounts.records.expense"))
            : ""
        }
        saving={isSaving}
        error={formError}
        onClose={() => {
          if (!isSaving) {
            setRefundExpense(null)
            setRefundSummary(null)
          }
        }}
        onSubmit={submitRefund}
      />
      <CancelExpenseRefundDialog
        open={refundToCancel !== null}
        amount={refundToCancel?.amount ?? ""}
        currencyCode={refundToCancel?.currencyCode ?? account.currency_code}
        destinationAccountName={account.name}
        isSaving={isSaving}
        error={refundCancellationError}
        onCancel={() => {
          if (!isSaving) {
            setRefundToCancel(null)
            setRefundCancellationError(null)
          }
        }}
        onConfirm={() => void confirmRefundCancellation()}
      />
      <DeleteAccountRecordDialog
        open={isDeleteOpen}
        isSaving={isSaving}
        error={deleteError}
        onCancel={() => {
          if (!isSaving) {
            setIsDeleteOpen(false)
            setDeleteError(null)
          }
        }}
        onConfirm={() => void deleteRecord()}
      />
    </div>
  )
}
