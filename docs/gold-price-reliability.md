# Gold/Silver last-known spot reliability

Changed files for this slice:

- Migration / SQL regression: `supabase/migrations/20261002153220_metal_spot_last_known.sql`, `supabase/tests/metal_spot_last_known.sql`.
- Edge: `supabase/functions/_shared/{gold-provider.ts,gold-provider.test.ts,metal-quote.ts,metal-quote.test.ts}`, `supabase/functions/{gold-price/index.ts,dashboard-valuation/index.ts,dashboard-valuation/index.test.ts,metal-reliability.local.test.ts,provider-global.local.test.ts}`.
- Web: `apps/web/src/services/{metalPriceService.ts,metalPriceService.test.ts}`, `apps/web/src/features/accounts/services/metal-purchases.service.ts`, `apps/web/src/features/accounts/pages/{AccountDetailsPage.tsx,MetalPurityDetailsPage.tsx}`, `apps/web/src/features/accounts/components/{MetalPriceFreshness.tsx,MetalPriceFreshness.test.tsx}`, `apps/web/src/i18n/{en,ar}/translations.ts`, `apps/web/src/lib/supabase/types.ts`.
- Mobile: `apps/mobile/lib/accounts/{accounts_service.dart,account_detail_page.dart,metal/metal_purity_detail_page.dart,metal/metal_price_freshness.dart}`, `apps/mobile/lib/dashboard/data/dashboard_snapshot.dart`, `apps/mobile/lib/i18n/accounts_copy.dart`, `apps/mobile/test/metal_price_freshness_test.dart`.
- Documentation: this file, `docs/accounts.md`, `docs/provider-abuse-protection.md`, `docs/database-bootstrap.md`.
- Ignored local helper/guide/runtime state: `mobile-development.local/prepare-metal-manual-smoke.py`, `mobile-development.local/METAL-MANUAL-SMOKE.md`; refreshed only the corresponding Gold runtime files in that workdir.

Gold/Silver remain separate from securities and FX. Dashboard and authenticated
`gold-price` use `_shared/gold-provider.ts`. Web metal detail uses that endpoint
and can recover through authenticated `read_metal_spot_quote` when Edge transport
fails. Mobile derives per-gram price from the Dashboard's exact account value and
existing quantity/purity factors, preserving agreement with the headline.

The old flow fetched on every Dashboard rebuild, without durable spot history.
Web's six-hour memory cache and Dashboard's fifteen-minute per-user snapshot
could temporarily mask failure, but expiration/restart lost reachable valuation.

## Quote contract

Fresh valid stored spot → successful protected live refresh → last-known valid
stored spot marked stale → unavailable. Both effective and fetched timestamps
must be no more than six hours old to be fresh, retaining the existing Web metal
freshness window. There is no market-session calendar or stale maximum age.
Old quotes remain useful but must be disclosed as stale. An expired/failed Web
refresh also retains a previously valid browser quote if database recovery fails.

`metal_private.spot_quotes` contains at most two server-owned rows: XAU/USD and
XAG/USD, prices per troy ounce. It uses positive finite PostgreSQL `numeric`
without scale rounding, provider `gold-api`, `effective_at`, `fetched_at` and
`timestamp_basis`. Invalid/zero/future values are rejected. Monotonic upsert by
effective time then fetched time prevents an older concurrent response replacing
the latest quote. There is no account/user financial data in this shared public
market quote cache. RLS is enabled and clients have no schema/table access.

Only service-role execution can call `store_metal_spot_quote`. Authenticated
read-only RPC execution derives session presence from `auth.uid()` and accepts
only the two metal symbols. API keys and privileged cache writes stay server-side.
No securities identifiers, `market_prices`, or provider-budget tables store spots.

Provider numeric JSON tokens are preserved as decimal strings before Number
rounding; storage, fallback, and Dashboard/Web financial calculations use decimal
strings. The old number-returning convenience wrappers remain for compatibility;
metal account valuation uses the resolved decimal-string API. Existing ounce,
quantity/purity, fees/cost basis, gain/loss, and sold lifecycle formulas are unchanged.

Provider `updatedAt`, when present and valid, is the effective timestamp. Without
it, the observed fetch time is explicitly tagged `timestampBasis: observed`; it
does not claim a supplied provider timestamp. Fallback never resets timestamps
to the response time. Invalid or future provider timestamps cannot overwrite
stored data. Quote payloads carry `symbol`, `currency`, `provider`, `price`,
`effectiveAt`, `fetchedAt`, `timestampBasis`, `stale`, and optional safe
`refreshError`. API responses and UI must not call stale data live.

Web account/purity detail and Mobile metal detail display **Last-known metal spot
price · Stale** with its effective time. Dashboard freshness also carries stale
metal use; snapshot hits cannot extend the quote freshness window. Web stale FX
disclosure is separate from spot-price staleness. Financial semantic colors and
brand Gold/Silver styling remain unchanged.

## Provider protection and recovery

Fresh-cache reads reserve no budget. Only an external refresh attempt reserves
the existing S2 per-user/global `gold_api` budget through caller JWT/auth.uid().
Cache/fallback reads remain free after exhaustion, pause, absent capacity or
reservation-service failure. Provider fetch plus body consumption is bounded to
2.5 seconds; each cache read/write is bounded to 750ms. Already loaded fallback
survives subsequent refresh/database errors. A failed cache write cannot discard
a valid live quote, although that new quote cannot be durable until a write works.

Usable fallback returns 200. Without a usable quote, the existing safe 429/503
codes remain; no provider/database message, fake price or zero is exposed.
Cross-currency valuation still needs usable current FX; historical transaction FX
and transaction cost are never substitutes. A complete Dashboard/DB outage cannot
rebuild a Mobile valuation from spot alone. No quote predating deployment is
invented/backfilled, so the first genuine successful refresh seeds each cache.

## Validation and local manual smoke

New forward migration: `20261002153220_metal_spot_last_known.sql`. Apply remotely
only through the separately reviewed deployment workflow; local validation uses
only TharwatiMobileDevelopment (API 58321, DB 58322). No historical migration/reset.

```powershell
$env:METAL_LOCAL_PROBES = '1'
$env:M1_LOCAL_PROBES = '1'
$env:S2_LOCAL_PROBES = '1'
$env:S2B_LOCAL_PROBES = '1'
npx.cmd vitest run --config scripts/database/market-reliability.vitest.config.ts
Get-Content .\supabase\tests\metal_spot_last_known.sql -Raw |
  docker exec -i supabase_db_TharwatiMobileDevelopment psql -X -U postgres -d postgres --set=ON_ERROR_STOP=1
```

Local probes use disposable confirmed identities and mock provider transports;
they restore original quote/capacity/counter state and test real authenticated
RPC/served Edge reads. SQL fixtures roll back. No production provider secret is
needed. Run serially with no concurrent local app/provider maintenance session.

Ignored reversible Android/Web fixtures and launch commands live in
`mobile-development.local/METAL-MANUAL-SMOKE.md`. These are clearly synthetic,
local-only conditions, never migrations, production seeds or genuine provider data.
