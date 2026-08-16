import { AlertTriangle, Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog"
import { AccountFilterBar, type AccountFilters } from "@/features/accounts/components/AccountFilterBar"
import { AccountFormDialog } from "@/features/accounts/components/AccountFormDialog"
import {
  AccountInventory,
  type AccountInventoryItem,
  type AccountInventorySort,
} from "@/features/accounts/components/AccountInventory"
import { ArchiveAccountDialog } from "@/features/accounts/components/ArchiveAccountDialog"
import { DeleteAccountDialog } from "@/features/accounts/components/DeleteAccountDialog"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import {
  accountToFormValues,
  emptyAccountFormValues,
  type AccountFormValues,
} from "@/features/accounts/types/account-form"
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges"
import { useTranslation } from "@/i18n/useTranslation"
import type { AccountSummary } from "@/lib/supabase/types"

function compareValues(left: string, right: string, direction: "asc" | "desc") {
  const result = left.localeCompare(right)
  return direction === "asc" ? result : -result
}

export function AccountsPage() {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const [form, setForm] = useState<{ mode: "create" | "edit"; account: AccountSummary | null } | null>(null)
  const [confirm, setConfirm] = useState<{ mode: "archive" | "delete"; account: AccountSummary } | null>(null)
  const [formDirty, setFormDirty] = useState(false)
  const [filters, setFilters] = useState<AccountFilters>({
    search: "",
    type: null,
    currency: null,
    status: "all",
  })
  const [sort, setSort] = useState<AccountInventorySort>("name")
  const [direction, setDirection] = useState<"asc" | "desc">("asc")
  const unsaved = useUnsavedChanges(formDirty)

  const defaults = useMemo<AccountFormValues>(
    () => (form?.account ? accountToFormValues(form.account) : emptyAccountFormValues),
    [form],
  )

  const closeForm = () =>
    unsaved.request(() => {
      setForm(null)
      setFormDirty(false)
    })

  const currencies = useMemo(
    () => [...new Set(accounts.accounts.map((account) => account.currency_code))].sort(),
    [accounts.accounts],
  )

  const items = useMemo<AccountInventoryItem[]>(() => {
    const filtered = accounts.accounts.filter((account) => {
      if (filters.search && !account.name.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.type && account.account_type_code !== filters.type) return false
      if (filters.currency && account.currency_code !== filters.currency) return false
      if (filters.status === "active" && !account.is_active) return false
      if (filters.status === "archived" && account.is_active) return false
      return true
    })

    const withBalance = filtered.map((account) => ({
      account,
      currentBalance: account.account_type_code === "gold" ? null : account.opening_balance,
    }))

    return withBalance.sort((left, right) => {
      switch (sort) {
        case "name":
          return compareValues(left.account.name, right.account.name, direction)
        case "type":
          return compareValues(left.account.account_type_code, right.account.account_type_code, direction)
        case "currency":
          return compareValues(left.account.currency_code, right.account.currency_code, direction)
        case "status":
          return compareValues(String(left.account.is_active), String(right.account.is_active), direction)
        case "balance": {
          const leftValue = Number(left.currentBalance ?? left.account.balance_grams ?? 0)
          const rightValue = Number(right.currentBalance ?? right.account.balance_grams ?? 0)
          return direction === "asc" ? leftValue - rightValue : rightValue - leftValue
        }
        default:
          return 0
      }
    })
  }, [accounts.accounts, direction, filters, sort])

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
        <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">{t("accounts.error.loadTitle")}</p>
        <Button onClick={() => void accounts.refreshAccounts()}>{t("accounts.actions.tryAgain")}</Button>
      </div>
    )
  }

  return (
    <div className="pb-12">
      <header className="pb-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="tharwati-eyebrow">{t("accounts.page.eyebrow")}</p>
            <h1 className="tharwati-page-title mt-2">{t("accounts.page.title")}</h1>
            <p className="tharwati-page-description mt-2 max-w-2xl">{t("accounts.page.description")}</p>
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
        onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
      />

      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--border-subtle)] py-16 text-center">
          <p className="font-semibold text-[var(--color-text-primary)]">{t("accounts.empty.title")}</p>
          <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">{t("accounts.empty.description")}</p>
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
          canDelete={accounts.canDeleteAccount}
        />
      )}

      {form ? (
        <AccountFormDialog
          defaultValues={defaults}
          isOpen
          isSaving={accounts.isSaving}
          isCurrencyLocked={form.mode === "edit" && !!form.account && accounts.hasFinancialHistory(form.account.id)}
          isOpeningBalanceLocked={form.mode === "edit" && !!form.account && accounts.hasFinancialHistory(form.account.id)}
          mode={form.mode}
          onDirtyChange={setFormDirty}
          onClose={closeForm}
          onSubmit={async (values) => {
            if (form.mode === "edit" && form.account) await accounts.updateAccount(form.account.id, values)
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
      <UnsavedChangesDialog
        open={unsaved.confirmationOpen}
        onKeepEditing={unsaved.keepEditing}
        onDiscard={unsaved.discard}
      />
    </div>
  )
}
