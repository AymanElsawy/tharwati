import type { TypedSupabaseClient } from "./client"
import { RepositoryError, toRepositoryError } from "./types"

type QueryError = {
  code?: string
  message: string
  details?: string
  hint?: string
} | null

export async function requireAuthenticatedUserId(
  client: TypedSupabaseClient,
  operation: string,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser()

  if (error) {
    throw toRepositoryError(error, operation)
  }

  if (!user) {
    throw new RepositoryError({
      code: "authentication_required",
      message: "An authenticated user is required",
      operation,
    })
  }

  return user.id
}

export function requireQueryData<Data>(
  data: Data | null,
  error: QueryError,
  operation: string,
): Data {
  if (error) {
    throw toRepositoryError(error, operation)
  }

  if (data === null) {
    throw new RepositoryError({
      code: "not_found",
      message: "The requested record was not found",
      operation,
    })
  }

  return data
}
