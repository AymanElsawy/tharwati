import type { DashboardActivity } from "@/features/dashboard/types/dashboard"

export function RecentActivityCard({
  activities,
}: {
  activities: DashboardActivity[]
}) {
  return (
    <article className="tharwati-card overflow-hidden">
      <header className="border-b border-[var(--color-border)] px-6 py-5">
        <h2 className="text-xl font-bold">Recent Activity</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Posted ledger activity and exchange-rate updates
        </p>
      </header>
      {activities.length === 0 ? (
        <p className="p-8 text-sm text-[var(--color-text-secondary)]">
          No posted activity yet.
        </p>
      ) : (
        <ol>
          {activities.map((activity) => (
            <li
              key={activity.id}
              className="border-b border-[var(--color-border)] px-6 py-4 last:border-0"
            >
              <div className="flex justify-between gap-4">
                <div>
                  <p className="font-semibold">{activity.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {activity.description}
                  </p>
                </div>
                <time
                  className="shrink-0 text-xs text-[var(--color-text-muted)]"
                  dateTime={activity.occurredAt}
                >
                  {new Date(activity.occurredAt).toLocaleDateString()}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}
