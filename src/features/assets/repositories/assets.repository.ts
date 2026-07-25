import {
  supabase,
  type TypedSupabaseClient,
} from "../../../lib/supabase/client"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "../../../lib/supabase/repository"
import type { AssetSummary } from "../../../lib/supabase/types"
import { RepositoryError } from "../../../lib/supabase/types"
import type { TableUpdate } from "../../../lib/supabase/types"

export type CreateCustomAssetInput = {
  assetTypeCode: string
  name: string
  currencyCode: string
  symbol?: string | null
  exchange?: string | null
}

export type UpdateCustomAssetInput = Partial<CreateCustomAssetInput> & {
  isActive?: boolean
}

export type AssetDeletionEligibility = {
  assetId: string
  canDelete: boolean
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&")
}

export class AssetsRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async searchAssets(query: string, limit = 20): Promise<AssetSummary[]> {
    const operation = "assets.searchAssets"
    await requireAuthenticatedUserId(this.client, operation)

    const normalizedLimit = Math.max(1, Math.min(limit, 100))
    const searchTerm = query.trim()

    if (!searchTerm) {
      const { data, error } = await this.client
        .from("assets")
        .select("*")
        .eq("is_active", true)
        .order("name")
        .limit(normalizedLimit)

      return requireQueryData(data, error, operation)
    }

    const pattern = `%${escapeLikePattern(searchTerm)}%`
    const [nameResult, symbolResult] = await Promise.all([
      this.client
        .from("assets")
        .select("*")
        .eq("is_active", true)
        .ilike("name", pattern)
        .order("name")
        .limit(normalizedLimit),
      this.client
        .from("assets")
        .select("*")
        .eq("is_active", true)
        .ilike("symbol", pattern)
        .order("name")
        .limit(normalizedLimit),
    ])

    const nameMatches = requireQueryData(
      nameResult.data,
      nameResult.error,
      operation,
    )
    const symbolMatches = requireQueryData(
      symbolResult.data,
      symbolResult.error,
      operation,
    )
    const uniqueAssets = new Map<string, AssetSummary>()

    for (const asset of [...nameMatches, ...symbolMatches]) {
      uniqueAssets.set(asset.id, asset)
    }

    return [...uniqueAssets.values()].slice(0, normalizedLimit)
  }

  async getAssets(): Promise<AssetSummary[]> {
    const operation = "assets.getAssets"
    await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("assets")
      .select("*")
      .order("is_custom")
      .order("name")

    return requireQueryData(data, error, operation)
  }

  async getAsset(id: string): Promise<AssetSummary> {
    const operation = "assets.getAsset"
    await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("assets")
      .select("*")
      .eq("id", id)
      .single()

    return requireQueryData(data, error, operation)
  }

  async getAssetByTicker(ticker: string): Promise<AssetSummary> {
    const operation = "assets.getAssetByTicker"
    await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("assets")
      .select("*")
      .ilike("symbol", escapeLikePattern(ticker.trim()))
      .limit(1)
      .single()

    return requireQueryData(data, error, operation)
  }

  async createCustomAsset(
    input: CreateCustomAssetInput,
  ): Promise<AssetSummary> {
    const operation = "assets.createCustomAsset"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data, error } = await this.client
      .from("assets")
      .insert({
        user_id: userId,
        asset_type_code: input.assetTypeCode,
        symbol: input.symbol,
        name: input.name,
        currency_code: input.currencyCode,
        exchange: input.exchange,
        is_custom: true,
      })
      .select("*")
      .single()

    return requireQueryData(data, error, operation)
  }

  async updateCustomAsset(
    id: string,
    input: UpdateCustomAssetInput,
  ): Promise<AssetSummary> {
    const operation = "assets.updateCustomAsset"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const update: TableUpdate<"assets"> = {}

    if (input.assetTypeCode !== undefined) {
      update.asset_type_code = input.assetTypeCode
    }
    if (input.name !== undefined) update.name = input.name
    if (input.currencyCode !== undefined) {
      update.currency_code = input.currencyCode
    }
    if (input.symbol !== undefined) update.symbol = input.symbol
    if (input.exchange !== undefined) update.exchange = input.exchange
    if (input.isActive !== undefined) update.is_active = input.isActive

    const { data, error } = await this.client
      .from("assets")
      .update(update)
      .eq("id", id)
      .eq("user_id", userId)
      .eq("is_custom", true)
      .select("*")
      .single()

    return requireQueryData(data, error, operation)
  }

  async archiveCustomAsset(id: string): Promise<AssetSummary> {
    return this.updateCustomAsset(id, { isActive: false })
  }

  async getAssetDeletionEligibility(
    assetIds: string[],
  ): Promise<AssetDeletionEligibility[]> {
    const operation = "assets.getAssetDeletionEligibility"
    if (assetIds.length === 0) return []

    const userId = await requireAuthenticatedUserId(this.client, operation)
    const { data: ownedAssets, error: ownedError } = await this.client
      .from("assets")
      .select("id")
      .eq("user_id", userId)
      .eq("is_custom", true)
      .in("id", assetIds)
    const ownedIds = new Set(
      requireQueryData(ownedAssets, ownedError, operation).map(
        (asset) => asset.id,
      ),
    )
    const ownedAssetIds = assetIds.filter((id) => ownedIds.has(id))

    if (ownedAssetIds.length === 0) {
      return assetIds.map((assetId) => ({ assetId, canDelete: false }))
    }

    const [holdingsResult, entriesResult] = await Promise.all([
      this.client
        .from("holdings")
        .select("asset_id")
        .eq("user_id", userId)
        .in("asset_id", ownedAssetIds),
      this.client
        .from("transaction_entries")
        .select("asset_id")
        .eq("user_id", userId)
        .in("asset_id", ownedAssetIds),
    ])
    const referencedIds = new Set([
      ...requireQueryData(
        holdingsResult.data,
        holdingsResult.error,
        operation,
      ).map((holding) => holding.asset_id),
      ...requireQueryData(
        entriesResult.data,
        entriesResult.error,
        operation,
      ).map((entry) => entry.asset_id),
    ])

    return assetIds.map((assetId) => ({
      assetId,
      canDelete: ownedIds.has(assetId) && !referencedIds.has(assetId),
    }))
  }

  async deleteCustomAsset(id: string): Promise<void> {
    const operation = "assets.deleteCustomAsset"
    const userId = await requireAuthenticatedUserId(this.client, operation)
    const [eligibility] = await this.getAssetDeletionEligibility([id])

    if (!eligibility?.canDelete) {
      throw new RepositoryError({
        code: "constraint_violation",
        message:
          "Only unreferenced custom assets can be permanently deleted",
        operation,
      })
    }

    const { data, error } = await this.client
      .from("assets")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .eq("is_custom", true)
      .select("id")
      .single()

    requireQueryData(data, error, operation)
  }
}

export const assetsRepository = new AssetsRepository()
