import { describe, expect, it, vi } from "vitest"

import type { TypedSupabaseClient } from "@/lib/supabase/client"
import { ExchangeRateError } from "@/services/exchange-rates/errors"
import { ExchangeRateRepository } from "@/services/exchange-rates/repository"

const stored = {
  id: "rate-1",
  base_currency_code: "USD",
  quote_currency_code: "SAR",
  rate: 3.75,
  effective_at: "2026-07-25T12:00:00.000Z",
  source: "manual",
  created_at: "2026-07-25T12:00:00.000Z",
  updated_at: "2026-07-25T12:00:00.000Z",
}

function mutationClient(
  operation: "insert" | "update" | "delete",
  result: { data: typeof stored | null; error: { code?: string; message: string } | null },
  userId = "user-1",
) {
  const chain = {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    lte: vi.fn(),
    gt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: unknown) => void) => resolve(result),
  }
  chain.insert.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.delete.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.lte.mockReturnValue(chain)
  chain.gt.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: userId } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue(chain),
    } as unknown as TypedSupabaseClient,
    chain,
    operation,
  }
}

describe("ExchangeRateRepository management", () => {
  it("creates a rate", async () => {
    const { client, chain } = mutationClient("insert", { data: stored, error: null })
    const result = await new ExchangeRateRepository(client).create({
      baseCurrencyCode: "USD",
      quoteCurrencyCode: "SAR",
      rate: "3.75",
      effectiveAt: stored.effective_at,
    })
    expect(chain.insert).toHaveBeenCalled()
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1" }),
    )
    expect(result.rate).toBe("3.75")
  })

  it("edits a rate", async () => {
    const { client, chain } = mutationClient("update", { data: stored, error: null })
    await new ExchangeRateRepository(client).update("rate-1", {
      baseCurrencyCode: "USD",
      quoteCurrencyCode: "SAR",
      rate: "3.75",
      effectiveAt: stored.effective_at,
    })
    expect(chain.update).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith("id", "rate-1")
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1")
  })

  it("deletes a rate", async () => {
    const { client, chain } = mutationClient("delete", { data: stored, error: null })
    await new ExchangeRateRepository(client).delete("rate-1")
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith("id", "rate-1")
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1")
  })

  it("maps duplicate pair/date violations clearly", async () => {
    const { client } = mutationClient("insert", {
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    })
    await expect(
      new ExchangeRateRepository(client).create({
        baseCurrencyCode: "USD",
        quoteCurrencyCode: "SAR",
        rate: "3.75",
        effectiveAt: stored.effective_at,
      }),
    ).rejects.toMatchObject({
      code: "duplicate_rate",
    } satisfies Partial<ExchangeRateError>)
  })

  it("scopes reads and mutations independently for two authenticated users", async () => {
    const first = mutationClient("update", { data: stored, error: null }, "user-1")
    const second = mutationClient("update", { data: null, error: null }, "user-2")

    await new ExchangeRateRepository(first.client).findLatest(
      "USD",
      "SAR",
      stored.effective_at,
    )
    await new ExchangeRateRepository(second.client).findLatest(
      "USD",
      "SAR",
      stored.effective_at,
    )

    expect(first.chain.eq).toHaveBeenCalledWith("user_id", "user-1")
    expect(second.chain.eq).toHaveBeenCalledWith("user_id", "user-2")
    expect(second.chain.eq).not.toHaveBeenCalledWith("user_id", "user-1")
  })
})
