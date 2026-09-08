import { useEffect, useState } from "react"

const netWorth = 4_352_810
const animationDuration = 700

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value)
}

export function HeroV2() {
  const [displayValue, setDisplayValue] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(netWorth)
      setIsVisible(true)
      return
    }

    let animationFrame = 0
    let startedAt: number | null = null

    setIsVisible(true)

    function update(timestamp: number) {
      startedAt ??= timestamp
      const progress = Math.min(
        (timestamp - startedAt) / animationDuration,
        1,
      )

      setDisplayValue(Math.round(netWorth * easeOutCubic(progress)))

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(update)
      }
    }

    animationFrame = window.requestAnimationFrame(update)

    return () => window.cancelAnimationFrame(animationFrame)
  }, [])

  const revealClass = isVisible
    ? "translate-y-0 opacity-100"
    : "translate-y-2 opacity-0"

  return (
    <div className="w-full border-y border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 sm:px-10 lg:px-14">
      <div className="grid items-stretch gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(16rem,3fr)] lg:gap-12">
        <div className="flex min-w-0 flex-col justify-between py-1">
          <p
            className={`text-sm font-normal text-[var(--color-text-secondary)] transition-all duration-500 ease-out ${revealClass}`}
          >
            Good evening
          </p>

          <div className="mt-8">
            <p
              className={`text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-text-secondary)] transition-all delay-75 duration-500 ease-out ${revealClass}`}
            >
              Your Net Worth
            </p>

            <p className="mt-3 font-black leading-none tracking-[-0.06em] text-[var(--color-text)]">
              <span className="sr-only">SAR 4,352,810</span>
              <span
                aria-hidden="true"
                className="block text-[clamp(3rem,7vw,6.25rem)]"
              >
                <span className="me-[0.24em] align-[0.14em] text-[0.32em] font-bold tracking-[-0.02em] text-[var(--color-text-secondary)]">
                  SAR
                </span>
                {formatAmount(displayValue)}
              </span>
            </p>
          </div>

          <div
            className={`mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 transition-all delay-150 duration-500 ease-out ${revealClass}`}
          >
            <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
              +SAR 98,000 this month
            </p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              <span aria-hidden="true">▲</span> 2.3%
            </p>
            <span
              className="hidden h-4 w-px bg-[var(--color-border)] sm:block"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Last updated <span aria-hidden="true">•</span>{" "}
              <span className="sr-only">:</span>Just now
            </p>
          </div>
        </div>

        <aside
          className={`flex flex-col justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6 transition-all delay-200 duration-500 ease-out sm:p-7 ${revealClass}`}
          aria-label="Financial freedom progress"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[var(--color-text-secondary)]">
              Financial Freedom
            </p>
            <p className="mt-5 text-5xl font-black tracking-[-0.055em] text-[var(--color-text)]">
              72%
            </p>
          </div>

          <div className="mt-10">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]"
              role="progressbar"
              aria-label="Financial freedom progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={72}
            >
              <div className="h-full w-[72%] rounded-full bg-[var(--color-primary)]" />
            </div>
            <p className="mt-4 max-w-xs text-sm leading-6 text-[var(--color-text-secondary)]">
              Progress toward your financial independence.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
