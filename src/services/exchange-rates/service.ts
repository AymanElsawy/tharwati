import {
  supabase,
  type TypedSupabaseClient,
} from "../../lib/supabase/client"
import type { Decimal } from "../../lib/supabase/types"
import { getExchangeRate } from "../exchangeRateService"
import { invertRate, requirePositiveRate } from "./decimal"
import { ExchangeRateError } from "./errors"
import {
  ExchangeRateRepository,
  type StoredExchangeRate,
} from "./repository"
import type {
  CurrencyPair,
  CurrentExchangeRate,
  ExchangeRateDirection,
  HistoricalExchangeRate,
} from "./types"

function normalizePair(pair: CurrencyPair): CurrencyPair {
  const sourceCurrencyCode = pair.sourceCurrencyCode.trim().toUpperCase()
  const destinationCurrencyCode =
    pair.destinationCurrencyCode.trim().toUpperCase()
  if (
    !/^[A-Z]{3}$/.test(sourceCurrencyCode) ||
    !/^[A-Z]{3}$/.test(destinationCurrencyCode) ||
    sourceCurrencyCode === destinationCurrencyCode
  ) {
    throw new ExchangeRateError({
      code: "invalid_currency_pair",
      message: `Invalid exchange-rate pair ${sourceCurrencyCode}/${destinationCurrencyCode}`,
      pair,
    })
  }
  return { sourceCurrencyCode, destinationCurrencyCode }
}

function resolveStoredRate(
  pair: CurrencyPair,
  stored: StoredExchangeRate,
  direction: ExchangeRateDirection,
) {
  return {
    ...pair,
    rate: direction === "direct" ? stored.rate : invertRate(stored.rate),
    direction,
    effectiveAt: stored.effective_at,
    source: stored.source,
  }
}

export class ExchangeRateService {
  private readonly repository: ExchangeRateRepository

  constructor(client: TypedSupabaseClient = supabase) {
    this.repository = new ExchangeRateRepository(client)
  }

  async listRates() {
    return this.repository.list()
  }

  async createRate(input: {
    sourceCurrencyCode: string
    destinationCurrencyCode: string
    rate: Decimal
    effectiveAt: string
  }) {
    const pair = normalizePair(input)
    if (Number.isNaN(Date.parse(input.effectiveAt))) {
      throw new ExchangeRateError({
        code: "invalid_rate",
        message: "A valid effective date is required",
        pair,
      })
    }
    return this.repository.create({
      baseCurrencyCode: pair.sourceCurrencyCode,
      quoteCurrencyCode: pair.destinationCurrencyCode,
      rate: requirePositiveRate(input.rate),
      effectiveAt: new Date(input.effectiveAt).toISOString(),
    })
  }

  async updateRate(
    id: string,
    input: {
      sourceCurrencyCode: string
      destinationCurrencyCode: string
      rate: Decimal
      effectiveAt: string
    },
  ) {
    const pair = normalizePair(input)
    if (Number.isNaN(Date.parse(input.effectiveAt))) {
      throw new ExchangeRateError({
        code: "invalid_rate",
        message: "A valid effective date is required",
        pair,
      })
    }
    return this.repository.update(id, {
      baseCurrencyCode: pair.sourceCurrencyCode,
      quoteCurrencyCode: pair.destinationCurrencyCode,
      rate: requirePositiveRate(input.rate),
      effectiveAt: new Date(input.effectiveAt).toISOString(),
    })
  }

  async deleteRate(id: string) {
    return this.repository.delete(id)
  }

  async getLatestDirectRate(
    pair: CurrencyPair,
    atOrBefore = new Date().toISOString(),
  ) {
    const normalized = normalizePair(pair)
    const rate = await this.repository.findLatest(
      normalized.sourceCurrencyCode,
      normalized.destinationCurrencyCode,
      atOrBefore,
    )
    return rate
      ? resolveStoredRate(normalized, rate, "direct")
      : null
  }

  async getLatestInverseRate(
    pair: CurrencyPair,
    atOrBefore = new Date().toISOString(),
  ) {
    const normalized = normalizePair(pair)
    const rate = await this.repository.findLatest(
      normalized.destinationCurrencyCode,
      normalized.sourceCurrencyCode,
      atOrBefore,
    )
    return rate
      ? resolveStoredRate(normalized, rate, "inverse")
      : null
  }

  async resolveCurrentRate(
    pair: CurrencyPair,
    resolvedAt = new Date().toISOString(),
  ): Promise<CurrentExchangeRate> {
    const normalized = normalizePair(pair)
    const resolved = await getExchangeRate(
      normalized.sourceCurrencyCode,
      normalized.destinationCurrencyCode,
    )
    if (!resolved) {
      throw new ExchangeRateError({
        code: "rate_unavailable",
        message: `No Frankfurter rate is available for ${normalized.sourceCurrencyCode}/${normalized.destinationCurrencyCode}`,
        pair: normalized,
      })
    }
    return {
      ...normalized,
      rate: String(resolved.rate),
      direction: "direct",
      effectiveAt: resolved.effectiveAt,
      source: resolved.provider,
      usage: "current",
      resolvedAt,
      fetchedAt: resolved.fetchedAt,
      stale: resolved.stale,
    }
  }

  async resolveHistoricalRate(
    pair: CurrencyPair,
    requestedAt: string,
  ): Promise<HistoricalExchangeRate> {
    const normalized = normalizePair(pair)
    const resolved = await this.repository.resolveHistorical(
      normalized,
      requestedAt,
    )
    if (resolved) return resolved
    throw new ExchangeRateError({
      code: "rate_unavailable",
      message:
        `No direct or inverse exchange rate is available for ` +
        `${normalized.sourceCurrencyCode}/${normalized.destinationCurrencyCode}`,
      pair: normalized,
    })
  }
}

export const exchangeRateService = new ExchangeRateService()
