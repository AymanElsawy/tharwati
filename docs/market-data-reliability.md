# Market Data Reliability — M1

## Files in this slice

| Area | Files (relative to repository root) |
| --- | --- |
| Edge handlers | `supabase/functions/market-prices/index.ts`, `fx-rates/index.ts`, `dashboard-valuation/index.ts` under the same functions directory |
| Edge helpers | `supabase/functions/_shared/market-reliability.ts`, `stored-prices.ts`, `stored-fx.ts`, `frankfurter.ts`, `fx-rate.ts` under the same shared directory |
| Edge tests | `supabase/functions/market-reliability.test.ts`, `market-reliability.local.test.ts`, `_shared/fx-rate.test.ts` |
| Test runner / SQL fixture | `scripts/database/market-reliability.vitest.config.ts`, `supabase/tests/market_price_temporal_integrity.sql` |
| Web services | `apps/web/src/services/exchangeRateService.ts`, `market-data/service.ts`, `market-data/stored-fallback.ts` under the same services directory |
| Web valuation | `apps/web/src/features/portfolio-valuation/services/portfolio-valuation.service.ts` |
| Web tests | `apps/web/src/services/exchangeRateService.test.ts`, `exchange-rates/exchange-rate-management.test.ts`, `exchange-rates/exchange-rates.test.ts`, `market-data/stored-fallback.test.ts`, `market-data/market-prices-function.contract.test.ts` under the same services directory; `apps/web/src/features/portfolio-valuation/services/portfolio-valuation.service.test.ts` |
| Mobile sources | `apps/mobile/lib/core/stored_market_data.dart`, `accounts/brokerage/brokerage_models.dart`, `accounts/brokerage/brokerage_repository.dart`, `portfolio/portfolio_models.dart`, `portfolio/portfolio_repository.dart` under the same lib directory |
| Mobile test / dependency declaration | `apps/mobile/test/stored_market_data_test.dart`, `apps/mobile/pubspec.yaml`, `apps/mobile/pubspec.lock` (existing HTTP version, now an explicit development dependency) |
| Documentation | `docs/market-data-reliability.md`, `docs/accounts.md`, `docs/dashboard.md`, `docs/mobile.md` |

The two existing Web exchange-rate test doubles also implement the already-existing
abortable query interface; their production historical-FX code is unchanged.
No migrations, production schema, UI, signing files or hosted resources change.
Existing local-development setup files and unrelated working-tree changes are
outside M1's file set.

## Securities contract

`market-prices` authenticates the caller and loads active accessible assets through
the caller's RLS client. Provider instruments come only from server-loaded,
validated Twelve Data MIC/symbol identifiers. It resolves each accessible asset:

1. Positive provider cache fetched within 15 minutes.
2. Successful current Twelve Data price.
3. Twelve Data previous close.
4. Last-known positive persisted provider price, marked stale.
5. Caller-owned positive manual price, with manual provenance.
6. Explicit `available: false`, `price: null`.

The function retains persisted candidates before attempting identifier/provider
refreshes. Refresh/query/write failures cannot discard those candidates. One
provider group's failure cannot remove successful prices from other groups.
No transaction cost, transaction FX, or zero substitutes for an absent value.

Single-symbol Twelve Data `/price` responses may contain only `price`; the
handler accepts that decimal without requiring `symbol` or issuing a needless
`/quote` fallback. Symbol-keyed batch responses retain their existing handling.
HTTP 429 and documented `status: error`, `code: 429` responses expose only
`provider_refresh_rate_limited` and safe retry seconds. Throttling stops subsequent
provider calls within the request (already in-flight calls can finish), preserves
successful batch prices, and retains fresh/stale/manual or explicit null results.

Requested IDs are deduplicated, with no 50-asset truncation. Accessible assets are
read in batches of 100; provider instruments are grouped by MIC and batched in
affordable groups of at most 50 distinct symbols. Each price/quote call uses one
atomic `reserve_twelve_data_symbols` reservation, which reads protected S2
configuration and remaining user/global minute/day allowance and charges only
the granted count. Outbound calls are sequential; quota denial or provider 429
stops later calls without waiting for a reset. Unrefreshed assets still receive
stored stale/manual prices or explicit unavailable results. The forward migration
`20261009102808_capacity_aware_twelve_data_reservation.sql` must precede deployment
of this handler; missing RPC fails refresh closed and preserves stored fallback.
Provider and own-manual cache candidates are
read independently per asset, at concurrency 12, using positive-price,
matching-currency, non-future-effective-time filters and top-one queries ordered
by fetched time, effective time, then ID. Another asset's history cannot consume
the PostgREST row limit or hide its fallback. Inaccessible/inactive assets remain
outside the returned scope.

## FX contract

Same-currency conversions return identity rate 1 without provider access.
For differing currencies, `fx-rates` loads persisted candidates before refresh:

1. Fresh direct Frankfurter cache (six-hour fetched-time TTL for current FX).
2. Successful Frankfurter refresh.
3. Stored direct Frankfurter rate, marked stale.
4. Stored inverse Frankfurter rate, marked stale.
5. Caller-owned direct manual rate, marked stale.
6. Caller-owned inverse manual rate, marked stale.
7. Explicit unavailable (HTTP 422), without a rate or zero substitute.

Stored rates are selected at/before the requested effective time. Historical-mode
requests retain their existing at/before-date behavior; transaction records and
their FX are untouched. Inversion of stored decimal strings uses BigInt arithmetic
on Edge/Web and decimal arithmetic on Mobile, rounded to 18 places.
When optional source text is absent, the already-selected provider/manual
classification supplies provenance; a positive stored rate is not discarded just
because that optional field is null.

## Failure boundaries and provenance

- Twelve Data fetch **and response-body consumption**: at most 2.5 seconds per
  request, within an eight-second shared identifier/provider refresh budget.
  Identifier reads are bounded by two seconds and the remaining shared budget.
- Frankfurter: at most two attempts of 1.5 seconds each for `fx-rates`. Other
  consumers retain the helper's existing default timeout/retry policy.
- Independent persisted-source reads: two seconds. Best-effort cache writes:
  one second. Authentication and initial asset discovery are separate from the
  provider budget; database/network outages can still prevent data access.
- Web/Mobile securities and current-FX Edge calls: 12 seconds before caller-RLS
  stored recovery. Dashboard internal securities/FX calls: ten/eight seconds,
  then caller-RLS recovery. Successful partial responses also recover missing
  usable securities prices. Recovery preserves authorization and asset currency.

`previous_close` and manual securities prices are conservatively marked stale even
when recently fetched. Their original price types are retained; ordinary expired
provider rows use `priceType: stale`. Effective and fetched timestamps are retained
where available. A previous-close quote's timestamp is the provider's quote
observation time when supplied, otherwise fetch time; M1 does not claim to derive
the previous session's closing instant or introduce a trading-session calendar.
Manual values are usable evidence, not a claim of live provider freshness.
Web Portfolio now honors the returned stale flag and manual/previous-close type,
instead of relying solely on a 24-hour effective-time age check. Mobile models
retain optional fetched timestamps. No product UI is changed.

Persisted market/FX decimals are selected as `::text` and transported as strings.
BigInt inversion avoids new floating-point financial calculations. Provider JSON
that contains numeric values has already passed through JavaScript Number; M1
does not recover lost provider precision or rewrite unrelated legacy conversion
helpers. Dashboard multiplication remains decimal-string/BigInt arithmetic.
Brokerage Current Value remains Available Cash plus current market value of
positive holdings; any missing required price/FX keeps the result unavailable.

## Repeatable local validation

Use the dedicated `TharwatiMobileDevelopment` environment at localhost:58321,
built through the approved [fresh bootstrap](database-bootstrap.md). Preserve the
old local stack. Refresh copied runtime sources with
`./scripts/database/start-local-development.ps1`; use the existing function server
or the documented `-ServeFunctions` launcher. No provider secret is needed below.

From the repository root:

```powershell
npx.cmd vitest run --config scripts/database/market-reliability.vitest.config.ts
$env:M1_LOCAL_PROBES = '1'
npx.cmd vitest run --config scripts/database/market-reliability.vitest.config.ts supabase/functions/market-reliability.local.test.ts
Remove-Item Env:M1_LOCAL_PROBES
Get-Content supabase/tests/market_price_temporal_integrity.sql -Raw | docker exec -i supabase_db_TharwatiMobileDevelopment psql -U postgres -d postgres -X --set=ON_ERROR_STOP=1
Get-Content supabase/tests/exchange_rates_backend.sql -Raw | docker exec -i supabase_db_TharwatiMobileDevelopment psql -U postgres -d postgres -X --set=ON_ERROR_STOP=1
python scripts/database/probe-local-development.py
```

The first suite exercises actual Edge handlers with controlled database/provider
fixtures, including fetch/body hangs, errors, fallback order, authorization,
61 assets, 1,201 history rows, manual/previous-close staleness, identity and inverse
FX. The optional local suite creates a confirmed disposable user, authenticates
against local Auth, inserts isolated synthetic data and verifies the real locally
served securities/identity endpoints. It then runs the actual FX/Dashboard
handlers against local Auth/PostgREST with external providers blocked by the test
transport. Dashboard is checked with both internal market/FX Edge calls returning
503, including an exact cross-currency value using stored manual FX and deliberately
different historical transaction FX. Cleanup runs in `finally`. These synthetic
prices are test fixtures, never production prices or persistent app fallbacks.
The local probe refuses other API URLs and refuses to overwrite an existing
GBP/EGP test pair.

Client coverage includes `apps/mobile/test/stored_market_data_test.dart`, Web
`services/market-data/stored-fallback.test.ts`, current-FX client tests, and existing
Brokerage/Portfolio/Dashboard valuation tests. The temporal SQL test uses
`email_confirmed_at` because current Auth generates `confirmed_at`; no migration
or product schema is changed.

Validated on 2026-10-02: 89 Edge/local tests, 66 affected Web tests, 60 focused
Mobile tests and 17 existing market/FX SQL assertions passed. Authenticated local
application probes passed; Web application TypeScript checking,
`flutter analyze --no-pub` and `git diff --check` passed. No Android UI smoke,
commit, push or hosted Supabase operation was performed.

## Android smoke and remaining boundaries

Follow the Android emulator command in [Mobile local development](mobile.md).
For an explicitly labeled local test security, seed a manual price through the
local Data API (no new Mobile entry UI is introduced) and confirm
Brokerage/Holding details retain value with manual/stale metadata. With a seeded
last-known provider fixture, verify stale provider beats manual; removing usable
sources must show unavailable. Cross-currency testing must also supply a local
manual/provider FX fixture. Check Dashboard retains cash plus positive holdings
and stale freshness. The automated fixtures are cleaned up; they are not retained
as fake live market data for the app.

Live securities refresh and external asset search require a dedicated development
`TWELVE_DATA_API_KEY`, suitable provider entitlement and valid persisted listing
identifiers. Never copy production secrets by default. Frankfurter requires no
key but does require reachable service and a supported pair; absent support uses
stored provider/manual FX, or honest unavailable. A usable stale securities price
alone cannot make cross-currency valuation available when no usable FX exists.
Total database/Auth/API outage cannot be repaired by an online stored fallback.
S2 provider abuse/rate limits, market-session freshness policy, legacy numeric
provider transport and Mobile Portfolio cost-basis completeness remain separate.
Gold/Silver price sourcing, transaction costs/FX, Portfolio design, hosted Supabase
and production provider configuration are unchanged. Android UI smoke remains
manual; M1 backend/client reliability is ready for that smoke.
