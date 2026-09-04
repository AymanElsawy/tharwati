import { supabase, supabaseUrl, type TypedSupabaseClient } from "@/lib/supabase/client"
import {
  USER_DATA_EXPORT_SCHEMA,
  USER_DATA_EXPORT_VERSION,
  type UserDataExportV1,
} from "../types/user-data-export"

const requiredCollections = [
  "financial_accounts", "financial_transactions", "transaction_entries", "holdings",
  "user_assets", "asset_identifiers", "metal_purchases", "metal_purchase_lifecycle_events",
  "account_valuations", "account_disposals", "record_categories", "record_category_overrides",
  "goals", "goal_progress_entries", "manual_market_prices",
] as const

export class UserDataExportError extends Error {
  readonly code: "unavailable" | "invalid_export" | "rate_limited" | "too_large" | "authentication_required"

  constructor(code: UserDataExportError["code"]) {
    super(code === "invalid_export" ? "The data export response is invalid." : "Your data export is unavailable.")
    this.name = "UserDataExportError"
    this.code = code
  }
}

export function parseUserDataExport(value: unknown): UserDataExportV1 {
  if (!value || typeof value !== "object") throw new UserDataExportError("invalid_export")
  const exportValue = value as Record<string, unknown>
  const data = exportValue.data
  if (
    exportValue.schema !== USER_DATA_EXPORT_SCHEMA ||
    exportValue.version !== USER_DATA_EXPORT_VERSION ||
    typeof exportValue.generated_at !== "string" ||
    !exportValue.subject || typeof exportValue.subject !== "object" ||
    !data || typeof data !== "object"
  ) throw new UserDataExportError("invalid_export")

  const exportData = data as Record<string, unknown>
  if (!exportData.auth_account || typeof exportData.auth_account !== "object") {
    throw new UserDataExportError("invalid_export")
  }
  for (const key of requiredCollections) {
    if (!Array.isArray(exportData[key])) throw new UserDataExportError("invalid_export")
  }
  return value as UserDataExportV1
}

export class UserDataExportService {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient = supabase) {
    this.client = client
  }

  async requestExport(): Promise<UserDataExportV1> {
    const { data, error } = await this.client.functions.invoke<unknown>("export-my-data", {
      method: "GET",
    })
    if (error) throw new UserDataExportError("unavailable")
    return parseUserDataExport(data)
  }

  async downloadExport(): Promise<{ blob: Blob; filename: string }> {
    const { data: { session } } = await this.client.auth.getSession()
    if (!session?.access_token) throw new UserDataExportError("authentication_required")
    let response: Response
    try {
      response = await fetch(`${supabaseUrl}/functions/v1/export-my-data`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    } catch {
      throw new UserDataExportError("unavailable")
    }
    if (!response.ok) {
      const code = await response.json().then((body) => body?.error?.code).catch(() => null)
      if (response.status === 429 || code === "export_rate_limited") throw new UserDataExportError("rate_limited")
      if (response.status === 413 || code === "export_too_large") throw new UserDataExportError("too_large")
      if (response.status === 401 || code === "unauthenticated") throw new UserDataExportError("authentication_required")
      throw new UserDataExportError("unavailable")
    }
    const disposition = response.headers.get("Content-Disposition")
    const filename = disposition?.match(/filename="?([^";]+)"?/i)?.[1]
      ?? `tharwati-data-export-v1-${new Date().toISOString().slice(0, 10)}.json`
    return { blob: await response.blob(), filename }
  }
}

export const userDataExportService = new UserDataExportService()
