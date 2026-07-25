import { PlusCircle } from "lucide-react"
import { Link } from "react-router-dom"

export function DashboardEmptyState() {
  return (
    <div className="tharwati-card flex min-h-80 flex-col items-center justify-center p-8 text-center">
      <PlusCircle className="size-10 text-[var(--color-primary)]" />
      <h2 className="mt-5 text-2xl font-bold">
        Start building your financial picture
      </h2>
      <p className="mt-2 max-w-lg text-[var(--color-text-secondary)]">
        Add a cash account or your first investment to populate the dashboard
        with real balances, valuation, and activity.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/cash" className="tharwati-button-secondary">
          Add cash account
        </Link>
        <Link to="/holdings" className="tharwati-button-primary">
          View investments
        </Link>
      </div>
    </div>
  )
}
