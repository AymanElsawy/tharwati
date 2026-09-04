import { describe, expect, it, vi } from "vitest"
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

describe("UserDataExportService", () => {
  it("requests and validates the versioned Edge Function export", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: document, error: null })
    const service = new UserDataExportService({ functions: { invoke } } as never)
    await expect(service.requestExport()).resolves.toEqual(document)
    expect(invoke).toHaveBeenCalledWith("export-my-data", { method: "GET" })
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
