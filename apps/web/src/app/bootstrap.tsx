import { StrictMode, type ComponentType } from "react"
import { createRoot, type Root } from "react-dom/client"

import { AppErrorBoundary } from "./AppErrorBoundary"
import {
  installGlobalErrorCapture,
  noopAppErrorReporter,
  type AppErrorReporter,
} from "./app-error-reporter"
import { GlobalRecoveryScreen } from "./GlobalRecoveryScreen"

export type AppModule = { default: ComponentType }

export async function loadAppModule(
  loadApp: () => Promise<AppModule>,
  reporter: AppErrorReporter,
): Promise<AppModule | null> {
  try {
    return await loadApp()
  } catch (error) {
    reporter.capture({ category: "bootstrap", error })
    return null
  }
}

export function resolveRootElement(
  documentValue: Document = document,
): HTMLElement | null {
  const existing = documentValue.getElementById("root")
  if (existing) return existing
  if (!documentValue.body) return null
  const fallbackRoot = documentValue.createElement("div")
  fallbackRoot.id = "root"
  documentValue.body.append(fallbackRoot)
  return fallbackRoot
}

export async function bootstrapWebApp({
  loadApp = () => import("./NormalApp"),
  reporter = noopAppErrorReporter,
  documentValue = document,
}: {
  loadApp?: () => Promise<AppModule>
  reporter?: AppErrorReporter
  documentValue?: Document
} = {}): Promise<Root | null> {
  installGlobalErrorCapture(reporter)
  const element = resolveRootElement(documentValue)
  if (!element) {
    reporter.capture({
      category: "bootstrap",
      error: new Error("root unavailable"),
    })
    return null
  }

  const root = createRoot(element)
  root.render(<GlobalRecoveryScreen category="startup" loading />)

  const module = await loadAppModule(loadApp, reporter)
  if (module) {
    const NormalApp = module.default
    root.render(
      <StrictMode>
        <AppErrorBoundary reporter={reporter}>
          <NormalApp />
        </AppErrorBoundary>
      </StrictMode>,
    )
  } else {
    root.render(
      <GlobalRecoveryScreen
        category="startup"
        action="reload"
        onRetry={() => window.location.reload()}
      />,
    )
  }
  return root
}
