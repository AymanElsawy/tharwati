import { AlertCircle, Banknote, Pencil, Plus, RefreshCw, Trash2, Wallet } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { CashAccountFormDialog } from "@/features/cash-accounts/components/CashAccountFormDialog"
import { DeleteCashAccountDialog } from "@/features/cash-accounts/components/DeleteCashAccountDialog"
import { useCashAccounts } from "@/features/cash-accounts/hooks/useCashAccounts"
import type { CashAccountSummary } from "@/features/cash-accounts/repositories/cash-accounts.repository"
import {
  cashAccountToFormValues,
  type CashAccountFormValues,
} from "@/features/cash-accounts/types/cash-account-form"

type FormState =
  | { mode: "create"; account: null }
  | { mode: "edit"; account: CashAccountSummary }
  | null

function formatBalance(value: string, currencyCode: string) {
  return `${currencyCode} ${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))}`
}

export function CashAccountsPage() {
  const {
    accounts,
    baseCurrencyCode,
    clearError,
    createAccount,
    currencyOptions,
    deleteAccount,
    error,
    isLoading,
    isSaving,
    refresh,
    updateAccount,
  } = useCashAccounts()
  const [formState, setFormState] = useState<FormState>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<CashAccountSummary | null>(null)

  const defaultValues = useMemo<CashAccountFormValues>(() => {
    if (formState?.mode === "edit") {
      return cashAccountToFormValues(formState.account)
    }
    return {
      name: "",
      currencyCode: baseCurrencyCode,
      balance: "0",
      notes: "",
    }
  }, [baseCurrencyCode, formState])

  async function handleSubmit(values: CashAccountFormValues) {
    if (formState?.mode === "edit") {
      await updateAccount(formState.account.id, values)
    } else {
      await createAccount(values)
    }
  }

  return (
    <section className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-3 text-[var(--color-primary)]">
            <Banknote className="size-7" />
            <span className="text-sm font-bold uppercase tracking-[0.18em]">Cash assets</span>
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--color-text)]">
            Cash Accounts
          </h1>
          <p className="mt-2 max-w-2xl text-[var(--color-text-secondary)]">
            Track cash balances across currencies in one place.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="h-11 rounded-xl px-5"
          onClick={() => {
            clearError()
            setFormState({ mode: "create", account: null })
          }}
        >
          <Plus />
          Add Account
        </Button>
      </header>

      {error && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Cash account action failed</p>
            <p className="mt-1 text-sm">{error.message}</p>
          </div>
          <button type="button" className="text-sm font-semibold underline" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
          ))}
        </div>
      )}

      {!isLoading && error && accounts.length === 0 && (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            <RefreshCw /> Try Again
          </Button>
        </div>
      )}

      {!isLoading && !error && accounts.length === 0 && (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Wallet className="size-7" />
          </span>
          <h2 className="mt-5 text-xl font-bold text-[var(--color-text)]">No cash accounts yet</h2>
          <p className="mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
            Add your first cash account to start tracking available balances.
          </p>
          <Button className="mt-6" onClick={() => setFormState({ mode: "create", account: null })}>
            <Plus /> Add Account
          </Button>
        </div>
      )}

      {!isLoading && accounts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <article key={account.id} className="tharwati-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-[var(--color-text)]">{account.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{account.currency_code}</p>
                </div>
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Banknote className="size-5" />
                </span>
              </div>
              <p className="mt-6 text-2xl font-black tracking-tight text-[var(--color-text)]" dir="ltr">
                {formatBalance(account.current_balance, account.currency_code)}
              </p>
              {account.notes && (
                <p className="mt-3 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{account.notes}</p>
              )}
              <div className="mt-6 flex gap-2 border-t border-[var(--color-border)] pt-4">
                <Button type="button" variant="outline" onClick={() => setFormState({ mode: "edit", account })}>
                  <Pencil /> Edit
                </Button>
                <Button type="button" variant="ghost" onClick={() => setDeleteTarget(account)}>
                  <Trash2 /> Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <button
        type="button"
        aria-label="Add cash account"
        className="fixed bottom-6 end-6 z-30 flex size-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-xl sm:hidden"
        onClick={() => setFormState({ mode: "create", account: null })}
      >
        <Plus />
      </button>

      <CashAccountFormDialog
        currencyOptions={currencyOptions}
        defaultValues={defaultValues}
        isOpen={formState !== null}
        isSaving={isSaving}
        isCurrencyLocked={
          formState?.mode === "edit"
            ? formState.account.has_financial_history
            : false
        }
        isOpeningBalanceLocked={
          formState?.mode === "edit"
            ? formState.account.has_financial_history
            : false
        }
        mode={formState?.mode ?? "create"}
        onClose={() => !isSaving && setFormState(null)}
        onSubmit={handleSubmit}
      />
      <DeleteCashAccountDialog
        account={deleteTarget}
        isSaving={isSaving}
        onCancel={() => !isSaving && setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          void deleteAccount(deleteTarget.id).then(() => setDeleteTarget(null))
        }}
      />
    </section>
  )
}
