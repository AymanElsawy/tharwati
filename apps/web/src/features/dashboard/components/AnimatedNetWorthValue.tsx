/* eslint-disable react-refresh/only-export-components -- animation utilities have focused unit coverage. */
import { useEffect, useRef, useState } from "react"

export const netWorthAnimationDurationMs = 500

export function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3)
}

export function interpolateNetWorthValue(start: number, target: number, progress: number) {
  return start + (target - start) * easeOutCubic(Math.min(Math.max(progress, 0), 1))
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)
    updatePreference()
    mediaQuery.addEventListener("change", updatePreference)
    return () => mediaQuery.removeEventListener("change", updatePreference)
  }, [])

  return prefersReducedMotion
}

function useAnimatedNetWorthValue(target: number) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const hasAnimated = useRef(false)
  const displayedValue = useRef(0)
  const frameId = useRef<number | null>(null)
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (frameId.current !== null) cancelAnimationFrame(frameId.current)

    if (prefersReducedMotion || hasAnimated.current || displayedValue.current === target) {
      hasAnimated.current = true
      displayedValue.current = target
      setValue(target)
      frameId.current = null
      return
    }

    const startValue = displayedValue.current
    const startedAt = performance.now()
    const animate = (now: number) => {
      hasAnimated.current = true
      const progress = Math.min((now - startedAt) / netWorthAnimationDurationMs, 1)
      const nextValue = interpolateNetWorthValue(startValue, target, progress)
      displayedValue.current = nextValue
      setValue(nextValue)

      if (progress < 1) frameId.current = requestAnimationFrame(animate)
      else frameId.current = null
    }

    frameId.current = requestAnimationFrame(animate)
    return () => {
      if (frameId.current !== null) cancelAnimationFrame(frameId.current)
      frameId.current = null
    }
  }, [prefersReducedMotion, target])

  return value
}

/** Presentation-only value animation; its caller keeps formatting and financial data ownership. */
export function AnimatedNetWorthValue({ value, format }: { value: number; format: (value: number) => string }) {
  return <>{format(useAnimatedNetWorthValue(value))}</>
}
