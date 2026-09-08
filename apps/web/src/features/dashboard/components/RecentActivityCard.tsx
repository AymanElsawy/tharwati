import type { DashboardActivity } from "@/features/dashboard/types/dashboard"

export function RecentActivityCard({
  activities,
}: {
  activities: DashboardActivity[]
}) {
  return (
    <article className="tharwati-list-surface">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] px-1 py-5 sm:px-6">
        <div>
          <h2 className="tharwati-section-title">Recent Activity</h2>
          <p className="tharwati-section-description">
          Posted ledger activity and exchange-rate updates
          </p>
        </div>
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
              className="tharwati-list-row px-1 py-4 sm:px-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
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
