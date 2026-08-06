import {
  LayoutDashboard,
  LogOut,
  Moon,
  Palette,
  PieChart,
  Sun,
  Target,
  Shapes,
  Layers3,
  Banknote,
  ArrowLeftRight,
  BadgeDollarSign,
  WalletCards,
  type LucideIcon,
} from "lucide-react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useEffect, useState } from "react"
import type { TranslationKey } from "../i18n/en/translations"
import { LanguageSwitcher } from "../i18n/LanguageSwitcher"
import { useTranslation } from "../i18n/useTranslation"
import { signOut } from "../features/auth/auth.service"
import { AddInvestmentDialog } from "../features/investments/components/AddInvestmentDialog"
import { AuthenticatedUserHeader } from "../features/profile/components/AuthenticatedUserHeader"
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
    labelKey: "navigation.portfolio",
    path: "/portfolio",
    icon: PieChart,
  },
  {
    labelKey: "navigation.accounts",
    path: "/accounts",
    icon: WalletCards,
  },
  {
    labelKey: "navigation.cash",
    path: "/cash",
    icon: Banknote,
  },
  {
    labelKey: "navigation.exchangeRates",
    path: "/exchange-rates",
    icon: ArrowLeftRight,
  },
  {
    labelKey: "navigation.marketPrices",
    path: "/market-prices",
    icon: BadgeDollarSign,
  },
  {
    labelKey: "navigation.assets",
    path: "/assets",
    icon: Shapes,
  },
  {
    labelKey: "navigation.holdings",
    path: "/holdings",
    icon: Layers3,
  },
  {
    labelKey: "navigation.goals",
    path: "/goals",
    icon: Target,
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
  const [isAddInvestmentOpen, setIsAddInvestmentOpen] = useState(false)
  const [investmentToast, setInvestmentToast] = useState<string | null>(
    null,
  )

  useEffect(() => {
    const open = () => setIsAddInvestmentOpen(true)
    window.addEventListener("tharwati:add-investment", open)
    return () => window.removeEventListener("tharwati:add-investment", open)
  }, [])

  async function handleLogout() {
    try {
      await signOut()
      navigate("/login", { replace: true })
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  return (
    <div className="theme-transition min-h-screen bg-[var(--color-background)]">
      <aside className="fixed inset-y-0 start-0 z-20 flex w-[var(--layout-sidebar-width)] flex-col border-e border-[var(--border-subtle)] bg-[var(--color-sidebar)] px-6 py-9 shadow-[2px_0_20px_rgba(15,23,42,0.025)]">
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
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.4 : 2}
                      className="shrink-0"
                    />

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
            onClick={handleLogout}
            className="tharwati-button-secondary flex w-full items-center justify-center gap-2"
          >
            <LogOut size={18} strokeWidth={2} />
            <span>{t("navigation.logout")}</span>
          </button>
        </div>
      </aside>

      <div className="ms-[var(--layout-sidebar-width)] min-h-screen">
        <header className="sticky top-0 z-10 flex min-h-11 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--color-header)] px-[var(--space-page-inline)] py-1 backdrop-blur-xl">
          <AuthenticatedUserHeader />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddInvestmentOpen(true)}
              className="tharwati-button-primary hidden !min-h-9 items-center gap-2 !rounded-xl !px-3 !py-1.5 text-sm lg:flex"
            >
              <Shapes size={17} />
              {t("investment.primaryAction")}
            </button>
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
                    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition",
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
      <button
        type="button"
        onClick={() => setIsAddInvestmentOpen(true)}
        className="tharwati-button-primary fixed bottom-6 end-6 z-30 flex items-center gap-2 lg:hidden"
      >
        <Shapes size={18} />
        {t("investment.primaryAction")}
      </button>
      <AddInvestmentDialog
        isOpen={isAddInvestmentOpen}
        onClose={() => setIsAddInvestmentOpen(false)}
        onSuccess={(result) => {
          setInvestmentToast(
            t("investment.success", {
              asset: result.asset.name,
              account: result.account.name,
            }),
          )
          window.setTimeout(() => setInvestmentToast(null), 4000)
        }}
      />
      {investmentToast ? (
        <div
          role="status"
          className="fixed bottom-6 end-6 z-[60] rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 shadow-xl"
        >
          {investmentToast}
        </div>
      ) : null}
    </div>
  )
}
