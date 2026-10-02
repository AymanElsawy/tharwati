import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";

it.skipIf(process.env.METAL_LOCAL_PROBES !== "1")(
  "local authenticated separate Gold/Silver reliability",
  async () => {
    const base = "http://127.0.0.1:58321";
    const status = JSON.parse(
      readFileSync(
        new URL("../../mobile-development.local/status.json", import.meta.url),
        "utf8",
      ).replace(/^\uFEFF/, ""),
    );
    expect(status.API_URL).toBe(base);
    const nativeFetch = globalThis.fetch;
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
        { input: query, encoding: "utf8" },
      );
      if (r.status !== 0) throw new Error("Dedicated metal SQL probe failed");
      return r.stdout.trim();
    }
    async function api(
      path: string,
      body?: unknown,
      token?: string,
      admin = false,
      method?: string,
    ) {
      const response = await nativeFetch(base + path, {
        redirect: "error",
        method: method ?? (body ? "POST" : "GET"),
        headers: {
          apikey: admin ? status.SECRET_KEY : status.PUBLISHABLE_KEY,
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok)
        throw new Error(
          `Local metal probe ${path.split("?")[0]}: HTTP ${response.status}`,
        );
      const raw = await response.text();
      return raw ? JSON.parse(raw) : null;
    }
    const old = "2026-09-01T00:00:00.000Z";
    const exact = "3110.347680000000000001";
    const saved = sql(
      "select jsonb_build_object('quotes',(select coalesce(jsonb_agg(to_jsonb(q)),'[]') from metal_private.spot_quotes q),'capacity',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from provider_private.capacity c where bucket='gold_api'),'global',(select coalesce(jsonb_agg(to_jsonb(b)),'[]') from provider_private.global_budgets b where provider='gold_api')); ",
    );
    let userId: string | undefined,
      token = "",
      calls = 0,
      providerFails = false;
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(
          input instanceof Request ? input.url : String(input),
        );
        if (url.origin === base)
          return nativeFetch(input, { ...init, redirect: "error" });
        if (url.hostname !== "api.gold-api.com")
          throw new Error("Unexpected provider work");
        calls++;
        return providerFails
          ? new Response("sensitive provider error", { status: 503 })
          : new Response(
              `{"price":${url.pathname.endsWith("XAU") ? exact : "31.103476800000000001"},"currency":"USD"}`,
            );
      },
    );
    async function load(kind: "gold-price" | "dashboard-valuation") {
      vi.resetModules();
      let handler!: (r: Request) => Promise<Response>;
      vi.stubGlobal("Deno", {
        env: {
          get: (name: string) =>
            ({
              SUPABASE_URL: base,
              SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({
                default: status.PUBLISHABLE_KEY,
              }),
              SUPABASE_SECRET_KEYS: JSON.stringify({
                default: status.SECRET_KEY,
              }),
            })[name],
        },
        serve: (h: typeof handler) => {
          handler = h;
        },
      });
      if (kind === "gold-price") await import("./gold-price/index.ts");
      else await import("./dashboard-valuation/index.ts");
      return async (body: unknown) => {
        const r = await handler(
          new Request(base, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }),
        );
        return { status: r.status, body: await r.json() };
      };
    }
    try {
      sql(
        "delete from metal_private.spot_quotes; delete from provider_private.global_budgets where provider='gold_api'; select public.configure_provider_capacity('gold_api',10,50,20,100,true);",
      );
      const password = `Local!9${randomUUID()}`,
        email = `metal-${randomUUID()}@example.invalid`;
      const user = await api(
        "/auth/v1/admin/users",
        { email, password, email_confirm: true },
        undefined,
        true,
      );
      userId = user.id;
      token = (
        await api("/auth/v1/token?grant_type=password", { email, password })
      ).access_token;
      await api(
        `/rest/v1/profiles?id=eq.${userId}`,
        { base_currency_code: "USD" },
        token,
        false,
        "PATCH",
      );
      const gold = await load("gold-price");
      expect((await gold({ symbol: "XAU" })).body).toMatchObject({
        available: true,
        price: exact,
        stale: false,
      });
      expect((await gold({ symbol: "XAG" })).body).toMatchObject({
        available: true,
        stale: false,
      });
      expect(calls).toBe(2);
      expect((await gold({ symbol: "XAU" })).body.stale).toBe(false);
      expect(calls).toBe(2);
      // Authenticated persisted transport, without IEEE-754 degradation.
      expect(
        (
          await api(
            "/rest/v1/rpc/read_metal_spot_quote",
            { p_symbol: "XAU" },
            token,
          )
        ).price,
      ).toBe(exact);
      sql(
        `update metal_private.spot_quotes set effective_at='${old}',fetched_at='${old}';`,
      );
      providerFails = true;
      const failed = await gold({ symbol: "XAU" });
      expect(failed.body).toMatchObject({
        available: true,
        price: exact,
        stale: true,
        effectiveAt: "2026-09-01T00:00:00+00:00",
        fetchedAt: "2026-09-01T00:00:00+00:00",
        refreshError: "metal_provider_unavailable",
      });
      const callsAfterFailure = calls;
      sql(`select public.configure_provider_capacity('gold_api',1,1,1,1,true);
      insert into provider_private.global_budgets values('gold_api',date_trunc('minute',clock_timestamp()),1,date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC',1,clock_timestamp())
      on conflict(provider) do update set minute_at=excluded.minute_at,day_at=excluded.day_at,minute_used=1,day_used=1;`);
      expect((await gold({ symbol: "XAU" })).body).toMatchObject({
        price: exact,
        stale: true,
        refreshError: "provider_refresh_rate_limited",
      });
      expect(calls).toBe(callsAfterFailure);
      const accounts: string[] = [];
      for (const [metal, purity, grams] of [
        ["gold", "24k", "2"],
        ["silver", "925", "3"],
      ]) {
        const a = await api(
          "/rest/v1/rpc/create_financial_account_v2",
          {
            p_account_type_code: "gold",
            p_name: `LOCAL ${metal}`,
            p_currency_code: "USD",
            p_opening_balance: "0",
            p_metal_type: metal,
            p_idempotency_key: randomUUID(),
          },
          token,
        );
        accounts.push(a.id);
        await api(
          "/rest/v1/rpc/add_metal_purchase_v2",
          {
            p_account_id: a.id,
            p_purity: purity,
            p_occurred_at: old,
            p_quantity_grams: grams,
            p_cost_per_unit: "5",
            p_funding_mode: "external",
            p_funding_account_id: null,
            p_fees: "0",
            p_idempotency_key: randomUUID(),
          },
          token,
        );
      }
      const dashboard = await load("dashboard-valuation");
      const snapshot = await dashboard({});
      expect(snapshot.status).toBe(200);
      expect(snapshot.body.currentValues[accounts[0]]).toBe("200");
      expect(snapshot.body.currentValues[accounts[1]]).toBe("2.775");
      expect(snapshot.body.freshness).toBe("stale");
      expect(snapshot.body.metalQuotes.XAU.price).toBe(exact);
      // Real served local Edge paths also fall back without provider egress.
      sql(
        "select public.configure_provider_capacity('gold_api',1,1,1,1,false);",
      );
      expect(
        (await api("/functions/v1/gold-price", { symbol: "XAU" }, token)).stale,
      ).toBe(true);
      expect(
        (await api("/functions/v1/dashboard-valuation", {}, token))
          .currentValues,
      ).toEqual(snapshot.body.currentValues);
      sql(
        `delete from metal_private.spot_quotes; delete from public.dashboard_valuation_snapshots where user_id='${userId}';`,
      );
      expect(await gold({ symbol: "XAU" })).toMatchObject({
        status: 503,
        body: { available: false, error: "provider_refresh_paused" },
      });
      const missing = await dashboard({});
      expect(missing.body.currentValues[accounts[0]]).toBeNull();
      expect(missing.body.currentValues[accounts[1]]).toBeNull();
      expect(calls).toBe(callsAfterFailure);
      console.info(
        "PASS metals: local auth, exact persisted decimals/timestamps, fresh budget-free cache, failed/denied refresh fallback, unchanged Gold/Silver purity math, missing values unavailable; no real provider requests",
      );
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      if (userId)
        await api(
          `/auth/v1/admin/users/${userId}`,
          undefined,
          undefined,
          true,
          "DELETE",
        );
      const previous = JSON.parse(saved);
      const literal = (value: unknown) =>
        "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
      sql(`delete from metal_private.spot_quotes; insert into metal_private.spot_quotes select * from jsonb_populate_recordset(null::metal_private.spot_quotes,${literal(previous.quotes)});
      delete from provider_private.capacity where bucket='gold_api'; insert into provider_private.capacity select * from jsonb_populate_recordset(null::provider_private.capacity,${literal(previous.capacity)});
      delete from provider_private.global_budgets where provider='gold_api'; insert into provider_private.global_budgets select * from jsonb_populate_recordset(null::provider_private.global_budgets,${literal(previous.global)});`);
    }
  },
  90000,
);
