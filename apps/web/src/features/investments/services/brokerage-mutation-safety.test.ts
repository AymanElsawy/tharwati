import { describe, expect, it } from "vitest"
import buyDialog from "@/features/accounts/components/BrokerageBuyDialog.tsx?raw"
import sellDialog from "@/features/accounts/components/BrokerageSellDialog.tsx?raw"
import dividendDialog from "@/features/accounts/components/BrokerageDividendDialog.tsx?raw"
import buyRepository from "../repositories/brokerage-buys.repository.ts?raw"
import sellRepository from "../repositories/brokerage-sells.repository.ts?raw"
import dividendRepository from "../repositories/brokerage-dividends.repository.ts?raw"

describe("Brokerage mutation/refresh safety", () => {
  it.each([
    ["buy", buyDialog, buyRepository, "add_brokerage_buy_v2"],
    ["sell", sellDialog, sellRepository, "add_brokerage_sell_v2"],
    ["dividend", dividendDialog, dividendRepository, "add_brokerage_cash_dividend_v2"],
  ])("keeps %s commitment separate from its refresh", (_name, dialog, repository, rpc) => {
    expect(dialog).toContain("runMutationThenRefresh")
    expect(dialog).toContain("p_idempotency_key: attempt.idempotencyKey")
    expect(dialog).toContain("attemptRef.current = null")
    expect(dialog).toContain("onClose()")
    expect(dialog).toContain('outcome.refresh === "stale"')
    expect(dialog).toContain("onRefreshStale?.()")
    expect(repository).toContain(rpc)
  })

  it("keeps all dividend modes on distinct v2 RPCs", () => {
    expect(dividendRepository).toContain("add_brokerage_cash_dividend_v2")
    expect(dividendRepository).toContain("add_brokerage_dividend_reinvestment_v2")
    expect(dividendRepository).toContain("add_brokerage_partial_dividend_reinvestment_v2")
  })
})
