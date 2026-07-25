import { describe, expect, it } from "vitest"

import { RepositoryError } from "@/lib/supabase/types"
import { MarketDataError } from "@/services/market-data/errors"
import { mapManualPriceError } from "./manual-market-prices.repository"

describe("mapManualPriceError", () => {
  it("maps the database future-date rejection to a RepositoryError", () => {
    const result = mapManualPriceError(
      new MarketDataError({
        code: "future_market_price",
        message: "Market price date cannot be in the future.",
      }),
      "marketPrices.create",
    )

    expect(result).toBeInstanceOf(RepositoryError)
    expect(result).toMatchObject({
      code: "constraint_violation",
      message: "Market price date cannot be in the future.",
      operation: "marketPrices.create",
    })
  })
})
