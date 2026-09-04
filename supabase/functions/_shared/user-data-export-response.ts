export const USER_DATA_EXPORT_SCHEMA = "tharwati.user-data-export" as const
export const USER_DATA_EXPORT_VERSION = 1 as const
export const MAX_USER_DATA_EXPORT_BYTES = 10 * 1024 * 1024

type AuthUserInput = {
  id: string
  email?: string | null
  phone?: string | null
  created_at: string
  updated_at?: string | null
  last_sign_in_at?: string | null
}

type RpcExport = {
  schema: string
  version: number
  subject: { user_id: string }
  data: Record<string, unknown>
}

export class ExportTooLargeError extends Error {
  constructor() {
    super("export_too_large")
    this.name = "ExportTooLargeError"
  }
}

export function safeAuthAccount(user: AuthUserInput) {
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    created_at: user.created_at,
    updated_at: user.updated_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
  }
}

export function buildUserDataExport(
  rpcExport: RpcExport,
  user: AuthUserInput,
  generatedAt: string,
) {
  if (
    rpcExport.schema !== USER_DATA_EXPORT_SCHEMA ||
    rpcExport.version !== USER_DATA_EXPORT_VERSION ||
    rpcExport.subject?.user_id !== user.id ||
    !rpcExport.data || typeof rpcExport.data !== "object"
  ) throw new Error("invalid_export_contract")

  return {
    schema: USER_DATA_EXPORT_SCHEMA,
    version: USER_DATA_EXPORT_VERSION,
    generated_at: generatedAt,
    subject: rpcExport.subject,
    data: { auth_account: safeAuthAccount(user), ...rpcExport.data },
  }
}

export function serializeUserDataExport(document: unknown, maximumBytes = MAX_USER_DATA_EXPORT_BYTES) {
  const body = JSON.stringify(document, null, 2)
  if (new TextEncoder().encode(body).byteLength > maximumBytes) throw new ExportTooLargeError()
  return body
}
