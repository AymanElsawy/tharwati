import { supabase } from "@/lib/supabase/client"
import type { Decimal } from "@/lib/supabase/types"
import { ReadTimeoutError, ReadAbortedError, readWithDeadline } from "@/lib/network/read-deadline"
import { bounded, inverseDecimal, positiveDecimal } from "../../../../supabase/functions/_shared/market-reliability"

export type ResolvedFxRate = {
  available: true
  rate: Decimal
  provider: string
  effectiveAt: string
  fetchedAt?: string
  stale: boolean
  unavailable: false
  direction: "direct" | "inverse"
}

type FxFunctionPayload = {
  available?: unknown
  rate?: unknown
  provider?: unknown
  effectiveAt?: unknown
  fetchedAt?: unknown
  stale?: unknown
  unavailable?: unknown
  direction?: unknown
}

type FxFunctionRequest = {
  fromCurrencyCode: string
  toCurrencyCode: string
  mode: "current"
}

async function storedCurrentFx(from: string, to: string): Promise<ResolvedFxRate | null> {
  const candidates = await Promise.all([
    [from, to, "provider", "direct"], [to, from, "provider", "inverse"],
    [from, to, "manual", "direct"], [to, from, "manual", "inverse"],
  ].map(async ([base, quote, source, direction]) => {
    try {
      let query = supabase.from("exchange_rates").select("rate::text,effective_at,fetched_at,source")
        .eq("base_currency_code", base).eq("quote_currency_code", quote)
        .lte("effective_at", new Date().toISOString())
      query = source === "manual" ? query.is("provider", null)
        : query.eq("provider", "frankfurter").is("user_id", null)
      const { data, error } = await bounded(2000, (signal) => query
        .order("effective_at", { ascending: false }).order("id", { ascending: false })
        .limit(1).abortSignal(signal).maybeSingle())
      if (error || !data) return null
      const decimal = positiveDecimal(data.rate)
      const rate = decimal && direction === "inverse" ? inverseDecimal(decimal) : decimal
      return rate ? { available: true as const, rate, provider: data.source ?? (source === "manual" ? "manual" : "frankfurter"),
        effectiveAt: data.effective_at, fetchedAt: data.fetched_at ?? undefined,
        stale: true, unavailable: false as const, direction: direction as "direct" | "inverse" } : null
    } catch { return null }
  }))
  return candidates.find((row) => row !== null) ?? null
}

export type FxFunctionInvoker = (
  request: FxFunctionRequest,
  signal?: AbortSignal,
) => Promise<{ data: unknown; error: unknown }>

function currency(value: string) {
  return value.trim().toUpperCase()
}

function parseResolvedRate(payload: unknown): ResolvedFxRate | null {
  if (!payload || typeof payload !== "object") return null
  const value = payload as FxFunctionPayload
  if (value.available !== true || value.unavailable !== false) return null
  const rate = positiveDecimal(value.rate)
  if (
    rate === null ||
    typeof value.provider !== "string" ||
    value.provider.length === 0 ||
    typeof value.effectiveAt !== "string" ||
    Number.isNaN(Date.parse(value.effectiveAt)) ||
    typeof value.stale !== "boolean"
  ) return null
  const fetchedAt = value.fetchedAt === null || value.fetchedAt === undefined
    ? undefined
    : typeof value.fetchedAt === "string" && !Number.isNaN(Date.parse(value.fetchedAt))
      ? value.fetchedAt
      : null
  if (fetchedAt === null) return null
  return {
    available: true,
    rate,
    provider: value.provider,
    effectiveAt: value.effectiveAt,
    fetchedAt,
    stale: value.stale,
    unavailable: false,
    direction: value.direction === "inverse" ? "inverse" : "direct",
  }
}

export class CurrentFxClient {
  private readonly pending = new Map<string, Promise<ResolvedFxRate | null>>()
  private readonly invoke: FxFunctionInvoker
  private readonly fallback: typeof storedCurrentFx

  constructor(invoke: FxFunctionInvoker = async (body, signal) => {
    const { data, error } = await supabase.functions.invoke("fx-rates", { body, signal })
    return { data, error }
  }, fallback: typeof storedCurrentFx = storedCurrentFx) {
    this.invoke = invoke
    this.fallback = fallback
  }

  async get(fromCurrencyCode: string, toCurrencyCode: string): Promise<ResolvedFxRate | null> {
    const from = currency(fromCurrencyCode)
    const to = currency(toCurrencyCode)
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return null
    if (from === to) return { available: true, rate: "1", provider: "identity",
      effectiveAt: new Date().toISOString(), stale: false, unavailable: false, direction: "direct" }
    const key = `${from}/${to}`
    const inFlight = this.pending.get(key)
    if (inFlight) return inFlight
    const request = (async () => {
      // Leave time inside the client's 20s budget for stored recovery.
      try {
        const rate = await readWithDeadline(12_000, (signal) => this.invokeRate(from, to, signal))
        if (rate) return rate
      } catch (error) {
        if (error instanceof ReadAbortedError) throw error
      }
      return this.fallback(from, to)
    })()
    this.pending.set(key, request)
    try {
      return await request
    } finally {
      this.pending.delete(key)
    }
  }

  private async invokeRate(from: string, to: string, signal: AbortSignal): Promise<ResolvedFxRate | null> {
    try {
      const { data, error } = await this.invoke({
        fromCurrencyCode: from,
        toCurrencyCode: to,
        mode: "current",
      }, signal)
      if (error) return null
      return parseResolvedRate(data)
    } catch (error) {
      if (error instanceof ReadTimeoutError || error instanceof ReadAbortedError) throw error
      console.error("Current FX Edge Function request failed", {
        message: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }
}

const currentFxClient = new CurrentFxClient()

export function getExchangeRate(fromCurrencyCode: string, toCurrencyCode: string) {
  return currentFxClient.get(fromCurrencyCode, toCurrencyCode)
}

export async function convertCurrency(amount: number, fromCurrencyCode: string, toCurrencyCode: string): Promise<number | null> {
  const resolved = await getExchangeRate(fromCurrencyCode, toCurrencyCode)
  return resolved ? amount * Number(resolved.rate) : null
}
