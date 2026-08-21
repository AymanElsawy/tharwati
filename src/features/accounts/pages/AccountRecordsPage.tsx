import { ArrowLeft, Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { AccountRecordFormDialog } from "@/features/accounts/components/AccountRecordFormDialog"
import { DeleteAccountRecordDialog } from "@/features/accounts/components/DeleteAccountRecordDialog"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import {
  addAccountRecord,
  correctAccountRecord,
  getAccountRecordCategoryLabel,
  getAccountRecordHistoryPage,
  getEditableAccountRecord,
  getRecordAccounts,
  groupAccountRecordsByLocalDate,
  reverseAccountRecord,
} from "@/features/accounts/services/account-records.service"
import { getVisibleRecordCategoryTree } from "@/features/accounts/services/record-categories.service"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import { formatLocalCalendarDate, formatLocalDateTime, getRuntimeTimeZone } from "@/lib/formatting/local-date-time"
import { observeAccountRecordsHistoryEnd } from "./account-records-infinite-scroll"
import type { AccountRecordHistoryCursor } from "../repositories/account-records.repository"
import type { AccountRecord, AccountRecordFormValues, EditableAccountRecord } from "../types/account-record"
import type { VisibleRecordMainCategory } from "../types/record-category"

const historyPageSize = 50

function recordColor(type: string) { return type === "income" ? "text-emerald-700 dark:text-emerald-400" : type === "expense" ? "text-red-700 dark:text-red-400" : "" }
function netColor(amount: string) { return amount.startsWith("-") ? "text-red-700 dark:text-red-400" : amount === "0" ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400" }
function errorMessage(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback }

export function AccountRecordsPage() {
  const { accountId = "" } = useParams()
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const accounts = useAccounts()
  const [records, setRecords] = useState<AccountRecord[]>([])
  const [nextCursor, setNextCursor] = useState<AccountRecordHistoryCursor | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [categories, setCategories] = useState<VisibleRecordMainCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isError, setIsError] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<EditableAccountRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [loadMoreTarget, setLoadMoreTarget] = useState<HTMLDivElement | null>(null)
  const [observerGeneration, setObserverGeneration] = useState(0)
  const isPageRequestInFlight = useRef(false)
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const account = accounts.accounts.find((item) => item.id === accountId) ?? null
  const recordAccounts = useMemo(() => getRecordAccounts(accounts.accounts), [accounts.accounts])
  const groups = useMemo(() => groupAccountRecordsByLocalDate(records), [records])

  const loadInitialRecords = useCallback(async () => {
    if (!accountId) return
    setIsLoading(true)
    setIsError(false)
    setPageError(null)
    try {
      const page = await getAccountRecordHistoryPage(accountId, null, historyPageSize, getRuntimeTimeZone())
      setRecords(page.records)
      setNextCursor(page.nextCursor)
      setHasMore(page.hasMore)
      try { setCategories(await getVisibleRecordCategoryTree()) } catch { setCategories([]) }
    } catch {
      setRecords([])
      setNextCursor(null)
      setHasMore(false)
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [accountId])

  const loadNextPage = useCallback(async (isRetry = false) => {
    if (!accountId || !nextCursor || !hasMore || isPageRequestInFlight.current || isLoadingMore || (!isRetry && pageError)) return
    isPageRequestInFlight.current = true
    setIsLoadingMore(true)
    try {
      const page = await getAccountRecordHistoryPage(accountId, nextCursor, historyPageSize, getRuntimeTimeZone())
      setRecords((current) => [...current, ...page.records])
      setNextCursor(page.nextCursor)
      setHasMore(page.hasMore)
      setObserverGeneration((current) => current + 1)
    } catch (error) {
      setPageError(errorMessage(error, t("accounts.records.error")))
    } finally {
      isPageRequestInFlight.current = false
      setIsLoadingMore(false)
    }
  }, [accountId, hasMore, isLoadingMore, nextCursor, pageError, t])

  useEffect(() => { void loadInitialRecords() }, [loadInitialRecords])
  useEffect(() => {
    if (!loadMoreTarget || !hasMore || isLoadingMore || pageError || isPageRequestInFlight.current || typeof IntersectionObserver === "undefined") return
    return observeAccountRecordsHistoryEnd(
      loadMoreTarget,
      () => hasMore && !isLoadingMore && !isPageRequestInFlight.current && pageError === null,
      () => { void loadNextPage() }
    )
  }, [hasMore, isLoadingMore, loadMoreTarget, loadNextPage, observerGeneration, pageError])

  const closeForm = useCallback(() => {
    setIsFormOpen(false)
    setEditingRecord(null)
    setFormError(null)
    setIsDeleteOpen(false)
    setDeleteError(null)
  }, [])

  const openRecordEditor = useCallback(async (recordId: string) => {
    setFormError(null)
    try {
      setEditingRecord(await getEditableAccountRecord(recordId))
    } catch (error) {
      setFormError(errorMessage(error, t("accounts.records.error")))
    }
  }, [t])

  const submitRecord = useCallback(async (values: AccountRecordFormValues) => {
    setIsSaving(true)
    setFormError(null)
    try {
      if (editingRecord) await correctAccountRecord(editingRecord.id, values)
      else await addAccountRecord(values)
      await loadInitialRecords()
      closeForm()
      window.dispatchEvent(new Event("tharwati:data-changed"))
    } catch (error) {
      setFormError(errorMessage(error, t("accounts.records.error")))
    } finally {
      setIsSaving(false)
    }
  }, [closeForm, editingRecord, loadInitialRecords, t])

  const deleteRecord = useCallback(async () => {
    if (!editingRecord) return
    setIsSaving(true)
    setDeleteError(null)
    try {
      await reverseAccountRecord(editingRecord.id)
      await loadInitialRecords()
      closeForm()
      window.dispatchEvent(new Event("tharwati:data-changed"))
    } catch (error) {
      setDeleteError(errorMessage(error, t("accounts.records.error")))
    } finally {
      setIsSaving(false)
    }
  }, [closeForm, editingRecord, loadInitialRecords, t])

  if (accounts.isLoading) return <div className="pb-12"><div className="h-9 w-56 animate-pulse rounded-lg bg-muted" /></div>
  if (!account || !["cash", "bank"].includes(account.account_type_code)) return <div className="pb-12"><Button variant="secondary" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button></div>

  return <div className="pb-12">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] pb-7"><div><Button variant="ghost" className="-ms-3 mb-3" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button><p className="tharwati-eyebrow">{t("accounts.records.title")}</p><h1 className="tharwati-page-title mt-2">{account.name}</h1><p className="tharwati-page-description mt-2">{account.currency_code}</p></div><Button onClick={() => { setFormError(null); setIsFormOpen(true) }} disabled={!account.is_active}><Plus size={16} />{t("accounts.records.add")}</Button></header>
    {formError && !editingRecord && <p role="alert" className="mt-4 text-sm text-red-600">{formError}</p>}
    <section className="mt-8 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      {isLoading ? <p className="py-12 text-center text-sm text-muted-foreground">{t("common.loading")}</p> : isError ? <p className="py-12 text-center text-sm text-red-600">{t("accounts.records.error")}</p> : records.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">{t("accounts.records.empty")}</p> : <table className="w-full table-fixed text-sm"><colgroup><col className="w-[10%]"/><col className="w-1/4"/><col className="w-[45%]"/><col className="w-1/5"/></colgroup>{groups.map((group) => <tbody key={group.date}><tr className="border-y border-[var(--color-border)] bg-[var(--color-surface-muted)]/60"><th colSpan={3} className="px-3 py-2 text-start text-xs font-medium text-[var(--color-text-secondary)]" dir="ltr">{formatLocalCalendarDate(group.date, locale)}</th><td className={`whitespace-nowrap px-3 py-2 text-end text-xs font-medium tabular-nums ${netColor(group.dailyNet)}`} dir="ltr">{formatPortfolioAmount(group.dailyNet, group.currencyCode, locale)}</td></tr>{group.records.map((record) => { const dateTime = formatLocalDateTime(record.occurredAt, locale); const category = record.type === "transfer" ? t("accounts.records.transfer") : getAccountRecordCategoryLabel(record, categories); return <tr key={record.id} tabIndex={0} onClick={() => void openRecordEditor(record.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openRecordEditor(record.id) } }} className={`cursor-pointer border-b border-[var(--color-border)] outline-none transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:bg-[var(--color-surface-muted)] last:border-b-0 ${recordColor(record.type)}`} aria-label={t("accounts.records.edit")}><td className="whitespace-nowrap px-3 py-3 tabular-nums" dir="ltr">{dateTime.time}</td><td className="truncate px-3 py-3 font-medium">{category}</td><td className="truncate px-3 py-3 text-[var(--color-text-secondary)]" title={record.notes ?? undefined}>{record.notes || "—"}</td><td className="whitespace-nowrap px-3 py-3 text-end font-medium tabular-nums" dir="ltr">{formatPortfolioAmount(record.amount, record.currencyCode, locale)}</td></tr> })}</tbody>)}</table>}
      {!isLoading && !isError && hasMore && <div ref={setLoadMoreTarget} className="flex justify-center py-3"><Button size="sm" variant="ghost" className="h-8 px-3 text-xs text-muted-foreground" disabled={isLoadingMore || pageError !== null} onClick={() => void loadNextPage()}>{isLoadingMore ? t("common.loading") : t("accounts.records.loadMore")}</Button></div>}
      {!isLoading && !isError && pageError && <div className="flex items-center justify-center gap-2 px-4 py-3 text-sm text-red-600"><span>{pageError}</span><Button size="sm" variant="outline" onClick={() => { setPageError(null); void loadNextPage(true) }}>{t("portfolio.error.retry")}</Button></div>}
    </section>
    <AccountRecordFormDialog open={isFormOpen || editingRecord !== null} initialAccount={editingRecord ? null : account} initialValues={editingRecord?.values} accounts={recordAccounts} isSaving={isSaving} error={formError} onClose={closeForm} onSubmit={submitRecord} onDelete={editingRecord ? () => { setDeleteError(null); setIsDeleteOpen(true) } : undefined} />
    <DeleteAccountRecordDialog open={isDeleteOpen} isSaving={isSaving} error={deleteError} onCancel={() => { if (!isSaving) { setIsDeleteOpen(false); setDeleteError(null) } }} onConfirm={() => void deleteRecord()} />
  </div>
}
