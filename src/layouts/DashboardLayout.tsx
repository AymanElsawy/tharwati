import {
  LayoutDashboard,
  LogOut,
  Moon,
  Palette,
  PieChart,
  Sun,
  Target,
  type LucideIcon,
} from "lucide-react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { signOut } from "../features/auth/auth.service"
import {
  useTheme,
  type ThemeMode,
} from "../contexts/ThemeContext"

type NavigationItem = {
  label: string
  path: string
  icon: LucideIcon
}

type ThemeOption = {
  value: ThemeMode
  label: string
  icon: LucideIcon
}

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Portfolio",
    path: "/portfolio",
    icon: PieChart,
  },
  {
    label: "Goals",
    path: "/goals",
    icon: Target,
  },
]

const themeOptions: ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    icon: Moon,
  },
  {
    value: "colorful",
    label: "Colorful",
    icon: Palette,
  },
]

export function DashboardLayout() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

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
      <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-sidebar)] px-5 py-8 shadow-[4px_0_24px_rgba(15,50,35,0.04)]">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--color-primary)]">
            Tharwati
          </h1>

          <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">
            Build. Grow. Preserve.
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

                    <span>{item.label}</span>
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
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="ml-64 min-h-screen">
        <header className="sticky top-0 z-10 flex min-h-20 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-header)] px-10 py-3 backdrop-blur-xl">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Dashboard
            </h2>

            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              Welcome back to Tharwati
            </p>
          </div>

          <div className="flex items-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-sm">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const isSelected = theme === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  aria-label={`Use ${option.label} theme`}
                  aria-pressed={isSelected}
                  title={option.label}
                  className={[
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                    isSelected
                      ? "bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]",
                  ].join(" ")}
                >
                  <Icon size={17} />
                  <span className="hidden xl:inline">{option.label}</span>
                </button>
              )
            })}
          </div>
        </header>

        <main
          className="min-h-[calc(100vh-5rem)] p-10"
          style={{
            background:
              "linear-gradient(135deg, var(--page-gradient-start), var(--page-gradient-middle), var(--page-gradient-end))",
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}