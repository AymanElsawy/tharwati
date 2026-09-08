import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { assetsWorkspaceService } from "@/features/assets/services/assets-workspace.service"
import type {
  AssetEvidenceFilters,
  AssetInventorySort,
  AssetHealthFactorId,
  AssetQualityIssueId,
  AssetWorkspaceFilters,
  AssetWorkspaceSnapshot,
} from "@/features/assets/types/asset-workspace"
import { LatestRequestGuard } from "@/features/portfolio/utils/latest-request"
import { assetsRepository } from "@/features/assets/repositories/assets.repository"
import type { AssetFormValues } from "@/features/assets/types/asset-form"
import { RepositoryError } from "@/lib/supabase/types"

const initialFilters: AssetWorkspaceFilters = {
  search: "",
  ownership: "all",
  accountId: null,
  currency: null,
  lifecycle: "active",
  origin: "all",
  sort: "name",
  direction: "asc",
}

const initialEvidenceFilters: AssetEvidenceFilters = {
  relationshipAccountId: null,
  activityAccountId: null,
  activityType: null,
}

function inputFrom(values: AssetFormValues) {
  return {
    assetTypeCode: values.assetTypeCode,
    name: values.name.trim(),
    symbol: values.symbol.trim() || null,
    currencyCode: values.currencyCode,
    exchange: values.exchange.trim() || null,
  }
}

export function useAssetsWorkspace() {
  const [snapshot, setSnapshot] = useState<AssetWorkspaceSnapshot | null>(null)
  const [activeScopeId, setActiveScopeId] = useState<string | null>(null)
  const [assetClassId, setAssetClassId] = useState<string | null>(null)
  const [filters, setFilters] = useState(initialFilters)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [isAssetDetailOpen, setIsAssetDetailOpen] = useState(false)
  const [evidenceFilters, setEvidenceFilters] = useState(initialEvidenceFilters)
  const [selectedHealthFactorId, setSelectedHealthFactorId] =
    useState<AssetHealthFactorId | null>(null)
  const [selectedIssueId, setSelectedIssueId] =
    useState<AssetQualityIssueId | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [mutationError, setMutationError] = useState<RepositoryError | null>(null)
  const requests = useRef(new LatestRequestGuard())
  const initialized = useRef(false)

  const load = useCallback(
    async (
      scopeId: string | null,
      initial: boolean,
      currentAssetClassId: string | null,
    ) => {
      const request = requests.current.begin()
      if (initial) setIsLoading(true)
      else setIsRefreshing(true)
      try {
        const next = await assetsWorkspaceService.load(scopeId)
        if (!requests.current.isCurrent(request)) return
        setSnapshot(next)
        setError(null)
        setSelectedAssetId((selected) =>
          selected && next.items.some((item) => item.asset.id === selected)
            ? selected
            : null,
        )
        setSelectedHoldingId((selected) =>
          selected && next.relationships.some((item) => item.holdingId === selected)
            ? selected
            : null,
        )
        setSelectedActivityId((selected) =>
          selected && next.activity.some((item) => item.id === selected)
            ? selected
            : null,
        )
        setFilters((current) => ({
          ...current,
          accountId:
            current.accountId &&
            next.scopeOptions.some((item) => item.id === current.accountId)
              ? current.accountId
              : null,
        }))
        const nextAnalysis = assetsWorkspaceService.analyze(
          next.items.filter(
            (item) =>
              !currentAssetClassId ||
              item.asset.asset_type_code === currentAssetClassId,
          ),
        )
        setSelectedIssueId((selected) =>
          selected &&
          nextAnalysis.issues.some((issue) => issue.id === selected)
            ? selected
            : null,
        )
      } catch (cause) {
        if (!requests.current.isCurrent(request)) return
        setError(
          cause instanceof Error
            ? cause
            : new Error("Assets workspace is unavailable"),
        )
      } finally {
        if (requests.current.isCurrent(request)) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    const initial = !initialized.current
    initialized.current = true
    void load(activeScopeId, initial, null)
  }, [activeScopeId, load])

  useEffect(() => {
    const refresh = () => void load(activeScopeId, false, assetClassId)
    window.addEventListener("tharwati:data-changed", refresh)
    return () => window.removeEventListener("tharwati:data-changed", refresh)
  }, [activeScopeId, assetClassId, load])

  const analysisItems = useMemo(
    () =>
      snapshot
        ? snapshot.items.filter(
            (item) =>
              !assetClassId || item.asset.asset_type_code === assetClassId,
          )
        : [],
    [assetClassId, snapshot],
  )
  const analysis = useMemo(
    () => assetsWorkspaceService.analyze(analysisItems),
    [analysisItems],
  )
  const effectiveSelectedIssueId =
    selectedIssueId &&
    analysis.issues.some((issue) => issue.id === selectedIssueId)
      ? selectedIssueId
      : null
  const items = useMemo(() => {
    if (!snapshot) return []
    const locallyFiltered = assetsWorkspaceService.filterAndSort(
      snapshot.items,
      assetClassId,
      filters,
    )
    return assetsWorkspaceService.filterByAnalysis(
      locallyFiltered,
      analysis,
      selectedHealthFactorId,
      effectiveSelectedIssueId,
    )
  }, [analysis, assetClassId, effectiveSelectedIssueId, filters, selectedHealthFactorId, snapshot])
  const visibleAssetIds = useMemo(
    () => new Set(items.map((item) => item.asset.id)),
    [items],
  )
  const relationships = useMemo(
    () => snapshot
      ? assetsWorkspaceService.filterRelationships(
          snapshot.relationships,
          visibleAssetIds,
          selectedAssetId,
          evidenceFilters.relationshipAccountId,
        )
      : [],
    [evidenceFilters.relationshipAccountId, selectedAssetId, snapshot, visibleAssetIds],
  )
  const activity = useMemo(
    () => snapshot
      ? assetsWorkspaceService.filterActivity(
          snapshot.activity,
          visibleAssetIds,
          selectedAssetId,
          evidenceFilters,
        )
      : [],
    [evidenceFilters, selectedAssetId, snapshot, visibleAssetIds],
  )
  const selectedAssetDetail = useMemo(
    () => snapshot && selectedAssetId
      ? assetsWorkspaceService.detailFor(snapshot, selectedAssetId)
      : null,
    [selectedAssetId, snapshot],
  )

  const updateFilter = useCallback(
    <Key extends keyof AssetWorkspaceFilters>(
      key: Key,
      value: AssetWorkspaceFilters[Key],
    ) => {
      setFilters((current) => ({ ...current, [key]: value }))
    },
    [],
  )

  const toggleSort = useCallback((sort: AssetInventorySort) => {
    setFilters((current) => ({
      ...current,
      sort,
      direction:
        current.sort === sort && current.direction === "asc" ? "desc" : "asc",
    }))
  }, [])

  const setScope = useCallback((scopeId: string | null) => {
    setActiveScopeId(scopeId)
    setFilters((current) => ({ ...current, accountId: null }))
  }, [])

  const updateEvidenceFilter = useCallback(
    <Key extends keyof AssetEvidenceFilters>(key: Key, value: AssetEvidenceFilters[Key]) => {
      setEvidenceFilters((current) => ({ ...current, [key]: value }))
    },
    [],
  )

  const openAssetDetail = useCallback((assetId: string) => {
    setSelectedAssetId(assetId)
    setIsAssetDetailOpen(true)
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(initialFilters)
  }, [])

  const selectHealthFactor = useCallback(
    (factorId: AssetHealthFactorId | null) => {
      setSelectedHealthFactorId(factorId)
      setSelectedIssueId(
        factorId
          ? assetsWorkspaceService.issueForFactor(factorId, analysis)
          : null,
      )
    },
    [analysis],
  )

  const selectIssue = useCallback((issueId: AssetQualityIssueId | null) => {
    setSelectedIssueId(issueId)
    setSelectedHealthFactorId(
      issueId ? assetsWorkspaceService.factorForIssue(issueId) : null,
    )
  }, [])

  const mutate = useCallback(async <Result,>(operation: string, action: () => Promise<Result>) => {
    if (isSaving) throw new RepositoryError({ code: "conflict", message: "An asset change is already in progress", operation })
    setIsSaving(true)
    setMutationError(null)
    try {
      const result = await action()
      await load(activeScopeId, false, assetClassId)
      window.dispatchEvent(new CustomEvent("tharwati:data-changed"))
      return result
    } catch (cause) {
      const error = cause instanceof RepositoryError ? cause : new RepositoryError({ code: "database_error", message: cause instanceof Error ? cause.message : "Asset operation failed", operation, cause })
      setMutationError(error)
      throw error
    } finally {
      setIsSaving(false)
    }
  }, [activeScopeId, assetClassId, isSaving, load])

  const createAsset = useCallback(async (values: AssetFormValues) => {
    const created = await mutate("assets.create", async () => {
      const result = await assetsRepository.createCustomAsset(inputFrom(values))
      return values.isActive ? result : assetsRepository.archiveCustomAsset(result.id)
    })
    setSelectedAssetId(created.id)
    return created
  }, [mutate])

  const updateAsset = useCallback((id: string, values: AssetFormValues) =>
    mutate("assets.update", () => assetsRepository.updateCustomAsset(id, { ...inputFrom(values), isActive: values.isActive })), [mutate])
  const archiveAsset = useCallback((id: string) => mutate("assets.archive", () => assetsRepository.archiveCustomAsset(id)), [mutate])
  const deleteAsset = useCallback(async (id: string) => {
    await mutate("assets.delete", () => assetsRepository.deleteCustomAsset(id))
    setSelectedAssetId(null)
    setIsAssetDetailOpen(false)
  }, [mutate])

  return {
    snapshot,
    items,
    activeScopeId,
    assetClassId,
    filters,
    selectedAssetId,
    selectedHoldingId,
    selectedActivityId,
    selectedAssetDetail,
    isAssetDetailOpen,
    relationships,
    activity,
    evidenceFilters,
    analysis,
    selectedHealthFactorId,
    selectedIssueId: effectiveSelectedIssueId,
    error,
    isLoading,
    isRefreshing,
    isSaving,
    mutationError,
    setScope,
    setAssetClassId,
    updateFilter,
    toggleSort,
    clearFilters,
    setSelectedAssetId,
    setSelectedHoldingId,
    setSelectedActivityId,
    setIsAssetDetailOpen,
    openAssetDetail,
    updateEvidenceFilter,
    selectHealthFactor,
    selectIssue,
    createAsset,
    updateAsset,
    archiveAsset,
    deleteAsset,
    clearMutationError: () => setMutationError(null),
    refresh: () => load(activeScopeId, snapshot === null, assetClassId),
  }
}
