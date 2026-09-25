import { afterEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { LanguageContext } from "@/i18n/context"
import { en } from "@/i18n/en/translations"
import { ar } from "@/i18n/ar/translations"
import { PortfolioExecutiveError } from "@/features/portfolio/components/PortfolioExecutiveError"
import { toRepositoryError, RepositoryError } from "@/lib/supabase/types"
import { classifyAppError, safeErrorMessage } from "./app-error"

const enT = (key: keyof typeof en) => en[key]
const arT = (key: keyof typeof en) => ar[key]

afterEach(() => vi.unstubAllGlobals())

describe("safe app errors", () => {
  it("keeps raw PostgREST details only as the reporter cause, including in rendered errors", () => {
    const raw = { code: "23505", message: 'duplicate key value violates unique constraint "financial_accounts_user_id_key"', details: "table financial_accounts", hint: "call create_financial_account_v2" }
    const failure = toRepositoryError(raw, "accounts.create")
    expect(failure.cause).toBe(raw)
    expect(failure.details).toBe(raw.details)
    expect(failure.message).not.toContain("financial_accounts")
    const html = renderToStaticMarkup(
      <LanguageContext.Provider value={{ language: "en", direction: "ltr", setLanguage: () => undefined, t: enT }}>
        <PortfolioExecutiveError error={failure} onRetry={() => undefined} />
      </LanguageContext.Provider>,
    )
    expect(html).toContain(en["errors.businessRule"])
    expect(html).not.toMatch(/financial_accounts|create_financial_account|23505|PostgREST/)
  })

  it("retains approved business copy and localizes it", () => {
    const error = new RepositoryError({ code: "constraint_violation", message: "This account already contains financial history. Its currency cannot be changed.", operation: "accounts.update", cause: { secret: "rpc_name" } })
    expect(classifyAppError(error).code).toBe("business_rule")
    expect(safeErrorMessage(error, enT)).toBe(en["errors.accountCurrencyLocked"])
    expect(safeErrorMessage(error, arT)).toBe(ar["errors.accountCurrencyLocked"])
    expect(error.cause).toEqual({ secret: "rpc_name" })
    expect(safeErrorMessage({ code: "22P02", message: "invalid input syntax for type uuid" }, enT)).toBe(en["errors.validation"])
  })

  it("distinguishes auth, forbidden, offline, timeout, service outage and unknown", () => {
    expect(classifyAppError(toRepositoryError({ code: "PGRST301", message: "JWT expired" }, "read")).code).toBe("unauthorized")
    expect(classifyAppError(toRepositoryError({ code: "42501", message: "permission denied" }, "read")).code).toBe("forbidden")
    expect(classifyAppError({ code: "database_error", message: "server stack" }).code).toBe("service_unavailable")
    expect(classifyAppError(Object.assign(new Error("raw stack"), { name: "TimeoutError" })).code).toBe("timeout")
    vi.stubGlobal("navigator", { onLine: false })
    expect(classifyAppError(new TypeError("Failed to fetch"))).toMatchObject({ code: "offline" })
    vi.stubGlobal("navigator", { onLine: true })
    expect(safeErrorMessage(new Error("select * from secret_table"), enT)).toBe(en["errors.unknown"])
  })

  it("keeps unavailable market and FX values explicit", () => {
    expect(safeErrorMessage({ code: "market_price_unavailable" }, enT)).toBe(en["errors.marketPriceUnavailable"])
    expect(safeErrorMessage({ code: "rate_unavailable" }, enT)).toBe(en["errors.fxUnavailable"])
    expect(safeErrorMessage({ code: "fx_stale" }, enT)).toBe(en["errors.fxStale"])
    expect(en["errors.marketPriceUnavailable"]).not.toMatch(/\b0\b/)
  })
})
