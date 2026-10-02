import { describe, expect, it, vi } from "vitest"
import { RecoveryLifecycle } from "./recovery-lifecycle"
import { componentHarness, descendants } from "./recovery-component-harness"
import { en } from "../../i18n/en/translations"
import { ar } from "../../i18n/ar/translations"

const project = "https://production.example.supabase.co"
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))
function fixture() {
  const values = new Map<string, string>()
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v)
    },
    removeItem: (k: string) => {
      values.delete(k)
    },
  }
  return { storage, flow: new RecoveryLifecycle(storage, project) }
}
function app(flow: RecoveryLifecycle, path = "/", valid = true) {
  let event!: (event: string, session: unknown) => void
  const session = { user: { id: "test-user" } }
  const replace = vi.fn()
  const signOut = vi.fn(async () => {
    throw Error("offline")
  })
  const harness = componentHarness("src/app/App.tsx", {
    "../lib/supabase": {
      recoveryLifecycle: flow,
      supabase: {
        auth: {
          getSession: async () => ({ data: { session }, error: null }),
          getUser: async () => ({
            data: { user: valid ? session.user : null },
            error: null,
          }),
          onAuthStateChange: (fn: typeof event) => {
            event = fn
            return { data: { subscription: { unsubscribe() {} } } }
          },
          signOut,
        },
      },
    },
    "../i18n/useTranslation": {
      useTranslation: () => ({ t: (key: string) => key }),
    },
    "./startup-state": { withStartupTimeout: (promise: unknown) => promise },
    "../features/onboarding/repositories/onboarding.repository": {
      getOnboardingCompletion: async () => true,
    },
    "../features/auth/auth-session-lifecycle": {
      canPreserveAuthenticatedTree: () => false,
    },
    window: { location: { pathname: path, replace } },
  })
  return {
    harness,
    replace,
    signOut,
    event: (name: string) => {
      flow.onAuthEvent(name, true)
      event(name, session)
    },
  }
}

describe("Web recovery routing", () => {
  it("fresh recovery event overrides normal authenticated routing", async () => {
    const f = app(fixture().flow)
    f.harness.render()
    f.event("PASSWORD_RECOVERY")
    await flush()
    const tree = f.harness.render()
    expect(tree.type).toBe("ResetPasswordPage")
    expect(tree.props.recoveryStatus).toBe("valid")
    f.harness.dispose()
  })

  it("reload at / with a recovery session cannot reach Dashboard", async () => {
    const { flow, storage } = fixture()
    flow.onAuthEvent("PASSWORD_RECOVERY", true)
    const f = app(new RecoveryLifecycle(storage, project))
    expect(f.harness.render().type).toBe("ResetPasswordPage")
    await flush()
    expect(f.harness.render().props.recoveryStatus).toBe("valid")
    f.harness.dispose()
  })

  it("expired restored session stays in invalid recovery UI", async () => {
    const { flow } = fixture()
    flow.onAuthEvent("PASSWORD_RECOVERY", true)
    const f = app(flow, "/reset-password", false)
    f.harness.render()
    await flush()
    expect(f.harness.render().props.recoveryStatus).toBe("invalid")
    f.harness.dispose()
  })

  it.each(["onCancel", "onComplete", "onRequestNewLink"])(
    "%s terminates recovery and cannot leak the SDK session",
    async (action) => {
      const { flow, storage } = fixture()
      flow.onAuthEvent("PASSWORD_RECOVERY", true)
      const f = app(flow)
      f.harness.render()
      await flush()
      await f.harness.render().props[action]()
      expect(f.signOut).toHaveBeenCalledWith({ scope: "local" })
      expect(f.replace).toHaveBeenCalledWith(
        action === "onRequestNewLink" ? "/forgot-password" : "/login"
      )
      f.harness.dispose()
      const restart = app(new RecoveryLifecycle(storage, project))
      restart.harness.render()
      await flush()
      expect(
        descendants(restart.harness.render()).find(
          (node) => node.props.path === "/"
        )?.props.element.props.to
      ).toBe("/login")
      restart.harness.dispose()
    }
  )

  it("ordinary login keeps Dashboard routing", async () => {
    const f = app(fixture().flow)
    f.harness.render()
    await flush()
    expect(
      descendants(f.harness.render()).find((node) => node.props.path === "/")
        ?.props.element.props.to
    ).toBe("/dashboard")
    f.harness.dispose()
  })
})

describe("reset password UI", () => {
  function page(status: string, update = vi.fn(async () => {})) {
    const complete = vi.fn(async () => {
      throw Error("cleanup unavailable")
    })
    const request = vi.fn()
    const cancel = vi.fn()
    const harness = componentHarness(
      "src/features/auth/ResetPasswordPage.tsx",
      {
        "./auth.service": {
          updatePassword: update,
          meetsPasswordRequirements: (p: string) => p === "Password1234",
          PASSWORD_MIN_LENGTH: 12,
          isWeakPasswordError: () => false,
          getPasswordUpdateErrorMessage: () => "failure",
        },
        "@/i18n/useTranslation": {
          useTranslation: () => ({
            t: (key: string) => en[key as keyof typeof en] ?? key,
          }),
        },
      }
    )
    const render = () =>
      harness.render("ResetPasswordPage", {
        recoveryStatus: status,
        onComplete: complete,
        onRequestNewLink: request,
        onCancel: cancel,
        onInvalid: vi.fn(),
      })
    return { render, complete, request, cancel, update }
  }

  it("invalid/reused/expired links have explicit feedback and request-new-link action", () => {
    const f = page("invalid")
    const tree = descendants(f.render())
    expect(
      tree.some((n) => n.props.children === en["auth.recovery.invalid"])
    ).toBe(true)
    expect(tree.some((n) => n.type === "form")).toBe(false)
    tree
      .find((n) => n.props.children === en["auth.recovery.newLink"])!
      .props.onClick()
    expect(f.request).toHaveBeenCalledOnce()
  })

  it("successful update invokes Login completion even when cleanup fails", async () => {
    const f = page("valid")
    for (const field of descendants(f.render()).filter(
      (n) => n.type === "input"
    ))
      field.props.onChange({ target: { value: "Password1234" } })
    await descendants(f.render())
      .find((n) => n.type === "form")!
      .props.onSubmit({ preventDefault() {} })
    expect(f.update).toHaveBeenCalledWith("Password1234")
    expect(f.complete).toHaveBeenCalledOnce()
    expect(descendants(f.render()).some((n) => n.props.role === "alert")).toBe(
      false
    )
  })

  it("recovery error and actions are available in EN/AR", () => {
    for (const copy of [en, ar]) {
      expect(copy["auth.recovery.invalid"]).toBeTruthy()
      expect(copy["auth.recovery.newLink"]).toBeTruthy()
      expect(copy["auth.recovery.cancel"]).toBeTruthy()
    }
    expect(ar["auth.recovery.invalid"]).not.toBe(en["auth.recovery.invalid"])
  })
})
