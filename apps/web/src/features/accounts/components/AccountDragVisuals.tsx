import { useLayoutEffect, useRef, type RefObject } from "react"

/** Render the actual row/card markup without duplicating its live event handlers. */
export function AccountDragPreview({
  variant,
  sourceClone,
  cellWidths,
  fontFamily,
  width,
  height,
  x,
  y,
  offsetX,
  offsetY,
  direction,
  previewRef,
}: {
  variant: "table" | "card"
  sourceClone: HTMLElement
  cellWidths: number[]
  fontFamily: string
  width: number
  height: number
  x: number
  y: number
  offsetX: number
  offsetY: number
  direction: "ltr" | "rtl"
  previewRef: RefObject<HTMLDivElement | null>
}) {
  const hostRef = useRef<HTMLTableSectionElement | HTMLDivElement>(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.replaceChildren(sourceClone)
    return () => {
      if (sourceClone.parentNode === host) host.removeChild(sourceClone)
    }
  }, [sourceClone])

  return (
    <div
      ref={previewRef}
      data-account-drag-preview={variant}
      aria-hidden="true"
      inert
      dir={direction}
      style={{
        width,
        height,
        fontFamily,
        transformOrigin: `${offsetX}px ${offsetY}px`,
        transform: `translate3d(${x}px, ${y}px, 0) scale(1.02)`,
      }}
      className="pointer-events-none fixed left-0 top-0 z-[100] overflow-hidden rounded-xl bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] opacity-100 outline outline-1 outline-[var(--color-border)] shadow-[0_20px_48px_rgba(15,23,42,0.20)] will-change-transform"
    >
      {variant === "table" ? (
        <table className="w-full table-fixed text-sm">
          <colgroup>{cellWidths.map((cellWidth, index) => <col key={index} style={{ width: cellWidth }} />)}</colgroup>
          <tbody ref={hostRef as RefObject<HTMLTableSectionElement | null>} />
        </table>
      ) : (
        <div ref={hostRef as RefObject<HTMLDivElement | null>} />
      )}
    </div>
  )
}

export function AccountInsertionGap({ variant, height }: { variant: "table" | "card"; height: number }) {
  const gap = (
    <div
      data-account-insertion-preview
      style={{ height: Math.max(44, height - 8) }}
      className="mx-1 my-1 rounded-lg bg-[var(--color-primary-soft)]/30"
    />
  )
  return variant === "table" ? (
    <tr data-order-gap="table" aria-hidden="true"><td colSpan={6} className="p-0">{gap}</td></tr>
  ) : (
    <div data-order-gap="card" aria-hidden="true">{gap}</div>
  )
}
