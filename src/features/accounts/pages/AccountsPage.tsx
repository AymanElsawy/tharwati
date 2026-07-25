import { AlertCircle, Plus, RefreshCw, WalletCards } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import type { AccountSummary } from "../../../lib/supabase/types"
import { useTranslation } from "../../../i18n/useTranslation"
import { AccountFormDialog } from "../components/AccountFormDialog"
import { AccountList } from "../components/AccountList"
import { AccountToast } from "../components/AccountToast"
import { ArchiveAccountDialog } from "../components/ArchiveAccountDialog"
import { DeleteAccountDialog } from "../components/DeleteAccountDialog"
import { EmptyAccountsState } from "../components/EmptyAccountsState"
import { useAccounts } from "../hooks/useAccounts"
import {
  accountToFormValues,
  emptyAccountFormValues,
  type AccountFormValues,
} from "../types/account-form"

type FormDialogState =
  | { mode: "create"; account: null }
  | { mode: "edit"; account: AccountSummary }
  | null

function AccountsLoadingState() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="h-64 animate-pulse rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]"
        />
      ))}
    </div>
  )
}

export function AccountsPage() {
  const { t } = useTranslation()
  const {
    accounts,
    archiveAccount,
    canDeleteAccount,
    clearError,
    createAccount,
    deleteAccount,
    error,
    isLoading,
    isSaving,
    refreshAccounts,
    updateAccount,
  } = useAccounts()
  const [formDialog, setFormDialog] = useState<FormDialogState>(null)
  const [archiveTarget, setArchiveTarget] =
    useState<AccountSummary | null>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<AccountSummary | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null)
    }, 4000)

    return () => window.clearTimeout(timeoutId)
  }, [toastMessage])

  const formValues = useMemo(() => {
    if (formDialog?.mode === "edit") {
      return accountToFormValues(formDialog.account)
    }

    return emptyAccountFormValues
  }, [formDialog])

  async function handleFormSubmit(values: AccountFormValues) {
    if (formDialog?.mode === "edit") {
      await updateAccount(formDialog.account.id, values)
      setToastMessage(t("accounts.toast.updated"))
      return
    }

    await createAccount(values)
    setToastMessage(t("accounts.toast.created"))
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) {
      return
    }

    try {
      await archiveAccount(archiveTarget.id)
      setArchiveTarget(null)
      setToastMessage(t("accounts.toast.archived"))
    } catch {
      // The hook exposes the typed repository error in the page error state.
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return
    }

    try {
      await deleteAccount(deleteTarget.id)
      setDeleteTarget(null)
      setToastMessage(t("accounts.toast.deleted"))
    } catch {
      // The hook exposes the typed repository error in the page error state.
    }
  }

  const hasInitialError = Boolean(error && accounts.length === 0)

  return (
    <section className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-3 text-[var(--color-primary)]">
            <WalletCards size={26} />
            <span className="text-sm font-bold uppercase tracking-[0.18em]">
              {t("accounts.page.eyebrow")}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--color-text-primary)]">
            {t("accounts.page.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-[var(--color-text-secondary)]">
            {t("accounts.page.description")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            clearError()
            setFormDialog({ mode: "create", account: null })
          }}
          className="tharwati-button-primary flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          {t("accounts.actions.create")}
        </button>
      </header>

      {error && !hasInitialError ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800"
        >
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {t("accounts.error.actionTitle")}
            </p>
            <p className="mt-0.5 text-sm">{error.message}</p>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="text-sm font-semibold underline"
          >
            {t("common.dismiss")}
          </button>
        </div>
      ) : null}

      {isLoading ? <AccountsLoadingState /> : null}

      {!isLoading && hasInitialError ? (
        <div
          role="alert"
          className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-red-200 bg-red-50 p-8 text-center"
        >
          <AlertCircle size={34} className="text-red-600" />
          <h2 className="mt-4 text-xl font-bold text-red-900">
            {t("accounts.error.loadTitle")}
          </h2>
          <p className="mt-2 max-w-md text-sm text-red-700">
            {error?.message}
          </p>
          <button
            type="button"
            onClick={() => void refreshAccounts()}
            className="mt-5 flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <RefreshCw size={16} />
            {t("accounts.actions.tryAgain")}
          </button>
        </div>
      ) : null}

      {!isLoading && !hasInitialError && accounts.length === 0 ? (
        <EmptyAccountsState
          onCreate={() =>
            setFormDialog({ mode: "create", account: null })
          }
        />
      ) : null}

      {!isLoading && accounts.length > 0 ? (
        <AccountList
          accounts={accounts}
          canDeleteAccount={canDeleteAccount}
          onArchive={setArchiveTarget}
          onDelete={setDeleteTarget}
          onEdit={(account) => {
            clearError()
            setFormDialog({ mode: "edit", account })
          }}
        />
      ) : null}

      <AccountFormDialog
        defaultValues={formValues}
        isOpen={formDialog !== null}
        isSaving={isSaving}
        mode={formDialog?.mode ?? "create"}
        onClose={() => {
          if (!isSaving) {
            setFormDialog(null)
          }
        }}
        onSubmit={handleFormSubmit}
      />

      <ArchiveAccountDialog
        account={archiveTarget}
        isSaving={isSaving}
        onCancel={() => {
          if (!isSaving) {
            setArchiveTarget(null)
          }
        }}
        onConfirm={handleArchiveConfirm}
      />

      <DeleteAccountDialog
        account={deleteTarget}
        isSaving={isSaving}
        onCancel={() => {
          if (!isSaving) {
            setDeleteTarget(null)
          }
        }}
        onConfirm={handleDeleteConfirm}
      />

      <AccountToast
        message={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </section>
  )
}
