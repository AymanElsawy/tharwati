import { afterEach, describe, expect, it, vi } from "vitest"
import { ReadTimeoutError } from "@/lib/network/read-deadline"
import {
  parseUserDataExport,
  UserDataExportError,
  UserDataExportService,
} from "./user-data-export.service"

const document = {
  schema: "tharwati.user-data-export",
  version: 1,
  generated_at: "2026-09-04T12:00:00.000Z",
  subject: { user_id: "user-1" },
  data: {
    auth_account: { id: "user-1" }, profile: null,
    financial_accounts: [], financial_transactions: [], transaction_entries: [], holdings: [],
    user_assets: [], asset_identifiers: [], metal_purchases: [], metal_purchase_lifecycle_events: [],
    account_valuations: [], account_disposals: [], record_categories: [], record_category_overrides: [],
    goals: [], goal_progress_entries: [], manual_market_prices: [],
  },
}

afterEach(() => vi.useRealTimers())

describe("UserDataExportService", () => {
  it("bounds the whole download and lets a later manual attempt start", async () => {
    vi.useFakeTimers()
    const getSession = vi.fn(() => new Promise<never>(() => {}))
    const service = new UserDataExportService({ auth: { getSession } } as never)
    const first = expect(service.downloadExport()).rejects.toBeInstanceOf(ReadTimeoutError)
    await vi.advanceTimersByTimeAsync(90_000)
    await first
    const retry = expect(service.downloadExport()).rejects.toBeInstanceOf(ReadTimeoutError)
    await vi.advanceTimersByTimeAsync(90_000)
    await retry
    expect(getSession).toHaveBeenCalledTimes(2)
  })

  it("aborts the export download transport at the overall deadline", async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_, options) => {
      signal = options?.signal as AbortSignal
      return new Promise<Response>(() => {})
    })
    const service = new UserDataExportService({ auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }) } } as never)
    const failure = expect(service.downloadExport()).rejects.toBeInstanceOf(ReadTimeoutError)
    await vi.advanceTimersByTimeAsync(90_000)
    await failure
    expect(signal?.aborted).toBe(true)
    fetchMock.mockRestore()
  })
  it("requests and validates the versioned Edge Function export", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: document, error: null })
    const service = new UserDataExportService({ functions: { invoke } } as never)
    await expect(service.requestExport()).resolves.toEqual(document)
    expect(invoke).toHaveBeenCalledWith("export-my-data", { method: "GET", signal: expect.any(AbortSignal) })
  })

  it("rejects an incomplete or unknown export contract", () => {
    expect(() => parseUserDataExport({ ...document, version: 2 })).toThrow(UserDataExportError)
    const incomplete = structuredClone(document)
    delete (incomplete.data as Partial<typeof document.data>).goals
    expect(() => parseUserDataExport(incomplete)).toThrow(UserDataExportError)
  })

  it("downloads the attachment and preserves its server filename", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", {
      headers: { "Content-Disposition": 'attachment; filename="private-export.json"' },
    }))
    const service = new UserDataExportService({ auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }) } } as never)
    await expect(service.downloadExport()).resolves.toMatchObject({ filename: "private-export.json" })
    fetchMock.mockRestore()
  })

  it.each([[429, "rate_limited"], [413, "too_large"], [401, "authentication_required"], [500, "unavailable"]] as const)(
    "classifies export response %s", async (status, code) => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { code: "unknown" } }), { status }))
      const service = new UserDataExportService({ auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }) } } as never)
      await expect(service.downloadExport()).rejects.toMatchObject({ code })
      fetchMock.mockRestore()
    },
  )
})
