export type MutationRefreshOutcome =
  | { mutation: "rejected"; error: unknown }
  | { mutation: "committed"; refresh: "current" | "stale" }

export async function runMutationThenRefresh({
  mutate,
  onCommitted,
  refresh,
}: {
  mutate: () => Promise<void>
  onCommitted: () => void
  refresh: () => Promise<void>
}): Promise<MutationRefreshOutcome> {
  try {
    await mutate()
  } catch (error) {
    return { mutation: "rejected", error }
  }

  onCommitted()
  try {
    await refresh()
    return { mutation: "committed", refresh: "current" }
  } catch {
    return { mutation: "committed", refresh: "stale" }
  }
}
