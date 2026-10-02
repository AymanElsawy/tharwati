import { describe, expect, it, vi } from "vitest"
import {
  callbackMatchesProject,
  hasRecoveryOrigin,
  RecoveryLifecycle,
} from "./recovery-lifecycle"

const project = "https://production.example.supabase.co"
function storage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

describe("recovery lifecycle", () => {
  it("explicit invalidation cannot reopen through validation or restart", async () => {
    const store = storage()
    const flow = new RecoveryLifecycle(store, project)
    flow.onAuthEvent("PASSWORD_RECOVERY", true)
    flow.invalidate()
    await flow.restore(true, async () => true)
    expect(flow.getSnapshot()).toBe("invalid")
    const restarted = new RecoveryLifecycle(store, project)
    await restarted.restore(true, async () => true)
    expect(restarted.getSnapshot()).toBe("invalid")
  })

  it("an ordinary session replacing the recovery target invalidates reset across restart", async () => {
    const store = storage()
    const flow = new RecoveryLifecycle(store, project)
    flow.onAuthEvent("PASSWORD_RECOVERY", true)
    flow.onAuthEvent("SIGNED_IN", true, false)
    expect(flow.getSnapshot()).toBe("invalid")
    const restarted = new RecoveryLifecycle(store, project)
    await restarted.restore(true, async () => true)
    expect(restarted.getSnapshot()).toBe("invalid")
  })

  it("persists isolation before callback exchange and accepts a fresh recovery event", () => {
    const store = storage()
    const flow = new RecoveryLifecycle(store, project, {
      pathname: "/reset-password",
      hash: "#type=recovery",
      search: "",
    })
    expect(flow.isolatesSession).toBe(true)
    expect([...store.values.values()]).toEqual(["checking"])
    flow.onAuthEvent("PASSWORD_RECOVERY", true)
    expect(flow.getSnapshot()).toBe("valid")
    expect([...store.values.values()]).toEqual(["active"])
  })

  it("reload at / retains recovery isolation and validates the restored session", async () => {
    const store = storage()
    new RecoveryLifecycle(store, project).onAuthEvent("PASSWORD_RECOVERY", true)
    const restored = new RecoveryLifecycle(store, project, {
      pathname: "/",
      hash: "",
      search: "",
    })
    expect(restored.isolatesSession).toBe(true)
    await restored.restore(true, async () => true)
    expect(restored.getSnapshot()).toBe("valid")
    restored.onAuthEvent("INITIAL_SESSION", true)
    expect(restored.isolatesSession).toBe(true)
  })

  it.each([false, true])(
    "an invalid/expired or interrupted link stays isolated (session %s)",
    async (hasSession) => {
      const flow = new RecoveryLifecycle(storage(), project, {
        pathname: "/reset-password",
        hash: "#error=access_denied",
        search: "",
      })
      await flow.restore(hasSession, async () => false)
      expect(flow.getSnapshot()).toBe("invalid")
      expect(flow.isolatesSession).toBe(true)
    }
  )

  it("expired restored session shows invalid recovery", async () => {
    const store = storage()
    new RecoveryLifecycle(store, project).onAuthEvent("PASSWORD_RECOVERY", true)
    const restored = new RecoveryLifecycle(store, project)
    await restored.restore(true, async () => false)
    expect(restored.getSnapshot()).toBe("invalid")
  })

  it("cancel/completion cannot leak a session even if cleanup fails", async () => {
    const store = storage()
    const flow = new RecoveryLifecycle(store, project)
    flow.onAuthEvent("PASSWORD_RECOVERY", true)
    await flow.finish(async () => {
      throw Error("offline")
    })
    expect(flow.getSnapshot()).toBe("ended")
    const restored = new RecoveryLifecycle(store, project)
    restored.onAuthEvent("INITIAL_SESSION", true)
    expect(restored.isolatesSession).toBe(true)
    expect(restored.getSnapshot()).toBe("ended")
    restored.acceptNormalSession()
    expect(restored.isolatesSession).toBe(false)
    expect(store.values.size).toBe(0)
  })

  it("late validation cannot reopen completed recovery", async () => {
    const flow = new RecoveryLifecycle(storage(), project)
    flow.onAuthEvent("PASSWORD_RECOVERY", true)
    let resolve!: (valid: boolean) => void
    const validation = flow.restore(
      true,
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    await flow.finish(async () => {})
    resolve(true)
    await validation
    expect(flow.getSnapshot()).toBe("ended")
  })

  it("ordinary login is unchanged and markers are project scoped", () => {
    const store = storage()
    new RecoveryLifecycle(store, project).onAuthEvent("PASSWORD_RECOVERY", true)
    const development = new RecoveryLifecycle(store, "http://127.0.0.1:54321")
    development.onAuthEvent("SIGNED_IN", true)
    development.invalidate()
    expect(development.getSnapshot()).toBe("idle")
  })

  it("reconstructs missing recovery markers from a recovery-origin session", async () => {
    const token = `header.${btoa(JSON.stringify({ amr: [{ method: "recovery" }] }))}.signature`
    const flow = new RecoveryLifecycle(storage(), project)
    flow.observeSession(token)
    expect(flow.isolatesSession).toBe(true)
    await flow.restore(true, async () => true)
    expect(flow.getSnapshot()).toBe("valid")
    expect(
      hasRecoveryOrigin(
        `header.${btoa(JSON.stringify({ amr: [{ method: "password" }] }))}.signature`
      )
    ).toBe(false)
  })

  it("an expired new callback cannot reuse the previous valid recovery state", async () => {
    const store = storage()
    new RecoveryLifecycle(store, project).onAuthEvent("PASSWORD_RECOVERY", true)
    const flow = new RecoveryLifecycle(store, project, {
      pathname: "/reset-password",
      hash: "",
      search: "?error=access_denied&error_code=otp_expired",
    })
    await flow.restore(true, async () => true)
    expect(flow.getSnapshot()).toBe("invalid")
  })

  it("storage failure prevents accepting an unmarked callback", () => {
    const store = storage()
    store.setItem = vi.fn(() => {
      throw Error("storage unavailable")
    })
    expect(
      () =>
        new RecoveryLifecycle(store, project, {
          pathname: "/reset-password",
          hash: "",
          search: "",
        })
    ).toThrow()
  })

  it("rejects wrong-project and malformed implicit callbacks without weakening PKCE", () => {
    const token = (iss: string) =>
      `header.${btoa(JSON.stringify({ iss }))}.signature`
    expect(
      callbackMatchesProject(
        `#access_token=${token(`${project}/auth/v1`)}`,
        project
      )
    ).toBe(true)
    expect(
      callbackMatchesProject(
        `#access_token=${token("https://development.example/auth/v1")}`,
        project
      )
    ).toBe(false)
    expect(callbackMatchesProject("#access_token=broken", project)).toBe(false)
    expect(callbackMatchesProject("", project)).toBe(true)
  })
})
