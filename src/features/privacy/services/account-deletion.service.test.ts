import { describe, expect, it, vi } from "vitest"
import { AccountDeletionService, exitDeletedAccount } from "./account-deletion.service"

function client(overrides: Record<string, unknown> = {}) {
  return { auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "owner@example.test" } }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }), ...overrides,
  } } as never
}

describe("AccountDeletionService", () => {
  it("rejects an unauthenticated caller", async () => {
    const service = new AccountDeletionService(client({ getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { code: "session_not_found" } }) }))
    await expect(service.reauthenticate("password")).rejects.toMatchObject({ code: "unauthenticated" })
  })

  it("rejects a wrong password", async () => {
    const service = new AccountDeletionService(client({ signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null }, error: { code: "invalid_credentials" } }) }))
    await expect(service.reauthenticate("wrong")).rejects.toMatchObject({ code: "reauthentication_failed" })
  })

  it("posts only password and accepts empty 204 success", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const service = new AccountDeletionService(client(), fetcher)
    await expect(service.deleteCurrentAccount("secret")).resolves.toEqual({ recovered: false })
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ password: "secret" })
  })

  it("recovers only when an uncertain response confirms user_not_found", async () => {
    const service = new AccountDeletionService(client({ getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { code: "user_not_found" } }) }), vi.fn().mockRejectedValue(new TypeError("network")))
    await expect(service.deleteCurrentAccount("secret")).resolves.toEqual({ recovered: true })
  })

  it("requires reauthentication when an uncertain request leaves user present", async () => {
    const service = new AccountDeletionService(client(), vi.fn().mockRejectedValue(new TypeError("network")))
    await expect(service.deleteCurrentAccount("secret")).rejects.toMatchObject({ code: "deletion_failed" })
  })

  it("exits authenticated UI when local sign-out fails", async () => {
    const leave = vi.fn()
    await exitDeletedAccount(vi.fn().mockRejectedValue(new Error("cleanup failed")), leave)
    expect(leave).toHaveBeenCalledOnce()
  })
})
