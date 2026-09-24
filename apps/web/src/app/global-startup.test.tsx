import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  installGlobalErrorCapture,
  type AppErrorEvent,
} from "./app-error-reporter"
import { AppErrorBoundary } from "./AppErrorBoundary"
import { GlobalRecoveryScreen } from "./GlobalRecoveryScreen"
import { loadAppModule, resolveRootElement } from "./bootstrap"

const originalWindow = globalThis.window

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  })
})

function installWindow(language = "en", storageError = false) {
  const listeners = new Map<string, EventListener>()
  const value = {
    navigator: { language },
    location: { reload: vi.fn() },
    localStorage: {
      getItem: () => {
        if (storageError) throw new Error("secret-token-value")
        return language.startsWith("ar") ? "ar" : "en"
      },
    },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    addEventListener: vi.fn((name: string, listener: EventListener) => {
      listeners.set(name, listener)
    }),
    removeEventListener: vi.fn(),
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value,
  })
  return { value, listeners }
}

describe("global web startup recovery", () => {
  it("keeps the normal app graph behind a dynamic bootstrap import", () => {
    const main = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8")
    const bootstrap = readFileSync(
      resolve(process.cwd(), "src/app/bootstrap.tsx"),
      "utf8",
    )
    expect(main).not.toMatch(/import App from/)
    expect(bootstrap).toContain('import("./NormalApp")')
    expect(bootstrap).toContain("catch (error)")
  })

  it("converts configuration or module initialization failures into bootstrap failure", async () => {
    const failure = new Error("VITE_SECRET=https://private.example/token")
    const captured: AppErrorEvent[] = []
    const module = await loadAppModule(
      async () => {
        throw failure
      },
      { capture: (event) => captured.push(event) },
    )
    expect(module).toBeNull()
    expect(captured).toEqual([{ category: "bootstrap", error: failure }])
  })

  it("creates a safe root when the host root element is missing", () => {
    const appended: unknown[] = []
    const element = { id: "" }
    const fakeDocument = {
      getElementById: () => null,
      body: { append: (value: unknown) => appended.push(value) },
      createElement: () => element,
    } as unknown as Document
    expect(resolveRootElement(fakeDocument)).toBe(element)
    expect(element.id).toBe("root")
    expect(appended).toEqual([element])
  })

  it("renders safe English and Arabic recovery UI without exception details", () => {
    installWindow("en")
    const secret = "postgres://token-secret.example/uuid-123"
    const english = renderToStaticMarkup(
      <GlobalRecoveryScreen category="startup" onRetry={() => secret} />,
    )
    expect(english).toContain('lang="en"')
    expect(english).toContain('dir="ltr"')
    expect(english).toContain("Startup unavailable")
    expect(english).toContain('src="/tharwati-logo-light.png"')
    expect(english).toContain('alt="Tharwati"')
    expect(english).toContain("ث")
    expect(english).not.toContain(secret)

    installWindow("ar")
    const arabic = renderToStaticMarkup(
      <GlobalRecoveryScreen category="unexpected" onRetry={() => undefined} />,
    )
    expect(arabic).toContain('lang="ar"')
    expect(arabic).toContain('dir="rtl"')
    expect(arabic).toContain("حدث خطأ غير متوقع في التطبيق")
  })

  it("keeps the recovery brand asset on the public static path", () => {
    const screen = readFileSync(
      resolve(process.cwd(), "src/app/GlobalRecoveryScreen.tsx"),
      "utf8",
    )
    expect(screen).toContain('src="/tharwati-logo-light.png"')
    expect(screen).not.toMatch(/from ["'](?:\.\.\/|@\/)/)
  })

  it("survives browser storage exceptions", () => {
    installWindow("en", true)
    expect(() =>
      renderToStaticMarkup(
        <GlobalRecoveryScreen category="startup" onRetry={() => undefined} />,
      ),
    ).not.toThrow()
  })

  it("captures background rejections without changing healthy UI", () => {
    const { listeners } = installWindow()
    const captured: AppErrorEvent[] = []
    installGlobalErrorCapture({ capture: (event) => captured.push(event) })
    const reason = new Error("private backend detail")
    listeners.get("unhandledrejection")?.({ reason } as PromiseRejectionEvent)
    expect(captured).toEqual([{ category: "unhandled-rejection", error: reason }])
  })

  it("keeps render errors behind a root boundary with no raw copy path", () => {
    installWindow("en")
    const captured: AppErrorEvent[] = []
    const failure = new Error("SQL token uuid private.example")
    const boundary = new AppErrorBoundary({
      children: <div>healthy</div>,
      reporter: { capture: (event) => captured.push(event) },
    })
    boundary.componentDidCatch(failure)
    boundary.state = AppErrorBoundary.getDerivedStateFromError()
    const markup = renderToStaticMarkup(boundary.render())
    expect(captured).toEqual([{ category: "render", error: failure }])
    expect(markup).toContain("Unexpected application error")
    expect(markup).not.toContain(failure.message)
  })

  it("uses distinct session and account retries without automatic sign-out", () => {
    const app = readFileSync(resolve(process.cwd(), "src/app/App.tsx"), "utf8")
    expect(app).toContain('"failed-session"')
    expect(app).toContain('"failed-account"')
    expect(app).toContain("if (failedSession) void loadSession()")
    expect(app).toContain("else void resolveAccount(session)")
    expect(app).toContain("withStartupTimeout(")
    expect(app.match(/supabase\.auth\.signOut\(\)/g)).toHaveLength(1)
  })
})
