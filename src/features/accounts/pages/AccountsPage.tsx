import { AlertTriangle, Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog"
import {
  AccountFilterBar,
  type AccountFilters,
} from "@/features/accounts/components/AccountFilterBar"
import { AccountFormDialog } from "@/features/accounts/components/AccountFormDialog"
import {
  AccountInventory,
  type AccountInventoryItem,
  type AccountInventorySort,
} from "@/features/accounts/components/AccountInventory"
import { ArchiveAccountDialog } from "@/features/accounts/components/ArchiveAccountDialog"
import { AccountRecordsDialog } from "@/features/accounts/components/AccountRecordsDialog"
import { DeleteAccountDialog } from "@/features/accounts/components/DeleteAccountDialog"
import { MetalPurchaseDialog } from "@/features/accounts/components/MetalPurchaseDialog"
import { MetalPurchaseHistoryDialog } from "@/features/accounts/components/MetalPurchaseHistoryDialog"
import { MetalPurityTransactionsDialog } from "@/features/accounts/components/MetalPurityTransactionsDialog"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import {
  addMetalPurchase,
  aggregateMetalPurchases,
  aggregateMetalPurchasesByPurity,
  getEligibleMetalFundingAccounts,
  getMetalPurchases,
} from "@/features/accounts/services/metal-purchases.service"
import { getAccountRecords } from "@/features/accounts/services/account-records.service"
import {
  accountToFormValues,
  emptyAccountFormValues,
  type AccountFormValues,
} from "@/features/accounts/types/account-form"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { useTranslation } from "@/i18n/useTranslation"
import type { AccountSummary } from "@/lib/supabase/types"
import type { MetalPurchaseTransaction } from "@/features/accounts/types/metal-purchase"
import type { AccountRecord } from "@/features/accounts/types/account-record"

function compareValues(left: string, right: string, direction: "asc" | "desc") {
  const result = left.localeCompare(right)
  return direction === "asc" ? result : -result
}

export function AccountsPage() {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const [form, setForm] = useState<{
    mode: "create" | "edit"
    account: AccountSummary | null
  } | null>(null)
  const [confirm, setConfirm] = useState<{
    mode: "archive" | "delete"
    account: AccountSummary
  } | null>(null)
  const [metalPurchaseAccount, setMetalPurchaseAccount] =
    useState<AccountSummary | null>(null)
  const [isSavingMetalPurchase, setIsSavingMetalPurchase] = useState(false)
  const [purchaseHistoryAccount, setPurchaseHistoryAccount] =
    useState<AccountSummary | null>(null)
  const [selectedMetalPurity, setSelectedMetalPurity] = useState<string | null>(
    null
  )
  const [metalPurchases, setMetalPurchases] = useState<
    MetalPurchaseTransaction[]
  >([])
  const [isLoadingPurchaseHistory, setIsLoadingPurchaseHistory] =
    useState(false)
  const [purchaseHistoryError, setPurchaseHistoryError] = useState(false)
  const [accountRecordsAccount, setAccountRecordsAccount] =
    useState<AccountSummary | null>(null)
  const [accountRecords, setAccountRecords] = useState<AccountRecord[]>([])
  const [isLoadingAccountRecords, setIsLoadingAccountRecords] = useState(false)
  const [accountRecordsError, setAccountRecordsError] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [filters, setFilters] = useState<AccountFilters>({
    search: "",
    type: null,
    currency: null,
    showArchived: false,
  })
  const [sort, setSort] = useState<AccountInventorySort>("name")
  const [direction, setDirection] = useState<"asc" | "desc">("asc")
  const unsaved = useUnsavedChanges(formDirty)

  const metalAccountIds = useMemo(
    () =>
      accounts.accounts
        .filter((account) => account.account_type_code === "gold")
        .map((account) => account.id),
    [accounts.accounts]
  )

  const loadMetalPurchases = useCallback(async () => {
    setIsLoadingPurchaseHistory(true)
    setPurchaseHistoryError(false)
    try {
      setMetalPurchases(await getMetalPurchases(metalAccountIds))
    } catch {
      setPurchaseHistoryError(true)
    } finally {
      setIsLoadingPurchaseHistory(false)
    }
  }, [metalAccountIds])

  useEffect(() => {
    void loadMetalPurchases()
  }, [loadMetalPurchases])

  const loadAccountRecords = useCallback(async (accountId: string) => {
    setIsLoadingAccountRecords(true)
    setAccountRecordsError(false)
    setAccountRecords([])
    try {
      setAccountRecords(await getAccountRecords(accountId))
    } catch {
      setAccountRecords([])
      setAccountRecordsError(true)
    } finally {
      setIsLoadingAccountRecords(false)
    }
  }, [])

  useEffect(() => {
    if (!accountRecordsAccount) {
      setAccountRecords([])
      setAccountRecordsError(false)
      return
    }
    void loadAccountRecords(accountRecordsAccount.id)
  }, [accountRecordsAccount, loadAccountRecords])

  const metalAggregates = useMemo(
    () => aggregateMetalPurchases(metalPurchases),
    [metalPurchases]
  )
  const purchaseHistory = useMemo(
    () =>
      purchaseHistoryAccount
        ? metalPurchases.filter(
            (purchase) => purchase.accountId === purchaseHistoryAccount.id
          )
        : [],
    [metalPurchases, purchaseHistoryAccount]
  )
  const purityBreakdown = useMemo(
    () => aggregateMetalPurchasesByPurity(purchaseHistory),
    [purchaseHistory]
  )
  const purityTransactions = useMemo(
    () =>
      selectedMetalPurity
        ? purchaseHistory.filter(
            (purchase) => purchase.purity === selectedMetalPurity
          )
        : [],
    [purchaseHistory, selectedMetalPurity]
  )

  const defaults = useMemo<AccountFormValues>(
    () =>
      form?.account
        ? accountToFormValues(form.account)
        : emptyAccountFormValues,
    [form]
  )

  const closeForm = () =>
    unsaved.request(() => {
      setForm(null)
      setFormDirty(false)
    })

  const currencies = useMemo(
    () =>
      [
        ...new Set(accounts.accounts.map((account) => account.currency_code)),
      ].sort(),
    [accounts.accounts]
  )

  const items = useMemo<AccountInventoryItem[]>(() => {
    const filtered = accounts.accounts.filter((account) => {
      if (
        filters.search &&
        !account.name.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false
      if (filters.type && account.account_type_code !== filters.type)
        return false
      if (filters.currency && account.currency_code !== filters.currency)
        return false
      if (!filters.showArchived && !account.is_active) return false
      return true
    })

    const withBalance = filtered.map((account) => ({
      account,
      currentBalance:
        account.account_type_code === "gold" ? null : account.opening_balance,
      metalAggregate: metalAggregates.get(account.id) ?? null,
    }))

    return withBalance.sort((left, right) => {
      switch (sort) {
        case "name":
          return compareValues(left.account.name, right.account.name, direction)
        case "type":
          return compareValues(
            left.account.account_type_code,
            right.account.account_type_code,
            direction
          )
        case "balance": {
          const leftValue = Number(
            left.currentBalance ?? left.metalAggregate?.totalUnitsGrams ?? 0
          )
          const rightValue = Number(
            right.currentBalance ?? right.metalAggregate?.totalUnitsGrams ?? 0
          )
          return direction === "asc"
            ? leftValue - rightValue
            : rightValue - leftValue
        }
        default:
          return 0
      }
    })
  }, [accounts.accounts, direction, filters, metalAggregates, sort])

  const toggleSort = (nextSort: AccountInventorySort) => {
    if (nextSort === sort) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"))
    } else {
      setSort(nextSort)
      setDirection("asc")
    }
  }

  if (accounts.isLoading) {
    return (
      <div className="pb-12">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-8 h-96 animate-pulse rounded-2xl bg-muted" />
      </div>
    )
  }

  if (accounts.error && accounts.accounts.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle size={28} className="text-amber-600" />
        <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
          {t("accounts.error.loadTitle")}
        </p>
        <Button onClick={() => void accounts.refreshAccounts()}>
          {t("accounts.actions.tryAgain")}
        </Button>
      </div>
    )
  }

  return (
    <div className="pb-12">
      <header className="pb-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="tharwati-eyebrow">{t("accounts.page.eyebrow")}</p>
            <h1 className="tharwati-page-title mt-2">
              {t("accounts.page.title")}
            </h1>
            <p className="tharwati-page-description mt-2 max-w-2xl">
              {t("accounts.page.description")}
            </p>
          </div>
          <Button onClick={() => setForm({ mode: "create", account: null })}>
            <Plus size={16} />
            {t("accounts.actions.add")}
          </Button>
        </div>
      </header>

      {accounts.error ? (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-amber-600/35 py-3 text-sm text-amber-800 dark:text-amber-300"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle size={16} />
            {t("accounts.error.actionTitle")}
          </span>
          <button
            onClick={() => void accounts.refreshAccounts()}
            className="font-semibold underline focus-visible:ring-2"
          >
            {t("accounts.actions.tryAgain")}
          </button>
        </div>
      ) : null}

      <AccountFilterBar
        filters={filters}
        currencies={currencies}
        resultCount={items.length}
        onChange={(key, value) =>
          setFilters((current) => ({ ...current, [key]: value }))
        }
      />

      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--border-subtle)] py-16 text-center">
          <p className="font-semibold text-[var(--color-text-primary)]">
            {t("accounts.empty.title")}
          </p>
          <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
            {t("accounts.empty.description")}
          </p>
        </div>
      ) : (
        <AccountInventory
          items={items}
          sort={sort}
          direction={direction}
          onSort={toggleSort}
          onEdit={(account) => setForm({ mode: "edit", account })}
          onArchive={(account) => setConfirm({ mode: "archive", account })}
          onDelete={(account) => setConfirm({ mode: "delete", account })}
          onAddMetalPurchase={setMetalPurchaseAccount}
          onViewMetalPurchases={setPurchaseHistoryAccount}
          onViewAccountRecords={setAccountRecordsAccount}
          canDelete={accounts.canDeleteAccount}
        />
      )}

      {form ? (
        <AccountFormDialog
          defaultValues={defaults}
          isOpen
          isSaving={accounts.isSaving}
          isCurrencyLocked={
            form.mode === "edit" &&
            !!form.account &&
            accounts.hasFinancialHistory(form.account.id)
          }
          isOpeningBalanceLocked={
            form.mode === "edit" &&
            !!form.account &&
            accounts.hasFinancialHistory(form.account.id)
          }
          mode={form.mode}
          onDirtyChange={setFormDirty}
          onClose={closeForm}
          onSubmit={async (values) => {
            if (form.mode === "edit" && form.account)
              await accounts.updateAccount(form.account.id, values)
            else await accounts.createAccount(values)
            setFormDirty(false)
            setForm(null)
          }}
        />
      ) : null}

      <ArchiveAccountDialog
        account={confirm?.mode === "archive" ? confirm.account : null}
        isSaving={accounts.isSaving}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm) {
            await accounts.archiveAccount(confirm.account.id)
            setConfirm(null)
          }
        }}
      />
      <DeleteAccountDialog
        account={confirm?.mode === "delete" ? confirm.account : null}
        isSaving={accounts.isSaving}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm) {
            await accounts.deleteAccount(confirm.account.id)
            setConfirm(null)
          }
        }}
      />
      <MetalPurchaseDialog
        account={metalPurchaseAccount}
        fundingAccounts={getEligibleMetalFundingAccounts(accounts.accounts)}
        isSaving={isSavingMetalPurchase}
        onClose={() => setMetalPurchaseAccount(null)}
        onSubmit={async (values) => {
          if (!metalPurchaseAccount) return
          setIsSavingMetalPurchase(true)
          try {
            await addMetalPurchase(metalPurchaseAccount.id, values)
            await loadMetalPurchases()
            setMetalPurchaseAccount(null)
            window.dispatchEvent(new Event("tharwati:data-changed"))
          } finally {
            setIsSavingMetalPurchase(false)
          }
        }}
      />
      <MetalPurchaseHistoryDialog
        account={purchaseHistoryAccount}
        purities={purityBreakdown}
        isLoading={isLoadingPurchaseHistory}
        isError={purchaseHistoryError}
        onClose={() => {
          setPurchaseHistoryAccount(null)
          setSelectedMetalPurity(null)
        }}
        onAdd={() => {
          if (!purchaseHistoryAccount) return
          setMetalPurchaseAccount(purchaseHistoryAccount)
          setPurchaseHistoryAccount(null)
        }}
        onOpenPurity={setSelectedMetalPurity}
      />
      <MetalPurityTransactionsDialog
        account={purchaseHistoryAccount}
        purity={selectedMetalPurity}
        purchases={purityTransactions}
        onBack={() => setSelectedMetalPurity(null)}
        onClose={() => {
          setSelectedMetalPurity(null)
          setPurchaseHistoryAccount(null)
        }}
      />
      <AccountRecordsDialog
        account={accountRecordsAccount}
        records={accountRecords}
        isLoading={isLoadingAccountRecords}
        isError={accountRecordsError}
        onClose={() => setAccountRecordsAccount(null)}
      />
      <UnsavedChangesDialog
        open={unsaved.confirmationOpen}
        onKeepEditing={unsaved.keepEditing}
        onDiscard={unsaved.discard}
      />
    </div>
  )
}
