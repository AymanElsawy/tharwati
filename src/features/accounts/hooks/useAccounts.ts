import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "../../../i18n/useTranslation"

import type { AccountSummary } from "../../../lib/supabase/types"
import { RepositoryError } from "../../../lib/supabase/types"
import {
  accountsRepository,
  type CreateAccountInput,
  type UpdateAccountInput,
} from "../repositories/accounts.repository"
import type { AccountFormValues } from "../types/account-form"

type UseAccountsResult = {
  accounts: AccountSummary[]
  error: RepositoryError | null
  isLoading: boolean
  isSaving: boolean
  canDeleteAccount: (accountId: string) => boolean
  hasFinancialHistory: (accountId: string) => boolean
  refreshAccounts: () => Promise<void>
  createAccount: (values: AccountFormValues) => Promise<AccountSummary>
  updateAccount: (
    accountId: string,
    values: AccountFormValues,
  ) => Promise<AccountSummary>
  archiveAccount: (accountId: string) => Promise<AccountSummary>
  deleteAccount: (accountId: string) => Promise<void>
  clearError: () => void
}

function normalizeError(
  error: unknown,
  operation: string,
  unexpectedMessage: string,
): RepositoryError {
  if (error instanceof RepositoryError) {
    return error
  }

  return new RepositoryError({
    code: "database_error",
    message:
      error instanceof Error ? error.message : unexpectedMessage,
    operation,
    cause: error,
  })
}

function nullableText(value: string): string | null {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : null
}

export function useAccounts(): UseAccountsResult {
  const { t } = useTranslation()
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [error, setError] = useState<RepositoryError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletableAccountIds, setDeletableAccountIds] = useState<
    ReadonlySet<string>
  >(new Set())
  const [accountIdsWithHistory, setAccountIdsWithHistory] = useState<
    ReadonlySet<string>
  >(new Set())
  const mutationInFlight = useRef(false)

  const loadAccounts = useCallback(async (showLoading: boolean) => {
    if (showLoading) {
      setIsLoading(true)
    }

    try {
      const nextAccounts = await accountsRepository.getAccounts()
      const deletionEligibility =
        await accountsRepository.getAccountDeletionEligibility(
          nextAccounts.map((account) => account.id),
        )

      setAccounts(nextAccounts)
      setDeletableAccountIds(
        new Set(
          deletionEligibility
            .filter((eligibility) => eligibility.canDelete)
            .map((eligibility) => eligibility.accountId),
        ),
      )
      setAccountIdsWithHistory(
        new Set(
          deletionEligibility
            .filter((eligibility) => eligibility.hasFinancialHistory)
            .map((eligibility) => eligibility.accountId),
        ),
      )
      setError(null)
    } catch (loadError) {
      setError(
        normalizeError(
          loadError,
          "accounts.load",
          t("accounts.error.unexpected"),
        ),
      )
    } finally {
      if (showLoading) {
        setIsLoading(false)
      }
    }
  }, [t])

  const refreshAccounts = useCallback(
    async () => loadAccounts(true),
    [loadAccounts],
  )

  useEffect(() => {
    async function initializeAccounts() {
      await loadAccounts(true)
    }

    void initializeAccounts()
  }, [loadAccounts])

  useEffect(() => {
    const refresh = () => void loadAccounts(false)
    window.addEventListener("tharwati:data-changed", refresh)
    return () =>
      window.removeEventListener("tharwati:data-changed", refresh)
  }, [loadAccounts])

  const runMutation = useCallback(
    async <Result,>(
      operation: string,
      mutation: () => Promise<Result>,
    ): Promise<Result> => {
      if (mutationInFlight.current) {
        throw new RepositoryError({
          code: "conflict",
          message: t("accounts.error.mutationInProgress"),
          operation,
        })
      }

      mutationInFlight.current = true
      setIsSaving(true)
      setError(null)

      try {
        const result = await mutation()
        await loadAccounts(false)
        return result
      } catch (mutationError) {
        const repositoryError = normalizeError(
          mutationError,
          operation,
          t("accounts.error.unexpected"),
        )
        setError(repositoryError)
        throw repositoryError
      } finally {
        mutationInFlight.current = false
        setIsSaving(false)
      }
    },
    [loadAccounts, t],
  )

  const createAccount = useCallback(
    async (values: AccountFormValues) =>
      runMutation("accounts.create", async () => {
        const input: CreateAccountInput = {
          accountTypeCode: values.accountTypeCode,
          name: values.name.trim(),
          currencyCode: values.currencyCode,
          institutionName: nullableText(values.institutionName),
          openingBalance: values.openingBalance.trim(),
          notes: nullableText(values.notes),
        }
        const createdAccount =
          await accountsRepository.createAccount(input)

        if (!values.isActive) {
          return accountsRepository.updateAccount(createdAccount.id, {
            isActive: false,
          })
        }

        return createdAccount
      }),
    [runMutation],
  )

  const updateAccount = useCallback(
    async (accountId: string, values: AccountFormValues) =>
      runMutation("accounts.update", () => {
        const input: UpdateAccountInput = {
          accountTypeCode: values.accountTypeCode,
          name: values.name.trim(),
          currencyCode: values.currencyCode,
          institutionName: nullableText(values.institutionName),
          openingBalance: values.openingBalance.trim(),
          notes: nullableText(values.notes),
          isActive: values.isActive,
        }

        return accountsRepository.updateAccount(accountId, input)
      }),
    [runMutation],
  )

  const archiveAccount = useCallback(
    async (accountId: string) =>
      runMutation("accounts.archive", () =>
        accountsRepository.archiveAccount(accountId),
      ),
    [runMutation],
  )

  const deleteAccount = useCallback(
    async (accountId: string) =>
      runMutation("accounts.delete", () =>
        accountsRepository.deleteAccount(accountId),
      ),
    [runMutation],
  )

  return {
    accounts,
    error,
    isLoading,
    isSaving,
    canDeleteAccount: (accountId) =>
      deletableAccountIds.has(accountId),
    hasFinancialHistory: (accountId) =>
      accountIdsWithHistory.has(accountId),
    refreshAccounts,
    createAccount,
    updateAccount,
    archiveAccount,
    deleteAccount,
    clearError: () => setError(null),
  }
}
