import type { TypedSupabaseClient } from "../../lib/supabase/client"
import type { Decimal, TableRow } from "../../lib/supabase/types"
import { ExchangeRateError } from "./errors"
import type {
  CurrencyPair,
  HistoricalExchangeRate,
  ProviderRate,
} from "./types"
import { requireAuthenticatedUserId } from "../../lib/supabase/repository"

export type StoredExchangeRate = Omit<TableRow<"exchange_rates">, "rate"> & {
  rate: Decimal
}

export class ExchangeRateRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient) {
    this.client = client
  }

  private requireStoredRate(
    data: TableRow<"exchange_rates"> | null,
    error: { code?: string; message: string } | null,
  ): StoredExchangeRate {
    if (error) {
      throw new ExchangeRateError({
        code: error.code === "23505" ? "duplicate_rate" : "storage_error",
        message: error.message,
        cause: error,
      })
    }
    if (!data) {
      throw new ExchangeRateError({
        code: "storage_error",
        message: "The exchange rate was not returned",
      })
    }
    return { ...data, rate: String(data.rate) }
  }

  async list(): Promise<StoredExchangeRate[]> {
    const userId = await requireAuthenticatedUserId(this.client, "exchangeRates.list")
    const { data, error } = await this.client
      .from("exchange_rates")
      .select("*")
      .eq("user_id", userId)
      .order("effective_at", { ascending: false })
      .order("id", { ascending: false })
    if (error) {
      throw new ExchangeRateError({
        code: "storage_error",
        message: error.message,
        cause: error,
      })
    }
    return (data ?? []).map((rate) => ({ ...rate, rate: String(rate.rate) }))
  }

  async create(input: {
    baseCurrencyCode: string
    quoteCurrencyCode: string
    rate: Decimal
    effectiveAt: string
  }): Promise<StoredExchangeRate> {
    const userId = await requireAuthenticatedUserId(this.client, "exchangeRates.create")
    const { data, error } = await this.client
      .from("exchange_rates")
      .insert({
        base_currency_code: input.baseCurrencyCode,
        user_id: userId,
        quote_currency_code: input.quoteCurrencyCode,
        rate: input.rate,
        effective_at: input.effectiveAt,
        source: "manual",
      })
      .select("*")
      .single()
    return this.requireStoredRate(data, error)
  }

  async update(
    id: string,
    input: {
      baseCurrencyCode: string
      quoteCurrencyCode: string
      rate: Decimal
      effectiveAt: string
    },
  ): Promise<StoredExchangeRate> {
    const userId = await requireAuthenticatedUserId(this.client, "exchangeRates.update")
    const { data, error } = await this.client
      .from("exchange_rates")
      .update({
        base_currency_code: input.baseCurrencyCode,
        quote_currency_code: input.quoteCurrencyCode,
        rate: input.rate,
        effective_at: input.effectiveAt,
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single()
    return this.requireStoredRate(data, error)
  }

  async delete(id: string): Promise<void> {
    const userId = await requireAuthenticatedUserId(this.client, "exchangeRates.delete")
    const { error } = await this.client
      .from("exchange_rates")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
    if (error) {
      throw new ExchangeRateError({
        code: "storage_error",
        message: error.message,
        cause: error,
      })
    }
  }

  async findLatest(
    baseCurrencyCode: string,
    quoteCurrencyCode: string,
    atOrBefore: string,
  ): Promise<StoredExchangeRate | null> {
    const userId = await requireAuthenticatedUserId(this.client, "exchangeRates.findLatest")
    const { data, error } = await this.client
      .from("exchange_rates")
      .select("*")
      .eq("user_id", userId)
      .eq("base_currency_code", baseCurrencyCode)
      .eq("quote_currency_code", quoteCurrencyCode)
      .lte("effective_at", atOrBefore)
      .gt("rate", "0")
      .order("effective_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new ExchangeRateError({
        code: "storage_error",
        message: error.message,
        cause: error,
      })
    }
    if (!data) return null
    return { ...data, rate: String(data.rate) }
  }

  async resolveHistorical(
    pair: CurrencyPair,
    requestedAt: string,
  ): Promise<HistoricalExchangeRate | null> {
    const { data, error } = await this.client.rpc(
      "resolve_historical_exchange_rate",
      {
        p_source_currency_code: pair.sourceCurrencyCode,
        p_destination_currency_code: pair.destinationCurrencyCode,
        p_requested_at: requestedAt,
      },
    )
    if (error) {
      throw new ExchangeRateError({
        code: "storage_error",
        message: error.message,
        pair,
        cause: error,
      })
    }
    const resolved = data?.[0]
    if (!resolved) return null
    return {
      ...pair,
      rate: String(resolved.rate),
      direction: resolved.direction,
      effectiveAt: resolved.effective_at,
      source: resolved.source,
      usage: "historical",
      requestedAt,
    }
  }

  async upsertProviderRates(
    rates: readonly ProviderRate[],
    source: string,
  ): Promise<number> {
    if (rates.length === 0) return 0
    const userId = await requireAuthenticatedUserId(this.client, "exchangeRates.upsertProviderRates")
    const { error } = await this.client.from("exchange_rates").upsert(
      rates.map((rate) => ({
          base_currency_code: rate.baseCurrencyCode,
          user_id: userId,
        quote_currency_code: rate.quoteCurrencyCode,
        rate: rate.rate,
        effective_at: rate.effectiveAt,
        source,
      })),
      {
        onConflict:
          "user_id,base_currency_code,quote_currency_code,effective_at",
      },
    )
    if (error) {
      throw new ExchangeRateError({
        code: "storage_error",
        message: error.message,
        cause: error,
      })
    }
    return rates.length
  }
}
