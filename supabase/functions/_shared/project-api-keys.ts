type ProjectKeyKind = "publishable" | "secret"

export function defaultProjectApiKey(raw: string | undefined, kind: ProjectKeyKind): string {
  let keys: unknown
  try {
    keys = JSON.parse(raw ?? "")
  } catch {
    throw new Error(`SUPABASE_${kind.toUpperCase()}_KEYS is unavailable`)
  }

  const key = keys && typeof keys === "object" && !Array.isArray(keys)
    ? (keys as Record<string, unknown>).default
    : null
  if (typeof key !== "string" || !key.startsWith(`sb_${kind}_`)) {
    throw new Error(`SUPABASE_${kind.toUpperCase()}_KEYS has no default key`)
  }
  return key
}

export function projectApiKey(kind: ProjectKeyKind): string {
  return defaultProjectApiKey(Deno.env.get(`SUPABASE_${kind.toUpperCase()}_KEYS`), kind)
}
