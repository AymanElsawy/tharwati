import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { afterEach, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
it.skipIf(process.env.S2B_LOCAL_PROBES !== "1")(
  "S2-B authenticated operational/global/Gold protection",
  async () => {
    const base = "http://127.0.0.1:58321"
    const status = JSON.parse(
      readFileSync(
        new URL("../../mobile-development.local/status.json", import.meta.url),
        "utf8"
      ).replace(/^\uFEFF/, "")
    )
    expect(status.API_URL).toBe(base)
    const nativeFetch = globalThis.fetch
    const users: { id: string; token: string; secondToken: string }[] = []
    const assetIds: string[] = []
    const fxIds: string[] = []
    function sql(query: string) {
      const r = spawnSync(
        "docker",
        [
          "exec",
          "-i",
          "supabase_db_TharwatiMobileDevelopment",
          "psql",
          "-X",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-At",
          "--set=ON_ERROR_STOP=1",
        ],
        { input: query, encoding: "utf8" }
      )
      if (r.status !== 0) throw new Error("Dedicated S2-B SQL fixture failed")
      return r.stdout.trim()
    }
    async function api(
      path: string,
      body?: unknown,
      token?: string,
      admin = false,
      method?: string
    ) {
      const r = await nativeFetch(base + path, {
        redirect: "error",
        method: method ?? (body ? "POST" : "GET"),
        headers: {
          apikey: admin ? status.SECRET_KEY : status.PUBLISHABLE_KEY,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!r.ok)
        throw new Error(`Local S2-B ${path.split("?")[0]}: ${r.status}`)
      const raw = await r.text()
      return raw ? JSON.parse(raw) : null
    }
    const savedConfig = sql(
      "select coalesce(jsonb_agg(to_jsonb(c)),'[]') from provider_private.capacity c;"
    )
    const savedGlobal = sql(
      "select coalesce(jsonb_agg(to_jsonb(c)),'[]') from provider_private.global_budgets c;"
    )
    function configure(
      bucket: string,
      user: number,
      global: number | null,
      enabled = true
    ) {
      return api(
        "/rest/v1/rpc/configure_provider_capacity",
        {
          p_bucket: bucket,
          p_user_minute: user,
          p_user_day: user,
          p_global_minute: global,
          p_global_day: global,
          p_enabled: enabled,
        },
        undefined,
        true
      )
    }
    function reserve(operation: string, token = users[0].token, units = 1) {
      return api(
        "/rest/v1/rpc/reserve_provider_budget",
        {
          p_provider:
            operation === "fx"
              ? "frankfurter"
              : operation === "metal"
                ? "gold_api"
                : "twelve_data",
          p_operation: operation,
          p_units: units,
        },
        token
      )
    }
    let providerCalls = 0
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const target = new URL(
          input instanceof Request ? input.url : String(input)
        )
        if (target.origin === base)
          return nativeFetch(input, { ...init, redirect: "error" })
        if (
          ![
            "api.gold-api.com",
            "api.twelvedata.com",
            "api.frankfurter.dev",
          ].includes(target.hostname)
        )
          throw new Error("Unexpected external target")
        providerCalls++
        if (target.hostname === "api.gold-api.com")
          return new Response(
            JSON.stringify({ price: 4340.28, currency: "USD" })
          )
        return new Response("intentionally offline", { status: 503 })
      }
    )
    async function load(
      kind: "market-prices" | "fx-rates" | "gold-price" | "dashboard-valuation"
    ) {
      vi.resetModules()
      let handler!: (r: Request) => Promise<Response>
      vi.stubGlobal("Deno", {
        env: {
          get: (name: string) =>
            (
              ({
                SUPABASE_URL: base,
                SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({
                  default: status.PUBLISHABLE_KEY,
                }),
                SUPABASE_SECRET_KEYS: JSON.stringify({
                  default: status.SECRET_KEY,
                }),
                TWELVE_DATA_API_KEY: "LOCAL-MOCK-ONLY",
              }) as Record<string, string>
            )[name],
        },
        serve: (h: typeof handler) => {
          handler = h
        },
      })
      if (kind === "market-prices") await import("./market-prices/index.ts")
      if (kind === "fx-rates") await import("./fx-rates/index.ts")
      if (kind === "gold-price") await import("./gold-price/index.ts")
      if (kind === "dashboard-valuation")
        await import("./dashboard-valuation/index.ts")
      return async (body: unknown, token = users[0].token) => {
        const response = await handler(
          new Request(base, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          })
        )
        return { status: response.status, body: await response.json() }
      }
    }
    const old = new Date(Date.now() - 10 * 86400000).toISOString()
    try {
      sql(
        "delete from provider_private.capacity; delete from provider_private.global_budgets;"
      )
      for (let n = 0; n < 2; n++) {
        const email = `s2b-${randomUUID()}@example.invalid`,
          password = `Local!9${randomUUID()}`
        const user = await api(
          "/auth/v1/admin/users",
          { email, password, email_confirm: true },
          undefined,
          true
        )
        const session = await api("/auth/v1/token?grant_type=password", {
          email,
          password,
        })
        const another = await api("/auth/v1/token?grant_type=password", {
          email,
          password,
        })
        users.push({
          id: user.id,
          token: session.access_token,
          secondToken: another.access_token,
        })
      }
      expect(await reserve("market")).toMatchObject({
        allowed: false,
        code: "provider_capacity_unconfigured",
      })
      await configure("twelve_data", 2, 3)
      expect((await reserve("market", users[0].token, 3)).allowed).toBe(false)
      expect((await reserve("market", users[0].token, 2)).allowed).toBe(true)
      expect((await reserve("market", users[0].secondToken)).allowed).toBe(
        false
      )
      await configure("twelve_data", 4, 3)
      expect((await reserve("market", users[0].secondToken)).allowed).toBe(true)
      expect(await reserve("market", users[1].token)).toMatchObject({
        allowed: false,
        scope: "global",
      })
      await configure("twelve_data", 4, 4)
      expect((await reserve("market", users[1].token)).allowed).toBe(true)
      expect(
        sql(
          "select day_used from provider_private.global_budgets where provider='twelve_data'"
        )
      ).toBe("4")

      await configure("frankfurter", 10, 3)
      const concurrent = await Promise.all(
        Array.from({ length: 12 }, (_, n) => reserve("fx", users[n % 2].token))
      )
      expect(concurrent.filter((r) => r.allowed)).toHaveLength(3)
      expect(
        sql(
          "select day_used from provider_private.global_budgets where provider='frankfurter'"
        )
      ).toBe("3")
      expect(await reserve("fx", users[0].secondToken)).toMatchObject({
        allowed: false,
        scope: "global",
      })

      for (let n = 0; n < 2; n++) {
        const asset = await api(
          "/rest/v1/rpc/resolve_external_brokerage_asset",
          {
            p_symbol: `S2B${n}${randomUUID().slice(0, 4)}`,
            p_name: "S2-B synthetic",
            p_mic_code: "XNAS",
            p_display_exchange: "NASDAQ",
            p_country: "United States",
            p_currency_code: "USD",
            p_instrument_type: "Common Stock",
          },
          users[0].token
        )
        assetIds.push(asset.id)
        await api(
          "/rest/v1/market_prices",
          {
            asset_id: asset.id,
            user_id: n === 0 ? null : users[0].id,
            provider: n === 0 ? "twelve_data" : "manual",
            price: n === 0 ? "123.1234567890" : "7.1234567890",
            currency_code: "USD",
            as_of: old,
            fetched_at: old,
            price_type: n === 0 ? "realtime" : "manual",
          },
          n === 0 ? undefined : users[0].token,
          n === 0
        )
      }
      const market = await load("market-prices")
      const result = await market({ assetIds })
      expect(result.body.prices[0]).toMatchObject({
        price: "123.1234567890",
        stale: true,
      })
      expect(result.body.prices[1]).toMatchObject({
        price: "7.1234567890",
        provider: "manual",
        stale: true,
      })
      expect(providerCalls).toBe(0)
      // Valid cache requires no reservation even after global exhaustion.
      sql(
        `update public.market_prices set fetched_at=now(),as_of=now() where asset_id='${assetIds[0]}';`
      )
      expect(
        (await market({ assetIds: [assetIds[0]] })).body.prices[0].stale
      ).toBe(false)
      expect(providerCalls).toBe(0)
      const fxId = randomUUID()
      fxIds.push(fxId)
      await api(
        "/rest/v1/exchange_rates",
        {
          id: fxId,
          user_id: users[0].id,
          provider: null,
          source: "manual",
          base_currency_code: "GBP",
          quote_currency_code: "EGP",
          rate: "60.123456789012",
          effective_at: old,
        },
        users[0].token
      )
      const fx = await load("fx-rates")
      expect(
        (await fx({ fromCurrencyCode: "GBP", toCurrencyCode: "EGP" })).body
      ).toMatchObject({
        provider: "manual",
        rate: "60.123456789012",
        stale: true,
        refreshError: "provider_refresh_rate_limited",
      })
      sql("delete from provider_private.capacity where bucket='frankfurter';")
      expect(
        (await fx({ fromCurrencyCode: "GBP", toCurrencyCode: "EGP" })).body
      ).toMatchObject({
        provider: "manual",
        refreshError: "provider_capacity_unconfigured",
      })
      await configure("twelve_data", 4, 4, false)
      expect((await market({ assetIds: [assetIds[1]] })).body).toMatchObject({
        refreshError: "provider_refresh_paused",
        prices: [{ price: "7.1234567890", provider: "manual" }],
      })
      expect(providerCalls).toBe(0)

      const gold = await load("gold-price")
      expect(await gold({ symbol: "XAU" })).toMatchObject({
        status: 503,
        body: { error: "provider_capacity_unconfigured", available: false },
      })
      await configure("gold_api", 2, 3)
      expect((await gold({ symbol: "XAU" })).body).toMatchObject({
        available: true,
        price: 4340.28,
        currency: "USD",
      })
      expect((await gold({ symbol: "XAG" }, users[0].secondToken)).status).toBe(
        200
      )
      expect((await gold({ symbol: "XAU" }, users[0].secondToken)).status).toBe(
        429
      )
      expect((await gold({ symbol: "XAG" }, users[1].token)).status).toBe(200)
      expect((await gold({ symbol: "XAU" }, users[1].token)).status).toBe(429)
      expect(providerCalls).toBe(3)
      // The running dedicated Edge endpoint shares the same global ledger.
      const served = await nativeFetch(base + "/functions/v1/gold-price", {
        redirect: "error",
        method: "POST",
        headers: {
          apikey: status.PUBLISHABLE_KEY,
          Authorization: `Bearer ${users[1].token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbol: "XAU" }),
      })
      expect(served.status).toBe(429)
      expect((await gold({ symbol: "XPT" })).status).toBe(400)
      // Exercise Dashboard's separate Gold caller with a real local purchase.
      await api(
        `/rest/v1/profiles?id=eq.${users[0].id}`,
        { base_currency_code: "USD" },
        users[0].token,
        false,
        "PATCH"
      )
      const metalAccount = await api(
        "/rest/v1/rpc/create_financial_account_v2",
        {
          p_account_type_code: "gold",
          p_name: "S2-B local metal",
          p_currency_code: "USD",
          p_metal_type: "gold",
          p_idempotency_key: randomUUID(),
        },
        users[0].token
      )
      await api(
        "/rest/v1/rpc/add_metal_purchase_v2",
        {
          p_account_id: metalAccount.id,
          p_purity: "24k",
          p_occurred_at: old,
          p_quantity_grams: "2",
          p_cost_per_unit: "5",
          p_funding_mode: "external",
          p_funding_account_id: null,
          p_fees: "0",
          p_idempotency_key: randomUUID(),
        },
        users[0].token
      )
      const dashboard = await load("dashboard-valuation")
      const metalSnapshot = await dashboard({})
      expect(metalSnapshot.status).toBe(200)
      expect(metalSnapshot.body.currentValues[metalAccount.id]).toBeNull()
      expect(metalSnapshot.body.freshness).toBe("unavailable")
      expect(providerCalls).toBe(3)
      console.info(
        "PASS S2-B: small configurable limits, upgrade retains accounting, cross-user global cap, 12 concurrent attempts admit 3, second sessions cannot bypass, cache hits free, M1 precise stale/manual and missing/paused fallback, independent Gold cap; zero provider egress"
      )
    } finally {
      for (const id of fxIds)
        await api(
          `/rest/v1/exchange_rates?id=eq.${id}`,
          undefined,
          undefined,
          true,
          "DELETE"
        )
      for (const id of assetIds)
        await api(
          `/rest/v1/market_prices?asset_id=eq.${id}`,
          undefined,
          undefined,
          true,
          "DELETE"
        )
      for (const user of users)
        await api(
          `/auth/v1/admin/users/${user.id}`,
          undefined,
          undefined,
          true,
          "DELETE"
        )
      for (const id of assetIds)
        await api(
          `/rest/v1/assets?id=eq.${id}`,
          undefined,
          undefined,
          true,
          "DELETE"
        )
      sql(
        `delete from provider_private.capacity; insert into provider_private.capacity select * from jsonb_populate_recordset(null::provider_private.capacity,'${savedConfig.replaceAll("'", "''")}'::jsonb); delete from provider_private.global_budgets; insert into provider_private.global_budgets select * from jsonb_populate_recordset(null::provider_private.global_budgets,'${savedGlobal.replaceAll("'", "''")}'::jsonb);`
      )
    }
  },
  90000
)
