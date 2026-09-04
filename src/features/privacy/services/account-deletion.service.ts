import { supabase, supabaseUrl, type TypedSupabaseClient } from "@/lib/supabase/client"

export type AccountDeletionErrorCode = "unauthenticated" | "reauthentication_failed" | "deletion_failed"

export class AccountDeletionError extends Error {
  readonly code: AccountDeletionErrorCode

  constructor(code: AccountDeletionErrorCode) {
    super(code)
    this.name = "AccountDeletionError"
    this.code = code
  }
}

type Fetcher = typeof fetch

function isDeletedUserError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "user_not_found")
}

async function readErrorCode(response: Response): Promise<string | null> {
  return response.json().then((body) => body?.error?.code as string | undefined).catch(() => undefined).then((code) => code ?? null)
}

export class AccountDeletionService {
  private readonly client: TypedSupabaseClient
  private readonly fetcher: Fetcher

  constructor(client: TypedSupabaseClient = supabase, fetcher: Fetcher = fetch) {
    this.client = client
    this.fetcher = fetcher
  }

  async reauthenticate(password: string): Promise<void> {
    const { data: caller, error: callerError } = await this.client.auth.getUser()
    if (callerError || !caller.user?.email) throw new AccountDeletionError("unauthenticated")
    const { data, error } = await this.client.auth.signInWithPassword({ email: caller.user.email, password })
    if (error || data.user?.id !== caller.user.id) throw new AccountDeletionError("reauthentication_failed")
  }

  async deleteCurrentAccount(password: string): Promise<{ recovered: boolean }> {
    const { data: { session } } = await this.client.auth.getSession()
    if (!session?.access_token) throw new AccountDeletionError("unauthenticated")
    let response: Response
    try {
      response = await this.fetcher(`${supabaseUrl}/functions/v1/delete-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
    } catch {
      const { data, error } = await this.client.auth.getUser()
      if (!data.user && isDeletedUserError(error)) return { recovered: true }
      throw new AccountDeletionError("deletion_failed")
    }
    if (response.status === 204) return { recovered: false }
    const code = await readErrorCode(response)
    if (response.status === 401 || code === "unauthenticated") throw new AccountDeletionError("unauthenticated")
    if (code === "reauthentication_failed") throw new AccountDeletionError("reauthentication_failed")
    throw new AccountDeletionError("deletion_failed")
  }

  async clearLocalSession(): Promise<void> {
    try {
      await this.client.auth.signOut({ scope: "local" })
    } catch {
      // Deleted user cannot regain app access because local cleanup failed.
    }
  }
}

export async function exitDeletedAccount(clearLocalSession: () => Promise<void>, leaveAuthenticatedApp: () => void) {
  try {
    await clearLocalSession()
  } catch {
    // The Auth user is deleted; navigation must not depend on local cleanup.
  } finally {
    leaveAuthenticatedApp()
  }
}

export const accountDeletionService = new AccountDeletionService()
