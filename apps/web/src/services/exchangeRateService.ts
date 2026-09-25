import { supabase } from "@/lib/supabase/client"
import type { Decimal } from "@/lib/supabase/types"
import { READ_DEADLINE_MS, ReadTimeoutError, ReadAbortedError, readWithDeadline } from "@/lib/network/read-deadline"

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

export type FxFunctionInvoker = (
  request: FxFunctionRequest,
  signal?: AbortSignal,
) => Promise<{ data: unknown; error: unknown }>

function currency(value: string) {
  return value.trim().toUpperCase()
}

function positiveDecimal(value: unknown): Decimal | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? String(value) : null
  }
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? value : null
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

  constructor(invoke: FxFunctionInvoker = async (body, signal) => {
    const { data, error } = await supabase.functions.invoke("fx-rates", { body, signal })
    return { data, error }
  }) {
    this.invoke = invoke
  }

  async get(fromCurrencyCode: string, toCurrencyCode: string): Promise<ResolvedFxRate | null> {
    const from = currency(fromCurrencyCode)
    const to = currency(toCurrencyCode)
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return null
    const key = `${from}/${to}`
    const inFlight = this.pending.get(key)
    if (inFlight) return inFlight
    const request = readWithDeadline(READ_DEADLINE_MS.market, (signal) => this.invokeRate(from, to, signal))
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
