# Provider abuse protection — S2-A / S2-B

## Operational configuration

Limits are protected operational settings tied to the active provider plan, not
permanent product rules. Migration `20261002141941_configurable_global_provider_budgets.sql`
creates **no default capacities**. The previously applied S2-A migration remains
unchanged. Configure each provider before permitting production refresh work.
No production quota or commercial plan is selected by this slice.

`provider_private.capacity` is the single contract. Only protected server/admin
operations can call `configure_provider_capacity`; normal clients cannot read or
write configuration or ledgers. Rows have these fields:

| Field | Meaning |
| --- | --- |
| `bucket` | `twelve_data`, `asset_search`, `frankfurter`, or `gold_api` |
| `user_minute`, `user_day` | Positive integer per-authenticated-user capacities |
| `global_minute`, `global_day` | Positive aggregate capacities; null only for `asset_search`, which shares Twelve Data's global budget |
| `enabled` | Protected provider/search circuit breaker; false stops refresh |
| `updated_at` | Server configuration update time |

One unit is a distinct symbol per Twelve Data price/quote attempt, one searched
query, one Frankfurter HTTP attempt (including retry), or one Gold symbol HTTP
attempt. Minute and UTC-day windows are fixed. Opposite sides of a boundary can
use each window's allowance; this is not a rolling-window limiter or in-flight
lease. Provider account capacity can include requests from other applications:
reserve headroom operationally instead of treating these counters as the vendor's
authoritative billing ledger.

From a **protected administrative client**, configure the intended environment
through the service-only RPC (placeholders, never browser/Mobile code):

```typescript
await admin.rpc("configure_provider_capacity", {
  p_bucket: "twelve_data",
  p_user_minute: USER_MINUTE_CAPACITY,
  p_user_day: USER_DAY_CAPACITY,
  p_global_minute: PLAN_MINUTE_CAPACITY,
  p_global_day: PLAN_DAY_CAPACITY,
  p_enabled: true,
})
```

Repeat for Frankfurter/Gold and the asset-search subset (both global arguments
null). SQL owners can make the same protected configuration calls. No app release
or new migration is needed to change capacities. Review units, active subscription
quotas and other consumers, then update the rows; existing consumption is retained.
Lowering capacity can block refresh immediately. Set `enabled=false` to pause a
provider without deleting stored data or resetting counters. Provider keys remain
server-only and are configured independently of capacity.

## Enforcement and original abuse paths

Every handler verifies Auth `getUser()`. Reservations derive identity only from
`auth.uid()`; there is no supplied user-ID/limit argument. SQL derives the provider
from the allowed operation and verifies the compatibility provider argument.
Clients may spend their own budget through the reservation RPC, but cannot reset
or enlarge it, impersonate another user, change configuration, or authorize a
provider call through an unguarded app transport.

`asset-search` previously allowed unlimited unique misses through an uncapped
isolate cache. `market-prices` can fan out across accessible assets/MICs and call
both current-price and previous-close endpoints. Unique FX/date requests and
Frankfurter retries can force external work; the legacy `investment-fx` direct
helper also uses the guard. Dashboard forwards caller JWTs to market/FX and its
Gold helper uses the same caller budget directly.

Before external work, one transaction locks the global provider, then the user,
checks **all** required config/user/global/search buckets and only then charges
all of them. First reservations are checked against projected usage too.
Rejection changes no counter. Different users and sessions share the same global
row. Configuration writes take the provider lock and never reset consumption.
Budgets are durable across Edge instances; failed provider attempts are charged
without client-controlled refunds. Individual reservation lookup is bounded by
750 ms; timeout blocks transport even if the database later completes its charge.

Securities price/quote batching uses authenticated
`reserve_twelve_data_symbols(p_requested_symbols integer)`. It locks Twelve Data
then the caller in the existing S2 order, reads remaining configured user/global
minute/day capacity, and delegates one charge to `reserve_provider_budget` under
those same transaction locks. The response exposes only `grantedSymbolCount` and
safe denial/retry metadata. Private tables/configuration remain inaccessible.
Partial grants size the outbound symbol list; each outbound request reserves once,
including quote fallback. Search retains its existing reservation RPC and shares
the same Twelve Data ledgers and locks. No commercial-plan limits are hardcoded;
50 symbols is the existing technical RPC batch bound. No capacities are seeded.

Forward migration `20261009102808_capacity_aware_twelve_data_reservation.sql`
depends on S2-A/S2-B and must be applied before deploying the updated
`market-prices` handler and its `twelve-data-reservation.ts` helper. It changes no
existing tables or RPCs, and has no dependency on Gold/Silver storage. Missing RPC
or failed reservation retains stored fallback and blocks provider refresh.

Fresh securities/FX caches, stored candidate reads, identity FX, Dashboard
snapshot hits and Web's valid metal cache do not consume external-provider units.
Securities retain M1 chunking for every accessible requested asset, including
large portfolios; budget caps only provider refresh work. Existing deadlines
remain: Twelve Data 2.5 seconds per fetch/body inside the eight-second M1 refresh
deadline, Frankfurter two 1.5-second attempts in `fx-rates`.

Search retains NFKC/case/trim/whitespace normalization, 2–80 character query,
optional country at most 80 characters and ten-result maximum. Its private shared
cache expires after 60 seconds, is capped at 2,048 entries under an insertion
lock, and accepts writes only from the protected server client. These security
retention bounds remain in force; request capacities are configurable.

At most four budget rows exist per user, four capacity rows globally and three
aggregate counters globally. Inactive user rows expire after two days, with
bounded automatic and protected `prune_provider_state()` cleanup. Auth deletion
cascades user rows. The global ledger stays fixed-size; windows reuse its rows.
Existing market/FX evidence is preserved instead of pruning last-known values.

## Gold stays separate

Dashboard and the dedicated authenticated `gold-price` Edge endpoint both use
`_shared/gold-provider.ts`. Only XAU/XAG are supported, each attempt costs one
Gold unit, fetch/body is bounded by 2.5 seconds and only positive finite numeric
USD spot responses are accepted. Web's default transport uses this endpoint
instead of fetching the public provider directly; its six-hour freshness window
and in-flight coalescing remain. Ounce-to-gram/purity/FX arithmetic is unchanged,
with decimal-string metal transport and valuation. Mobile
still derives metal figures from Dashboard snapshots and makes no direct Gold call.

The separate [Gold/Silver reliability contract](gold-price-reliability.md) keeps
one latest valid spot per metal in `metal_private.spot_quotes`. Fresh cached
quotes and last-known fallback reads reserve no Gold budget. Failed/blocked
refresh retains valid stored values explicitly stale; missing live/stored spot
is unavailable. No securities cache, transaction cost/FX or zero is substituted.

## Safe response/fallback contract

Missing any required capacity returns `provider_capacity_unconfigured`; a paused
row returns `provider_refresh_paused`; exhaustion returns
`provider_refresh_rate_limited`; reservation failure returns
`provider_budget_unavailable`. No raw provider/database errors reach clients.

Twelve Data HTTP 429 and documented JSON rate-limit errors use the same safe
`provider_refresh_rate_limited` code. Search returns HTTP 429; securities retain
HTTP 200 with successful prices or stored fallback and refresh metadata. No
subsequent quote fallback starts after throttling is observed in that request.
Valid Retry-After values become bounded retry seconds; missing/invalid values
default to a 60-second retry delay, without exposing provider messages.

Search returns safe unavailable bodies with HTTP 429 for exhausted budget or
503 for unavailable configuration/service. Gold returns HTTP 200 plus truthful
stale/refresh-error metadata when a usable stored quote exists; without a quote,
it retains those safe 429/503 unavailable responses. Securities retain HTTP 200 prices
plus optional `refreshError`/`retryAfterSeconds`. Their fresh → current provider
→ previous close → stale persisted provider → caller manual → unavailable order
is unchanged. FX retains direct/inverse stored provider then manual fallback,
identity 1 and existing historical rules; usable fallback stays HTTP 200, no
usable rate stays HTTP 422. Decimal strings, timestamps and stale provenance are
preserved. No cost basis, transaction FX or zero becomes a current value.

## Dedicated Local Development

Only `TharwatiMobileDevelopment` API localhost:58321 / DB localhost:58322 is used.
New migrations apply through approved fresh baseline/forward bootstrap or an
explicit reviewed local delta. Never historical reset, linked push, migration
repair or remote apply. Runtime copies and bootstrap completion hashes are
refreshed only after the actual forward delta is applied and checked.

Load the explicitly development-only policy:

```powershell
./scripts/database/configure-local-provider-capacity.ps1
```

The script rejects other project identities, linked workdirs, URLs and ports.
`provider-capacity.development.sql` contains small Local Development numbers:
Twelve Data user 60/300, global 120/600; search user 10/30; Frankfurter user 10/50,
global 20/100; Gold user 4/20, global 8/40 (minute/day). **These are fixture values,
not production recommendations.** Fresh production-style schema remains closed
until protected configuration is supplied; provider keys are not required for
deterministic tests.

```powershell
$env:S2_LOCAL_PROBES = '1'
$env:S2B_LOCAL_PROBES = '1'
$env:M1_LOCAL_PROBES = '1'
npx.cmd vitest run --config scripts/database/market-reliability.vitest.config.ts
```

Opt-in local probes temporarily set deterministic test policy and restore the
previous configuration/global counters afterward. Run them as a local maintenance
test with no concurrent manual app session; tests serialize by file. Disposable
users/data are removed. S2-A historical numbers appear only in its regression
fixtures. S2-B tests use capacities of 2/3/4 to prove live upgrades, first-request
checks, cross-user sharing, multi-session enforcement, atomic concurrency, free
cache hits, M1 fallback and independent Gold protection. External transports are
mocked; locally served Edge denial/cache paths are also probed. SQL fixtures in
`provider_request_budgets.sql` and `provider_global_capacity.sql` roll back.

Capacity-aware handler/helper regressions run through the same Vitest config.
Set `TD_CAPACITY_SQL_PROBES=1` and run
`supabase/functions/twelve-data-capacity.local.test.ts` to validate the actual
migrations, authorization, partial/day/window grants, and concurrent reservations.
The runner verifies the dedicated local container/58322 port, creates a disposable
test database, loads existing S2 migrations plus the new forward migration, and
drops that database afterward. Existing development application data/configuration
is untouched. `TD_CAPACITY_DOCKER` may specify the local Docker executable path.

Android smoke should repeat the M1 securities/FX fallback cases and verify Gold
Dashboard/account detail when refresh is blocked. Web should verify authenticated
Gold account/purity detail, valid cache reuse and honest unavailable on failure.

Remaining operational boundaries: these controls do not prevent direct use of the
public third-party Gold API outside Tharwati, protect provider consumers outside
these app paths, or impose a total cheap-request/registration admission limit.
Vendor plan selection, production configuration and rollout remain manual.
