import { useCallback, useEffect, useRef, useState } from "react"

import { useTranslation } from "../../../i18n/useTranslation"
import {
  RepositoryError,
  type AssetSummary,
} from "../../../lib/supabase/types"
import {
  assetsRepository,
  type CreateCustomAssetInput,
  type UpdateCustomAssetInput,
} from "../repositories/assets.repository"
import type { AssetFormValues } from "../types/asset-form"

function nullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeError(
  error: unknown,
  operation: string,
  fallback: string,
): RepositoryError {
  if (error instanceof RepositoryError) return error
  return new RepositoryError({
    code: "database_error",
    message: error instanceof Error ? error.message : fallback,
    operation,
    cause: error,
  })
}

export function useAssets() {
  const { t } = useTranslation()
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [deletableIds, setDeletableIds] = useState<ReadonlySet<string>>(
    new Set(),
  )
  const [error, setError] = useState<RepositoryError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const mutationInFlight = useRef(false)

  const loadAssets = useCallback(async (showLoading: boolean) => {
    if (showLoading) setIsLoading(true)
    try {
      const nextAssets = await assetsRepository.getAssets()
      const customIds = nextAssets
        .filter((asset) => asset.is_custom)
        .map((asset) => asset.id)
      const eligibility =
        await assetsRepository.getAssetDeletionEligibility(customIds)
      setAssets(nextAssets)
      setDeletableIds(
        new Set(
          eligibility
            .filter((item) => item.canDelete)
            .map((item) => item.assetId),
        ),
      )
      setError(null)
    } catch (loadError) {
      setError(
        normalizeError(
          loadError,
          "assets.load",
          t("assets.error.unexpected"),
        ),
      )
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    async function initializeAssets() {
      await loadAssets(true)
    }

    void initializeAssets()
  }, [loadAssets])

  useEffect(() => {
    const refresh = () => void loadAssets(false)
    window.addEventListener("tharwati:data-changed", refresh)
    return () =>
      window.removeEventListener("tharwati:data-changed", refresh)
  }, [loadAssets])

  const runMutation = useCallback(
    async <Result,>(
      operation: string,
      mutation: () => Promise<Result>,
    ) => {
      if (mutationInFlight.current) {
        throw new RepositoryError({
          code: "conflict",
          message: t("assets.error.mutationInProgress"),
          operation,
        })
      }
      mutationInFlight.current = true
      setIsSaving(true)
      setError(null)
      try {
        const result = await mutation()
        await loadAssets(false)
        return result
      } catch (mutationError) {
        const nextError = normalizeError(
          mutationError,
          operation,
          t("assets.error.unexpected"),
        )
        setError(nextError)
        throw nextError
      } finally {
        mutationInFlight.current = false
        setIsSaving(false)
      }
    },
    [loadAssets, t],
  )

  const createAsset = useCallback(
    (values: AssetFormValues) =>
      runMutation("assets.create", async () => {
        const input: CreateCustomAssetInput = {
          assetTypeCode: values.assetTypeCode,
          name: values.name.trim(),
          symbol: nullableText(values.symbol),
          currencyCode: values.currencyCode,
          exchange: nullableText(values.exchange),
        }
        const created = await assetsRepository.createCustomAsset(input)
        if (!values.isActive) {
          return assetsRepository.updateCustomAsset(created.id, {
            isActive: false,
          })
        }
        return created
      }),
    [runMutation],
  )

  const updateAsset = useCallback(
    (id: string, values: AssetFormValues) =>
      runMutation("assets.update", () => {
        const input: UpdateCustomAssetInput = {
          assetTypeCode: values.assetTypeCode,
          name: values.name.trim(),
          symbol: nullableText(values.symbol),
          currencyCode: values.currencyCode,
          exchange: nullableText(values.exchange),
          isActive: values.isActive,
        }
        return assetsRepository.updateCustomAsset(id, input)
      }),
    [runMutation],
  )

  return {
    assets,
    error,
    isLoading,
    isSaving,
    canDeleteAsset: (id: string) => deletableIds.has(id),
    refreshAssets: () => loadAssets(true),
    createAsset,
    updateAsset,
    archiveAsset: (id: string) =>
      runMutation("assets.archive", () =>
        assetsRepository.archiveCustomAsset(id),
      ),
    deleteAsset: (id: string) =>
      runMutation("assets.delete", () =>
        assetsRepository.deleteCustomAsset(id),
      ),
    clearError: () => setError(null),
  }
}
