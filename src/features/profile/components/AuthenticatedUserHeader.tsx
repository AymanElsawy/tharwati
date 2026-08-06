import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser"

export function AuthenticatedUserHeader() {
  const { avatar, email, error, greeting, isLoading } = useCurrentUser()

  if (isLoading) {
    return (
      <div aria-label="Loading user profile" className="flex items-center gap-2">
        <div className="size-8 animate-pulse rounded-full bg-[var(--color-surface-hover)]" />
        <div>
          <div className="h-4 w-40 animate-pulse rounded bg-[var(--color-surface-hover)]" />
          <div className="mt-1 h-2.5 w-28 animate-pulse rounded bg-[var(--color-surface-hover)]" />
        </div>
      </div>
    )
  }

  return (
    <section aria-label="Authenticated user" className="flex min-w-0 items-center gap-2">
      <Avatar className="size-8">
        {avatar.url && <AvatarImage src={avatar.url} alt="" />}
        <AvatarFallback className="bg-[var(--color-primary-soft)] font-bold text-[var(--color-primary)]">
          {avatar.fallback}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-bold leading-tight text-[var(--color-text)]">
          {greeting}
        </h2>
        <p className="text-[10px] leading-tight text-[var(--color-text-muted)]">Signed in as</p>
        <p className="truncate text-xs font-medium leading-tight text-[var(--color-text-secondary)]">
          {email || "Authenticated user"}
        </p>
        <p className="hidden text-[10px] leading-tight text-[var(--color-text-muted)] sm:block">
          Your personal wealth workspace
        </p>
        {error && <span className="sr-only">Profile details could not be loaded.</span>}
      </div>
    </section>
  )
}
