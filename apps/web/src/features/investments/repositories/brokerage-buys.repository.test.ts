import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ar } from "@/i18n/ar/translations"
import { en } from "@/i18n/en/translations"
import { classifyAppError, safeErrorMessage } from "@/lib/errors/app-error"
import { runMutationThenRefresh } from "@/lib/mutations/mutation-refresh"
import type { TypedSupabaseClient } from "@/lib/supabase/client"
import { RepositoryError } from "@/lib/supabase/types"
import { BrokerageBuysRepository, type AddBrokerageBuyInput } from "./brokerage-buys.repository"

const enT = (key: keyof typeof en) => en[key]
const arT = (key: keyof typeof en) => ar[key]

function repositoryReturning(error: { code: string; message: string; details?: string; hint?: string }) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error })
  const client = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } }, error: null }) }, rpc } as unknown as TypedSupabaseClient
  return { repository: new BrokerageBuysRepository(client), rpc }
}

async function rejectedError(repository: BrokerageBuysRepository): Promise<RepositoryError> {
  try {
    await repository.addBrokerageBuy({} as AddBrokerageBuyInput)
    throw new Error("Expected Brokerage Buy to reject")
  } catch (error) {
    expect(error).toBeInstanceOf(RepositoryError)
    return error as RepositoryError
  }
}

describe("Brokerage Buy error classification", () => {
  it("maps the exact insufficient Available Cash RPC rejection to safe English and Arabic business copy", async () => {
    const raw = { code: "P0002", message: "insufficient brokerage available cash", details: "get_brokerage_available_cash: financial_accounts", hint: "SQL debug text" }
    const { repository, rpc } = repositoryReturning(raw)
    const refresh = vi.fn()
    const onCommitted = vi.fn()
    const outcome = await runMutationThenRefresh({ mutate: () => repository.addBrokerageBuy({} as AddBrokerageBuyInput).then(() => undefined), onCommitted, refresh })

    expect(outcome.mutation).toBe("rejected")
    if (outcome.mutation !== "rejected") throw new Error("Expected rejection")
    expect(outcome.error).toBeInstanceOf(RepositoryError)
    expect((outcome.error as RepositoryError).cause).toBe(raw)
    expect(classifyAppError(outcome.error).code).toBe("business_rule")
    expect(safeErrorMessage(outcome.error, enT)).toBe(en["errors.insufficientBrokerageAvailableCash"])
    expect(safeErrorMessage(outcome.error, arT)).toBe(ar["errors.insufficientBrokerageAvailableCash"])
    expect(safeErrorMessage(outcome.error, enT)).not.toMatch(/P0002|financial_accounts|get_brokerage_available_cash|SQL debug/)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(onCommitted).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it("does not mistake another P0002 RPC rejection for insufficient cash", async () => {
    const raw = { code: "P0002", message: "selected visible asset is not available", details: "assets table" }
    const failure = await rejectedError(repositoryReturning(raw).repository)
    expect(failure.cause).toBe(raw)
    expect(classifyAppError(failure).code).toBe("unknown")
    expect(safeErrorMessage(failure, enT)).toBe(en["errors.unknown"])
    expect(safeErrorMessage(failure, enT)).not.toMatch(/P0002|assets|selected visible asset/)
  })

  it("keeps genuine service failures classified as service unavailable", async () => {
    const raw = { code: "PGRST000", message: "connection to database failed", details: "provider stack" }
    const failure = await rejectedError(repositoryReturning(raw).repository)
    expect(failure.cause).toBe(raw)
    expect(classifyAppError(failure).code).toBe("service_unavailable")
    expect(safeErrorMessage(failure, enT)).toBe(en["errors.serviceUnavailable"])
    expect(safeErrorMessage(failure, enT)).not.toMatch(/PGRST000|database|provider stack/)
  })

  it("renders only localized copy, never RPC code, SQL details or provider hints", async () => {
    const raw = { code: "P0002", message: "insufficient brokerage available cash", details: "select * from financial_accounts", hint: "debug get_brokerage_available_cash" }
    const failure = await rejectedError(repositoryReturning(raw).repository)
    const html = renderToStaticMarkup(createElement("p", { role: "alert" }, safeErrorMessage(failure, arT)))
    expect(html).toContain(ar["errors.insufficientBrokerageAvailableCash"])
    expect(html).not.toMatch(/P0002|insufficient brokerage available cash|financial_accounts|get_brokerage_available_cash|debug/)
  })
})
