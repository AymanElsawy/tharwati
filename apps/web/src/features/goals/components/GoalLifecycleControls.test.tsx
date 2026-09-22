import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  GoalLifecycleActions,
  GoalLifecycleBadge,
} from "./GoalLifecycleControls"

const labels = {
  status: {
    active: "Active",
    completed: "Completed",
    cancelled: "Cancelled",
  },
  archived: "Archived",
  archive: "Archive",
  unarchive: "Unarchive",
  reopen: "Reopen",
  complete: "Complete",
  cancel: "Cancel goal",
  moreActions: "More actions",
  delete: "Delete Goal",
}

function renderLifecycle({
  status,
  archived,
  theme = "light",
  canDelete = false,
}: {
  status: "active" | "completed" | "cancelled"
  archived: boolean
  theme?: "light" | "dark"
  canDelete?: boolean
}) {
  return renderToStaticMarkup(
    <div data-theme={theme}>
      <GoalLifecycleBadge
        status={status}
        archived={archived}
        labels={labels}
      />
      <GoalLifecycleActions
        status={status}
        archived={archived}
        labels={labels}
        saving={false}
        onArchiveChange={() => undefined}
        onStatusChange={() => undefined}
        canDelete={canDelete}
        onDelete={() => undefined}
      />
    </div>
  )
}

describe("Goal Details lifecycle presentation", () => {
  it("renders only Active and Archive for an active non-archived goal", () => {
    const html = renderLifecycle({ status: "active", archived: false })

    expect(html).toContain('data-goal-lifecycle-badge="active"')
    expect(html).not.toContain('data-goal-lifecycle-badge="archived"')
    expect(html).toContain('data-goal-lifecycle-action="archive"')
    expect(html).not.toContain('data-goal-lifecycle-action="unarchive"')
    expect(html).not.toContain('data-goal-lifecycle-action="reopen"')
  })

  it("renders only Archived and Unarchive for an archived goal", () => {
    const html = renderLifecycle({ status: "active", archived: true })

    expect(html).toContain('data-goal-lifecycle-badge="archived"')
    expect(html).not.toContain('data-goal-lifecycle-badge="active"')
    expect(html).toContain('data-goal-lifecycle-action="unarchive"')
    expect(html).not.toContain('data-goal-lifecycle-action="archive"')
    expect(html).not.toContain('data-goal-lifecycle-action="reopen"')
  })

  it("shows Reopen only for a non-archived reopenable status", () => {
    const completed = renderLifecycle({ status: "completed", archived: false })
    const archived = renderLifecycle({ status: "completed", archived: true })

    expect(completed).toContain('data-goal-lifecycle-badge="completed"')
    expect(completed).toContain('data-goal-lifecycle-action="reopen"')
    expect(completed).toContain('data-goal-lifecycle-action="archive"')
    expect(archived).toContain('data-goal-lifecycle-badge="archived"')
    expect(archived).toContain('data-goal-lifecycle-action="unarchive"')
    expect(archived).not.toContain('data-goal-lifecycle-action="reopen"')
  })

  it.each(["light", "dark"] as const)(
    "uses contrast-safe semantic tokens for Archive and Archived in %s mode",
    (theme) => {
      const active = renderLifecycle({ status: "active", archived: false, theme })
      const archived = renderLifecycle({ status: "active", archived: true, theme })

      for (const html of [active, archived]) {
        expect(html).toContain("border-[var(--color-border-strong)]")
        expect(html).toContain("bg-[var(--color-surface-muted)]")
        expect(html).toContain("text-[var(--color-text-primary)]")
      }
      expect(active).toContain("hover:bg-[var(--color-surface-hover)]")
    }
  )

  it("shows destructive delete only for a zero-history goal", () => {
    const eligible = renderLifecycle({ status: "cancelled", archived: true, canDelete: true })
    const blocked = renderLifecycle({ status: "active", archived: false, canDelete: false })

    expect(eligible).toContain('data-goal-lifecycle-action="delete"')
    expect(eligible).toContain("Delete Goal")
    expect(blocked).not.toContain('data-goal-lifecycle-action="delete"')
  })
})
