import { createRootRoute, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

import { AppShell } from "@/components/layout/app-shell"

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <AppShell>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </AppShell>
  )
}