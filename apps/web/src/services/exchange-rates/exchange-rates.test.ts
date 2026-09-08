import { describe, expect, it, vi } from "vitest"

import type { TypedSupabaseClient } from "../../lib/supabase/client"
import { invertRate } from "./decimal"
import { ExchangeRateError } from "./errors"
import { ExchangeRateService } from "./service"
import { getExchangeRate } from "../exchangeRateService"

vi.mock("../exchangeRateService", () => ({ getExchangeRate: vi.fn() }))

const mockCurrentRate = vi.mocked(getExchangeRate)

function clientReturning(rows: unknown[]): TypedSupabaseClient {
  const maybeSingle = vi.fn().mockImplementation(async () => ({
    data: rows.shift() ?? null,
    error: null,
  }))
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    lte: vi.fn(),
    gt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle,
  }
  for (const method of [
    "select",
    "eq",
    "lte",
    "gt",
    "order",
    "limit",
  ] as const) {
    chain[method].mockReturnValue(chain)
  }
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue(chain),
  } as unknown as TypedSupabaseClient
}

function historicalClientReturning(
  rows: unknown[],
): TypedSupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: rows,
      error: null,
    }),
  } as unknown as TypedSupabaseClient
}

const storedRate = {
  id: "rate-id",
  base_currency_code: "USD",
  quote_currency_code: "SAR",
  rate: 3.75,
  effective_at: "2026-07-24T00:00:00.000Z",
  source: "manual",
  created_at: "2026-07-24T00:00:00.000Z",
}

describe("ExchangeRateService", () => {
  it("resolves a direct current rate before considering inverse", async () => {
    mockCurrentRate.mockResolvedValue({ available: true, rate: 3.75, provider: "frankfurter", effectiveAt: storedRate.effective_at, fetchedAt: storedRate.created_at, stale: false, unavailable: false })
    const service = new ExchangeRateService(clientReturning([storedRate]))
    await expect(
      service.resolveCurrentRate({
        sourceCurrencyCode: "USD",
        destinationCurrencyCode: "SAR",
      }),
    ).resolves.toMatchObject({
      rate: "3.75",
      direction: "direct",
      usage: "current",
    })
  })

  it("resolves a direct historical rate", async () => {
    const service = new ExchangeRateService(
      historicalClientReturning([
        {
          rate: "3.75",
          effective_at: storedRate.effective_at,
          source: storedRate.source,
          direction: "direct",
        },
      ]),
    )
    await expect(
      service.resolveHistoricalRate(
        {
          sourceCurrencyCode: "usd",
          destinationCurrencyCode: "sar",
        },
        "2026-07-24T12:00:00.000Z",
      ),
    ).resolves.toMatchObject({
      rate: "3.75",
      direction: "direct",
      usage: "historical",
    })
  })

  it("uses the controlled current FX resolver for every pair", async () => {
    mockCurrentRate.mockResolvedValue({ available: true, rate: 0.266666666667, provider: "frankfurter", effectiveAt: storedRate.effective_at, fetchedAt: storedRate.created_at, stale: false, unavailable: false })
    const service = new ExchangeRateService(clientReturning([]))
    await expect(
      service.resolveCurrentRate({
        sourceCurrencyCode: "SAR",
        destinationCurrencyCode: "USD",
      }),
    ).resolves.toMatchObject({
      rate: "0.266666666667",
      direction: "direct",
      usage: "current",
    })
  })

  it("uses a user-owned manual rate only when the automatic provider is unavailable", async () => {
    mockCurrentRate.mockResolvedValue(null)
    const service = new ExchangeRateService(clientReturning([storedRate]))

    await expect(
      service.resolveCurrentRate({
        sourceCurrencyCode: "USD",
        destinationCurrencyCode: "SAR",
      }),
    ).resolves.toMatchObject({
      rate: "3.75",
      source: "manual",
      usage: "current",
    })
  })

  it("fails clearly when no direct or inverse rate exists", async () => {
    mockCurrentRate.mockResolvedValue(null)
    const service = new ExchangeRateService(clientReturning([]))
    await expect(
      service.resolveCurrentRate({
        sourceCurrencyCode: "USD",
        destinationCurrencyCode: "EGP",
      }),
    ).rejects.toMatchObject({
      code: "rate_unavailable",
    } satisfies Partial<ExchangeRateError>)
  })

  it("inverts decimal rates deterministically", () => {
    expect(invertRate("3.75")).toBe("0.266666666667")
  })
})
