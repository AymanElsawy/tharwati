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

export function HeroV3() {
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
    <div className="w-full overflow-hidden rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)]">
      <div className="px-6 pb-7 pt-6 sm:px-10 sm:pb-8 sm:pt-7 lg:px-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p
            className={`text-xs font-normal text-[var(--color-text-secondary)] transition-all duration-500 ease-out ${revealClass}`}
          >
            Good evening
          </p>
          <p
            className={`text-xs text-[var(--color-text-secondary)] transition-all delay-200 duration-500 ease-out ${revealClass}`}
          >
            Last updated <span aria-hidden="true">•</span>{" "}
            <span className="sr-only">:</span>Just now
          </p>
        </div>

        <div className="mt-5 sm:mt-6">
          <p
            className={`text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--color-text-secondary)] transition-all delay-75 duration-500 ease-out ${revealClass}`}
          >
            Your Net Worth
          </p>

          <p className="mt-2 font-black leading-none tracking-[-0.065em] text-[var(--color-text)]">
            <span className="sr-only">SAR 4,352,810</span>
            <span
              aria-hidden="true"
              className="block text-[clamp(2.5rem,6.4vw,5.45rem)]"
            >
              <span className="me-[0.23em] align-[0.15em] text-[0.31em] font-bold tracking-[-0.02em] text-[var(--color-text-secondary)]">
                SAR
              </span>
              {formatAmount(displayValue)}
            </span>
          </p>

          <div
            className={`mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 transition-all delay-150 duration-500 ease-out ${revealClass}`}
          >
            <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
              +SAR 98,000 this month
            </p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              <span aria-hidden="true">▲</span> 2.3%
            </p>
          </div>
        </div>
      </div>

      <div
        className={`grid border-t border-[var(--color-border)] transition-all delay-200 duration-500 ease-out lg:grid-cols-3 ${revealClass}`}
      >
        <section className="px-6 py-4 sm:px-8 sm:py-5 lg:px-9">
          <p className="text-xs font-medium uppercase tracking-[0.17em] text-[var(--color-text-secondary)]">
            Financial Freedom
          </p>
          <div className="mt-2.5 flex items-center gap-4">
            <p className="text-2xl font-black tracking-[-0.04em] text-[var(--color-text)]">
              72%
            </p>
            <div
              className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]"
              role="progressbar"
              aria-label="Financial freedom progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={72}
            >
              <div className="h-full w-[72%] rounded-full bg-[var(--color-primary)]" />
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--color-border)] px-6 py-4 sm:px-8 sm:py-5 lg:border-s lg:border-s-[var(--color-border)]/15 lg:border-t-0 lg:px-9">
          <p className="text-xs font-medium uppercase tracking-[0.17em] text-[var(--color-text-secondary)]">
            Primary Goal
          </p>
          <div className="mt-2.5">
            <p className="text-base font-bold tracking-[-0.025em] text-[var(--color-text)]">
              850K{" "}
              <span className="font-normal text-[var(--color-text-secondary)]">
                / 1.2M SAR
              </span>
            </p>
            <div
              className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]"
              role="progressbar"
              aria-label="Primary goal progress"
              aria-valuemin={0}
              aria-valuemax={1_200_000}
              aria-valuenow={850_000}
            >
              <div className="h-full w-[70.83%] rounded-full bg-emerald-600 dark:bg-emerald-400" />
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--color-border)] px-6 py-4 sm:px-8 sm:py-5 lg:border-s lg:border-s-[var(--color-border)]/15 lg:border-t-0 lg:px-9">
          <p className="text-xs font-medium uppercase tracking-[0.17em] text-[var(--color-text-secondary)]">
            Today&apos;s Focus
          </p>
          <p className="mt-3 text-sm font-bold tracking-[-0.02em] text-[var(--color-text)] sm:text-base">
            Add this month&apos;s investment
          </p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Due today
            </p>
            <button
              type="button"
              className="text-sm font-semibold text-[var(--color-primary)] transition hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              Continue <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
