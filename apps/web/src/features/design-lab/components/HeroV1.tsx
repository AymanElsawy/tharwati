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

export function HeroV1() {
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

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-[var(--color-border)]/40 bg-[var(--color-surface)] px-6 py-9 shadow-[0_10px_32px_rgba(15,23,42,0.025)] sm:px-10 sm:py-11 lg:px-16 lg:py-12">
      <div className="max-w-5xl">
        <p
          className={[
            "text-sm font-normal tracking-[-0.01em] text-[var(--color-text-secondary)] transition-all duration-500 ease-out",
            isVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-2 opacity-0",
          ].join(" ")}
        >
          Good evening
        </p>

        <div className="mt-8 sm:mt-10">
          <p
            className={[
              "text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-text-secondary)] transition-all delay-75 duration-500 ease-out",
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-2 opacity-0",
            ].join(" ")}
          >
            Your Net Worth
          </p>

          <p className="mt-4 font-black leading-none tracking-[-0.065em] text-[var(--color-text)]">
            <span className="sr-only">SAR 4,352,810</span>
            <span
              aria-hidden="true"
              className="block text-[clamp(3.25rem,9vw,7.75rem)]"
            >
              <span className="me-[0.22em] align-[0.16em] text-[0.34em] font-bold tracking-[-0.03em] text-[var(--color-text-secondary)]">
                SAR
              </span>
              {formatAmount(displayValue)}
            </span>
          </p>
        </div>

        <div
          className={[
            "mt-8 transition-all delay-150 duration-500 ease-out sm:mt-10",
            isVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-2 opacity-0",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400 sm:text-lg">
              +SAR 98,000 this month
            </p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 sm:text-base">
              <span aria-hidden="true">▲</span> 2.3%
            </p>
          </div>

          <p className="mt-5 text-sm text-[var(--color-text-secondary)]">
            Last updated <span aria-hidden="true">•</span>{" "}
            <span className="sr-only">:</span>Just now
          </p>
        </div>
      </div>
    </div>
  )
}
