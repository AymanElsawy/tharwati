import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import {
  BarChart3,
  Banknote,
  CircleDollarSign,
  Coins,
  LayoutDashboard,
  Menu,
  Moon,
  Settings,
  Sun,
  Target,
  TrendingUp,
} from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

type AppShellProps = {
  children: ReactNode
}

const navigationItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Investments", icon: TrendingUp },
  { label: "Cash", icon: Banknote },
  { label: "Gold", icon: Coins },
  { label: "Goals", icon: Target },
  { label: "Analytics", icon: BarChart3 },
  { label: "Settings", icon: Settings },
]

function SidebarContent() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CircleDollarSign className="size-5" />
        </div>

        <div>
          <p className="font-semibold">Tharwati</p>
          <p className="text-xs text-muted-foreground">
            Wealth Manager
          </p>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 p-3">
        {navigationItems.map((item, index) => {
          const Icon = item.icon

          if (index === 0) {
            return (
              <Button
                key={item.label}
                variant="secondary"
                className="w-full justify-start gap-3"
                asChild
              >
                <Link to="/">
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              </Button>
            )
          }

          return (
            <Button
              key={item.label}
              variant="ghost"
              className="w-full justify-start gap-3"
              disabled
            >
              <Icon className="size-4" />
              {item.label}
            </Button>
          )
        })}
      </nav>

      <Separator />

      <div className="flex items-center gap-3 p-4">
        <Avatar>
          <AvatarFallback>IA</AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Ibrahim Allam</p>
          <p className="truncate text-xs text-muted-foreground">
            Personal account
          </p>
        </div>
      </div>
    </div>
  )
}

export function AppShell({ children }: AppShellProps) {
  const { theme, setTheme } = useTheme()

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-background lg:block">
        <SidebarContent />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Open navigation"
                  />
                }
              >
                <Menu className="size-5" />
              </SheetTrigger>

              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>

                <SidebarContent />
              </SheetContent>
            </Sheet>

            <div>
              <p className="text-sm font-medium">Personal Wealth Manager</p>
              <p className="text-xs text-muted-foreground">
                Track and manage your wealth
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}