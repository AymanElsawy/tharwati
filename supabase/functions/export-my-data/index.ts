import { createClient } from "npm:@supabase/supabase-js@2"
import {
  buildUserDataExport,
  ExportTooLargeError,
  serializeUserDataExport,
} from "../_shared/user-data-export-response.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

function jsonError(code: string, status: number) {
  return new Response(JSON.stringify({ error: { code } }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
  })
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== "GET") return jsonError("method_not_allowed", 405)

  const authorization = request.headers.get("Authorization")
  if (!authorization) return jsonError("unauthenticated", 401)

  const url = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!url || !anonKey) return jsonError("export_unavailable", 503)

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) return jsonError("unauthenticated", 401)

  const { data, error } = await client.rpc("export_my_data_v1")
  if (error) {
    if (error.message === "export_rate_limited") return jsonError("export_rate_limited", 429)
    return jsonError("export_unavailable", 500)
  }

  try {
    const now = new Date()
    const document = buildUserDataExport(data, user, now.toISOString())
    const body = serializeUserDataExport(document)
    const day = now.toISOString().slice(0, 10)
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="tharwati-data-export-v1-${day}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...corsHeaders,
      },
    })
  } catch (error) {
    if (error instanceof ExportTooLargeError) return jsonError("export_too_large", 413)
    return jsonError("export_unavailable", 500)
  }
})
