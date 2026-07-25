import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser"

export function AuthenticatedUserHeader() {
  const { avatar, email, error, greeting, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div aria-label="Loading user profile" className="flex items-center gap-3">
        <div className="size-11 animate-pulse rounded-full bg-[var(--color-surface-hover)]" />
        <div>
          <div className="h-5 w-44 animate-pulse rounded bg-[var(--color-surface-hover)]" />
          <div className="mt-2 h-3 w-32 animate-pulse rounded bg-[var(--color-surface-hover)]" />
        </div>
      </div>
    )
  }

  return (
    <section aria-label="Authenticated user" className="flex min-w-0 items-center gap-3.5">
      <Avatar className="size-11 shadow-sm">
        {avatar.url && <AvatarImage src={avatar.url} alt="" />}
        <AvatarFallback className="bg-[var(--color-primary-soft)] font-bold text-[var(--color-primary)]">
          {avatar.fallback}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h2 className="truncate text-lg font-bold text-[var(--color-text)] sm:text-xl">
          {greeting}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Signed in as</p>
        <p className="truncate text-sm font-medium text-[var(--color-text-secondary)]">
          {email || "Authenticated user"}
        </p>
        <p className="mt-0.5 hidden text-xs text-[var(--color-text-muted)] sm:block">
          Your personal wealth workspace
        </p>
        {error && <span className="sr-only">Profile details could not be loaded.</span>}
      </div>
    </section>
  )
}
