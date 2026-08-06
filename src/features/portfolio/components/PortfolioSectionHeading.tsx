import type { ReactNode } from "react"

export function PortfolioSectionHeading({
  eyebrow,
  title,
  titleId,
  action,
}: {
  eyebrow: ReactNode
  title: ReactNode
  titleId: string
  action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="tharwati-eyebrow">{eyebrow}</p>
        <h2 id={titleId} className="tharwati-section-title mt-2">
          {title}
        </h2>
      </div>
      {action}
    </header>
  )
}
