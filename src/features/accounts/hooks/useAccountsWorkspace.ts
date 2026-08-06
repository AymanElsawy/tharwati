import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { accountsWorkspaceService } from "@/features/accounts/services/accounts-workspace.service"
import type { AccountActivityFilters, AccountHealthFactorId, AccountInventorySort, AccountQualityIssueId, AccountsWorkspaceSnapshot, AccountWorkspaceFilters, AccountWorkspaceScope } from "@/features/accounts/types/account-workspace"
import { LatestRequestGuard } from "@/features/portfolio/utils/latest-request"
import type { AccountFormValues } from "@/features/accounts/types/account-form"
import { RepositoryError } from "@/lib/supabase/types"
import { commitAccountRefresh } from "@/features/accounts/utils/account-refresh-state"

const initialFilters: AccountWorkspaceFilters = { search: "", currency: null, lifecycle: "active", sort: "name", direction: "asc" }

export function useAccountsWorkspace() {
  const [snapshot, setSnapshot] = useState<AccountsWorkspaceSnapshot | null>(null)
  const [scope, setScope] = useState<AccountWorkspaceScope>("all")
  const [accountType, setAccountType] = useState<string | null>(null)
  const [filters, setFilters] = useState(initialFilters)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [selectedHealthFactor, setSelectedHealthFactor] = useState<AccountHealthFactorId | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<AccountQualityIssueId | null>(null)
  const [selectedRelationship, setSelectedRelationship] = useState<string | null>(null)
  const [accountScopeId, setAccountScopeId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [activityFilters, setActivityFilters] = useState<AccountActivityFilters>({ transactionType: null })
  const [announcement, setAnnouncement] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [mutationError, setMutationError] = useState<RepositoryError | null>(null)
  const mutationInFlight = useRef(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const requests = useRef(new LatestRequestGuard())
  const initialized = useRef(false)

  const load = useCallback(async (nextScope: AccountWorkspaceScope, nextAccountScopeId: string | null, initial: boolean, preferredSelectedAccountId?: string | null) => {
    const request = requests.current.begin()
    if (initial) setIsLoading(true)
    else setIsRefreshing(true)
    try {
      const next = await accountsWorkspaceService.load(nextScope, nextAccountScopeId)
      if (!requests.current.isCurrent(request)) return
      setSnapshot(next)
      setError(null)
      setSelectedAccountId((selected) => commitAccountRefresh({ snapshot: next, selectedAccountId: selected }, next, preferredSelectedAccountId).selectedAccountId)
      setAccountType((selected) => selected && next.accountTypes.some((item) => item.id === selected) ? selected : null)
      setFilters((current) => ({
        ...current,
        currency: current.currency && next.currencies.includes(current.currency) ? current.currency : null,
      }))
      setSelectedHealthFactor((selected) => selected && next.analysis.factors.some((item) => item.id === selected) ? selected : null)
      setSelectedIssue((selected) => selected && next.analysis.issues.some((item) => item.id === selected) ? selected : null)
      setSelectedRelationship((selected) => selected && next.analysis.relationships.some((item) => item.id === selected && item.availability === "available") ? selected : null)
    } catch (cause) {
      if (!requests.current.isCurrent(request)) return
      setError(cause instanceof Error ? cause : new Error("Accounts workspace is unavailable"))
    } finally {
      if (requests.current.isCurrent(request)) { setIsLoading(false); setIsRefreshing(false) }
    }
  }, [])

  useEffect(() => {
    const initial = !initialized.current
    initialized.current = true
    void load(scope, accountScopeId, initial)
  }, [accountScopeId, load, scope])
  useEffect(() => {
    const refresh = () => void load(scope, accountScopeId, false)
    window.addEventListener("tharwati:data-changed", refresh)
    return () => window.removeEventListener("tharwati:data-changed", refresh)
  }, [accountScopeId, load, scope])

  const workspaceItems = useMemo(() => snapshot ? accountsWorkspaceService.filterAndSort(snapshot.items, accountType, filters) : [], [accountType, filters, snapshot])
  const items = useMemo(() => snapshot ? accountsWorkspaceService.filterByAnalysis(workspaceItems, selectedHealthFactor, selectedIssue, selectedRelationship, snapshot.analysis) : [], [selectedHealthFactor, selectedIssue, selectedRelationship, snapshot, workspaceItems])
  const updateFilter = useCallback(<Key extends keyof AccountWorkspaceFilters>(key: Key, value: AccountWorkspaceFilters[Key]) => setFilters((current) => ({ ...current, [key]: value })), [])
  const toggleSort = useCallback((sort: AccountInventorySort) => setFilters((current) => ({ ...current, sort, direction: current.sort === sort && current.direction === "asc" ? "desc" : "asc" })), [])

  const selectHealthFactor = useCallback((value: AccountHealthFactorId | null) => {
    setSelectedHealthFactor(value)
    const linked: Partial<Record<AccountHealthFactorId, AccountQualityIssueId>> = { balance_availability: "missing_balance", currency_completeness: "missing_currency", reconciliation_readiness: "unsupported_reconciliation", archived_account_handling: "archived_dependency" }
    setSelectedIssue(value ? linked[value] ?? null : null)
  }, [])
  const selectIssue = useCallback((value: AccountQualityIssueId | null) => {
    setSelectedIssue(value)
    const linked: Record<AccountQualityIssueId, AccountHealthFactorId> = { missing_balance: "balance_availability", missing_currency: "currency_completeness", unsupported_reconciliation: "reconciliation_readiness", archived_dependency: "archived_account_handling" }
    setSelectedHealthFactor(value ? linked[value] : null)
  }, [])
  const clearAnalyticalFilters = useCallback(() => { setSelectedHealthFactor(null); setSelectedIssue(null); setSelectedRelationship(null) }, [])
  const selectAccount = useCallback((id: string) => { setSelectedAccountId(id); setDetailOpen(true) }, [])
  const openAccountWorkspace = useCallback((id: string | null) => { setAccountScopeId(id); setDetailOpen(false); setSelectedHoldingId(null); setSelectedAssetId(null); setSelectedActivityId(null); setSelectedHealthFactor(null); setSelectedIssue(null); setSelectedRelationship(null); setAnnouncement(id ? "Account workspace scope changed; incompatible analytical filters were cleared." : "All-account workspace restored.") }, [])
  const detail = useMemo(() => snapshot && selectedAccountId ? accountsWorkspaceService.getAccountDetail(snapshot, selectedAccountId) : null, [selectedAccountId, snapshot])
  const activity = useMemo(() => snapshot ? accountsWorkspaceService.filterActivity(snapshot.activity, selectedAccountId, activityFilters) : [], [activityFilters, selectedAccountId, snapshot])
  const mutate = useCallback(async <Result,>(operation: string, action: () => Promise<Result>, success: string, selectedId?: (result: Result) => string | null) => {
    if (mutationInFlight.current) throw new RepositoryError({ code: "conflict", message: "An account change is already in progress.", operation })
    mutationInFlight.current = true; setIsSaving(true); setMutationError(null)
    try { const result = await action(); const id = selectedId?.(result) ?? selectedAccountId; await load(scope, accountScopeId, false, id); setAnnouncement(success); return result }
    catch (cause) { const error = cause instanceof RepositoryError ? cause : new RepositoryError({ code: "database_error", message: cause instanceof Error ? cause.message : "Account change failed", operation, cause }); setMutationError(error); throw error }
    finally { mutationInFlight.current = false; setIsSaving(false) }
  }, [accountScopeId, load, scope, selectedAccountId])
  const createAccount = useCallback((values: AccountFormValues) => mutate("accounts.create", () => accountsWorkspaceService.createAccount(values), "Account created successfully.", (account) => account.id), [mutate])
  const updateAccount = useCallback((id: string, values: AccountFormValues) => mutate("accounts.update", () => accountsWorkspaceService.updateAccount(id, values), "Account updated successfully.", (account) => account.id), [mutate])
  const archiveAccount = useCallback((id: string) => mutate("accounts.archive", () => accountsWorkspaceService.archiveAccount(id), "Account archived successfully.", (account) => account.id), [mutate])
  const deleteAccount = useCallback((id: string) => mutate("accounts.delete", () => accountsWorkspaceService.deleteAccount(id), "Account deleted successfully.", () => null), [mutate])

  return { snapshot, items, scope, accountType, accountScopeId, filters, selectedAccountId, selectedHealthFactor, selectedIssue, selectedRelationship, selectedHoldingId, selectedAssetId, selectedActivityId, detailOpen, detail, activity, activityFilters, announcement, isLoading, isRefreshing, isSaving, error, mutationError, setScope, setAccountType, updateFilter, toggleSort, selectAccount, setDetailOpen, setSelectedHoldingId, setSelectedAssetId, setSelectedActivityId, setActivityFilters, openAccountWorkspace, selectHealthFactor, selectIssue, setSelectedRelationship, createAccount, updateAccount, archiveAccount, deleteAccount, clearMutationError: () => setMutationError(null), clearAnalyticalFilters, clearFilters: () => setFilters(initialFilters), refresh: () => load(scope, accountScopeId, snapshot === null) }
}
