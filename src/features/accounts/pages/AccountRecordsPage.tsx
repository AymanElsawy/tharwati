import { ArrowLeft, Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { AccountRecordFormDialog } from "@/features/accounts/components/AccountRecordFormDialog"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import {
  addAccountRecord,
  getAccountRecords,
  getRecordAccounts,
} from "@/features/accounts/services/account-records.service"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import { useTranslation } from "@/i18n/useTranslation"
import { formatLocalDateTime } from "@/lib/formatting/local-date-time"
import type { AccountRecord } from "../types/account-record"

function recordColor(type: string) {
  if (type === "income") return "text-emerald-700 dark:text-emerald-400"
  if (type === "expense") return "text-red-700 dark:text-red-400"
  return ""
}

export function AccountRecordsPage() {
  const { accountId = "" } = useParams()
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const accounts = useAccounts()
  const [records, setRecords] = useState<AccountRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const locale = language === "ar" ? "ar-SA" : "en-US"
  const account = accounts.accounts.find((item) => item.id === accountId) ?? null
  const recordAccounts = useMemo(() => getRecordAccounts(accounts.accounts), [accounts.accounts])

  const loadRecords = useCallback(async () => {
    if (!accountId) return
    setIsLoading(true)
    setIsError(false)
    try {
      setRecords(await getAccountRecords(accountId))
    } catch {
      setRecords([])
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [accountId])

  useEffect(() => { void loadRecords() }, [loadRecords])

  if (accounts.isLoading) {
    return <div className="pb-12"><div className="h-9 w-56 animate-pulse rounded-lg bg-muted" /></div>
  }

  if (!account || !["cash", "bank"].includes(account.account_type_code)) {
    return <div className="pb-12"><Button variant="secondary" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button></div>
  }

  return <div className="pb-12">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] pb-7">
      <div>
        <Button variant="ghost" className="-ms-3 mb-3" onClick={() => navigate("/accounts")}><ArrowLeft size={16} />{t("common.back")}</Button>
        <p className="tharwati-eyebrow">{t("accounts.records.title")}</p>
        <h1 className="tharwati-page-title mt-2">{account.name}</h1>
        <p className="tharwati-page-description mt-2">{account.currency_code}</p>
      </div>
      <Button onClick={() => setIsFormOpen(true)} disabled={!account.is_active}><Plus size={16} />{t("accounts.records.add")}</Button>
    </header>

    <section className="mt-8 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      {isLoading ? <p className="py-12 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
      : isError ? <p className="py-12 text-center text-sm text-red-600">{t("accounts.records.error")}</p>
      : records.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">{t("accounts.records.empty")}</p>
      : <div className="overflow-x-auto"><table className="w-full min-w-[38rem] text-sm"><thead className="bg-[var(--color-surface-muted)]"><tr className="border-b border-[var(--color-border)] text-xs uppercase text-muted-foreground"><th className="px-4 py-3 text-start">{t("accounts.records.date")}</th><th className="px-4 py-3 text-start">{t("accounts.records.time")}</th><th className="px-4 py-3 text-start">{t("accounts.records.description")}</th><th className="px-4 py-3 text-end">{t("accounts.records.amount")}</th></tr></thead><tbody>{records.map((record) => { const dateTime = formatLocalDateTime(record.occurredAt, locale); const color = recordColor(record.type); return <tr key={record.id} className={`border-b border-[var(--color-border)] last:border-b-0 ${color}`}><td className="px-4 py-3" dir="ltr">{dateTime.date}</td><td className="px-4 py-3 tabular-nums" dir="ltr">{dateTime.time}</td><td className="px-4 py-3">{record.description || record.type}</td><td className="px-4 py-3 text-end font-medium tabular-nums" dir="ltr">{formatPortfolioAmount(record.amount, record.currencyCode, locale)}</td></tr> })}</tbody></table></div>}
    </section>
    <AccountRecordFormDialog open={isFormOpen} initialAccount={account} accounts={recordAccounts} isSaving={isSaving} onClose={() => setIsFormOpen(false)} onSubmit={async (values) => { setIsSaving(true); try { await addAccountRecord(values); await loadRecords(); setIsFormOpen(false); window.dispatchEvent(new Event("tharwati:data-changed")) } finally { setIsSaving(false) } }} />
  </div>
}
