import { createClient } from "npm:@supabase/supabase-js@2"

const maximumBodyBytes = 4096
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type ErrorCode = "unauthenticated" | "reauthentication_failed" | "deletion_failed" | "method_not_allowed"

function jsonError(code: ErrorCode, status: number) {
  return new Response(JSON.stringify({ error: { code } }), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders } })
}

async function readPassword(request: Request): Promise<string | null> {
  const contentLength = Number(request.headers.get("Content-Length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > maximumBodyBytes) return null
  const body = await request.text()
  if (new TextEncoder().encode(body).byteLength > maximumBodyBytes) return null
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    if (Object.keys(parsed).length !== 1 || typeof parsed.password !== "string") return null
    if (parsed.password.length < 1 || parsed.password.length > 1024) return null
    return parsed.password
  } catch {
    return null
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== "POST") return jsonError("method_not_allowed", 405)
  const authorization = request.headers.get("Authorization")
  if (!authorization) return jsonError("unauthenticated", 401)
  const url = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !anonKey || !serviceRoleKey) return jsonError("deletion_failed", 500)
  const password = await readPassword(request)
  if (!password) return jsonError("reauthentication_failed", 401)

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser()
  if (callerError || !caller?.email) return jsonError("unauthenticated", 401)

  const reauthenticationClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: reauthenticated, error: reauthenticationError } = await reauthenticationClient.auth.signInWithPassword({ email: caller.email, password })
  if (reauthenticationError || reauthenticated.user?.id !== caller.id) return jsonError("reauthentication_failed", 401)

  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: deletionError } = await adminClient.auth.admin.deleteUser(caller.id, false)
  if (deletionError) return jsonError("deletion_failed", 500)
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store", ...corsHeaders } })
})
