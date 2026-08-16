import {
  LayoutDashboard,
  LogOut,
  Moon,
  Palette,
  Sun,
  WalletCards,
  Menu,
  type LucideIcon,
} from "lucide-react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useState } from "react"
import type { TranslationKey } from "../i18n/en/translations"
import { LanguageSwitcher } from "../i18n/LanguageSwitcher"
import { useTranslation } from "../i18n/useTranslation"
import { signOut } from "../features/auth/auth.service"
import { AuthenticatedUserHeader } from "../features/profile/components/AuthenticatedUserHeader"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet"
import {
  useTheme,
  type ThemeMode,
} from "../contexts/ThemeContext"

type NavigationItem = {
  labelKey: TranslationKey
  path: string
  icon: LucideIcon
}

type ThemeOption = {
  value: ThemeMode
  labelKey: TranslationKey
  icon: LucideIcon
}

const navigationItems: NavigationItem[] = [
  {
    labelKey: "navigation.dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    labelKey: "navigation.accounts",
    path: "/accounts",
    icon: WalletCards,
  },
]

const themeOptions: ThemeOption[] = [
  {
    value: "light",
    labelKey: "theme.light",
    icon: Sun,
  },
  {
    value: "dark",
    labelKey: "theme.dark",
    icon: Moon,
  },
  {
    value: "colorful",
    labelKey: "theme.colorful",
    icon: Palette,
  },
]

export function DashboardLayout() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false)

  async function handleLogout() {
    try {
      await signOut()
      navigate("/login", { replace: true })
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const navigation = (onNavigate?: () => void) => (
    <>
      <div>
        <h1 className="text-3xl font-black tracking-tight text-[var(--color-primary)]">
          Tharwati
        </h1>
        <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">
          {t("header.tagline")}
        </p>
      </div>

      <nav className="mt-10 flex flex-col gap-2">
        {navigationItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  "group flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold transition",
                  isActive
                    ? "bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} className="shrink-0" />
                  <span>{t(item.labelKey)}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="mt-auto">
        <button
          type="button"
          onClick={() => {
            onNavigate?.()
            void handleLogout()
          }}
          className="tharwati-button-secondary flex w-full items-center justify-center gap-2"
        >
          <LogOut size={18} strokeWidth={2} />
          <span>{t("navigation.logout")}</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="theme-transition min-h-screen overflow-x-clip bg-[var(--color-background)]">
      <aside className="fixed inset-y-0 start-0 z-20 hidden w-[var(--layout-sidebar-width)] flex-col border-e border-[var(--border-subtle)] bg-[var(--color-sidebar)] px-6 py-9 shadow-[2px_0_20px_rgba(15,23,42,0.025)] lg:flex">
        {navigation()}
      </aside>

      <Sheet open={isMobileNavigationOpen} onOpenChange={setIsMobileNavigationOpen}>
        <SheetContent side="left" className="w-[min(19rem,calc(100vw-2.5rem))] border-[var(--border-subtle)] bg-[var(--color-sidebar)] p-6">
          <SheetHeader className="sr-only"><SheetTitle>{t("navigation.open")}</SheetTitle></SheetHeader>
          <div className="flex h-full flex-col">{navigation(() => setIsMobileNavigationOpen(false))}</div>
        </SheetContent>

        <div className="min-h-screen lg:ms-[var(--layout-sidebar-width)]">
        <header className="sticky top-0 z-10 flex min-h-11 items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--color-header)] px-[var(--space-page-inline)] py-1 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2">
            <SheetTrigger render={<button type="button" aria-label={t("navigation.open")} className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] lg:hidden" />}>
              <Menu size={20} />
            </SheetTrigger>
            <AuthenticatedUserHeader />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher />
            <div className="flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
              {themeOptions.map((option) => {
              const Icon = option.icon
              const isSelected = theme === option.value
              const label = t(option.labelKey)

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  aria-label={t("theme.use", { theme: label })}
                  aria-pressed={isSelected}
                  title={label}
                  className={[
                    "flex size-8 items-center justify-center rounded-lg text-sm font-semibold transition sm:size-auto sm:px-2.5 sm:py-1.5",
                    isSelected
                      ? "bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]",
                  ].join(" ")}
                >
                  <Icon size={17} />
                  <span className="hidden xl:inline">{label}</span>
                </button>
              )
              })}
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-2.75rem)] bg-[var(--color-background)] px-[var(--space-page-inline)] py-[var(--space-page-block)]">
          <div className="tharwati-content-frame">
            <Outlet />
          </div>
        </main>
        </div>
      </Sheet>
    </div>
  )
}
