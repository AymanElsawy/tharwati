import { AlertTriangle } from "lucide-react"

export function PortfolioDataDisclosure({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 border-y border-amber-600/30 py-4 text-amber-900 dark:text-amber-200"
    >
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 opacity-80">
          {description}
        </p>
      </div>
    </div>
  )
}
