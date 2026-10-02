import { createClient } from "npm:@supabase/supabase-js@2"
import { projectApiKey } from "../_shared/project-api-keys.ts"
import { getGoldQuote } from "../_shared/gold-provider.ts"
import { ProviderBudgetError } from "../_shared/provider-budget.ts"
import { json, preflightResponse } from "../fx-rates/http.ts"

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return preflightResponse()
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405)
  const authorization = request.headers.get("Authorization")
  if (!authorization) return json({ error: "authentication_required" }, 401)
  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      projectApiKey("publishable"),
      {
        global: { headers: { Authorization: authorization } },
      }
    )
    const {
      data: { user },
    } = await client.auth.getUser()
    if (!user) return json({ error: "authentication_required" }, 401)
    const { symbol } = await request.json()
    if (symbol !== "XAU" && symbol !== "XAG")
      return json({ error: "invalid_metal_symbol" }, 400)
    const quote = await getGoldQuote(client, symbol)
    return json({
      available: true,
      ...quote,
      provider: "gold-api",
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof ProviderBudgetError)
      return json(
        {
          available: false,
          error: error.code,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        error.code === "provider_refresh_rate_limited" ? 429 : 503
      )
    return json({ available: false, error: "metal_provider_unavailable" }, 503)
  }
})
