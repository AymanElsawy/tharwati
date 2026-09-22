import { Archive, Check, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { GoalStatus } from "@/lib/supabase/types"

type LifecycleLabels = {
  status: Record<GoalStatus, string>
  archived: string
  archive: string
  unarchive: string
  reopen: string
  complete: string
  cancel: string
  moreActions: string
  delete: string
}

type GoalLifecycleBadgeProps = {
  status: GoalStatus
  archived: boolean
  labels: LifecycleLabels
}

type GoalLifecycleActionsProps = GoalLifecycleBadgeProps & {
  saving: boolean
  onArchiveChange: () => void
  onStatusChange: (status: GoalStatus) => void
  canDelete: boolean
  onDelete: () => void
}

const archivedAppearance =
  "border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] text-[var(--color-text-primary)]"

export function GoalLifecycleBadge({ status, archived, labels }: GoalLifecycleBadgeProps) {
  return archived ? (
    <span
      data-goal-lifecycle-badge="archived"
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${archivedAppearance}`}
    >
      {labels.archived}
    </span>
  ) : (
    <span
      data-goal-lifecycle-badge={status}
      className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-primary)] capitalize"
    >
      {labels.status[status]}
    </span>
  )
}

export function GoalLifecycleActions({
  status,
  archived,
  labels,
  saving,
  onArchiveChange,
  onStatusChange,
  canDelete,
  onDelete,
}: GoalLifecycleActionsProps) {
  const archiveAction = (
    <Button
      className={`hidden sm:inline-flex ${archivedAppearance} hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]`}
      variant="outline"
      disabled={saving}
      onClick={onArchiveChange}
      data-goal-lifecycle-action={archived ? "unarchive" : "archive"}
    >
      <Archive size={16} />
      {archived ? labels.unarchive : labels.archive}
    </Button>
  )
  const deleteAction = canDelete ? (
    <Button
      className="hidden sm:inline-flex"
      variant="destructive"
      disabled={saving}
      onClick={onDelete}
      data-goal-lifecycle-action="delete"
    >
      <Trash2 size={16} />
      {labels.delete}
    </Button>
  ) : null

  if (archived) {
    return (
      <>
        {archiveAction}
        <GoalLifecycleMenu
          labels={labels}
          saving={saving}
          archiveLabel={labels.unarchive}
          archiveAction="unarchive"
          onArchiveChange={onArchiveChange}
          canDelete={canDelete}
          onDelete={onDelete}
        />
        {deleteAction}
      </>
    )
  }

  return (
    <>
      {status === "active" ? (
        <div className="hidden gap-2 sm:flex">
          <Button variant="outline" onClick={() => onStatusChange("completed")}>
            <Check size={16} />
            {labels.complete}
          </Button>
          <Button variant="outline" onClick={() => onStatusChange("cancelled")}>
            {labels.cancel}
          </Button>
        </div>
      ) : (
        <Button
          className="hidden sm:inline-flex"
          variant="outline"
          onClick={() => onStatusChange("active")}
          data-goal-lifecycle-action="reopen"
        >
          <RotateCcw size={16} />
          {labels.reopen}
        </Button>
      )}
      {archiveAction}
      <GoalLifecycleMenu
        labels={labels}
        saving={saving}
        status={status}
        archiveLabel={labels.archive}
        archiveAction="archive"
        onArchiveChange={onArchiveChange}
        onStatusChange={onStatusChange}
        canDelete={canDelete}
        onDelete={onDelete}
      />
      {deleteAction}
    </>
  )
}

function GoalLifecycleMenu({
  labels,
  saving,
  status,
  archiveLabel,
  archiveAction,
  onArchiveChange,
  onStatusChange,
  canDelete,
  onDelete,
}: {
  labels: LifecycleLabels
  saving: boolean
  status?: GoalStatus
  archiveLabel: string
  archiveAction: "archive" | "unarchive"
  onArchiveChange: () => void
  onStatusChange?: (status: GoalStatus) => void
  canDelete: boolean
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-lg border border-[var(--color-border)] p-2 sm:hidden"
        aria-label={labels.moreActions}
      >
        <MoreHorizontal size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status === "active" ? (
          <>
            <DropdownMenuItem onClick={() => onStatusChange?.("completed")}>
              {labels.complete}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange?.("cancelled")}>
              {labels.cancel}
            </DropdownMenuItem>
          </>
        ) : status ? (
          <DropdownMenuItem onClick={() => onStatusChange?.("active")}>
            {labels.reopen}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          disabled={saving}
          onClick={onArchiveChange}
          data-goal-lifecycle-action={archiveAction}
        >
          {archiveLabel}
        </DropdownMenuItem>
        {canDelete ? (
          <DropdownMenuItem
            disabled={saving}
            onClick={onDelete}
            className="text-destructive"
            data-goal-lifecycle-action="delete"
          >
            {labels.delete}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
