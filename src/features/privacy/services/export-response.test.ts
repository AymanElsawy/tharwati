import { describe, expect, it } from "vitest"
import {
  buildUserDataExport,
  ExportTooLargeError,
  serializeUserDataExport,
} from "../../../../supabase/functions/_shared/user-data-export-response"

const rpcExport = {
  schema: "tharwati.user-data-export",
  version: 1,
  subject: { user_id: "user-1" },
  data: { goals: [] },
}

describe("user data export response", () => {
  it("whitelists Auth fields and keeps the caller identity bound to the RPC result", () => {
    const result = buildUserDataExport(rpcExport, {
      id: "user-1", email: "owner@example.test", phone: null,
      created_at: "2026-01-01T00:00:00Z", updated_at: null, last_sign_in_at: null,
      // Runtime Supabase users contain these fields; they must never cross the export boundary.
      identities: [{ identity_data: { secret: "no" } }],
      user_metadata: { private: "no" }, access_token: "no",
    } as never, "2026-09-04T12:00:00Z")
    expect(result.data.auth_account).toEqual({
      id: "user-1", email: "owner@example.test", phone: null,
      created_at: "2026-01-01T00:00:00Z", updated_at: null, last_sign_in_at: null,
    })
    expect(JSON.stringify(result)).not.toContain("secret")
    expect(() => buildUserDataExport(rpcExport, {
      id: "user-2", created_at: "2026-01-01T00:00:00Z",
    }, "2026-09-04T12:00:00Z")).toThrow("invalid_export_contract")
  })

  it("rejects an oversized export instead of truncating it", () => {
    const body = serializeUserDataExport({ value: "1234" }, 100)
    expect(body).toContain("1234")
    expect(() => serializeUserDataExport({ value: "1234" }, 5)).toThrow(ExportTooLargeError)
  })
})
