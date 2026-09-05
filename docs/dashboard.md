# Dashboard Tab — Data & Logic Spec (for Mobile Reimplementation)

This document describes the **data model, business logic, and UI/UX flow** of the web app's "Dashboard" tab (`src/features/dashboard/`, rendered at route `/dashboard` via `src/pages/DashboardPage.tsx`), so it can be reimplemented for mobile with behavioral parity.

## 0. Important: two parallel implementations exist — pick one deliberately

The codebase contains **two distinct dashboard designs**, and only one is currently live:

1. **Production dashboard** (what actually renders today at `/dashboard`): greeting/date/visual-only notification affordance, `<NetWorthCard />` hero, Assets Breakdown + Key Insights, then Portfolio Allocation + `<DashboardGoalsCard />`. `AccountsOverviewCard` remains implemented but is not rendered here. Valuation surfaces are driven by the shared Dashboard valuation snapshot.
2. **Orphaned "rich" dashboard** — a fully-built but currently unused composite: `DashboardSummary` (Net Worth / Cash / Investments metric grid), `MissingDataCards`, `PerformanceCard`, `PortfolioAllocationCard`, `RecentActivityCard`, `DashboardEmptyState`, driven by a single `useDashboard()` hook / `dashboardService.load()` returning a `DashboardViewModel`. No route or page currently renders these components (confirmed via repo-wide search — only a design-mockup page references similarly-named components with fully separate, hardcoded mock data). This richer design is clearly the more complete product intent (net worth + cash + investment performance + allocation + recent activity + missing-data warnings), but it is not wired up.

**Recommendation**: build the mobile dashboard against the richer `DashboardViewModel` design (§2–§4 below cover it fully), since it's the more complete and clearly-intended experience — but confirm with the product owner first, since it is unused in production today and its strings aren't even localized yet (see §6). Both are documented in full below so the decision is informed either way.

## 1. Data model

### 1.1 Core `DashboardViewModel` (rich dashboard)

```ts
type Decimal = string // exact-precision decimal string, never a float — see §7

type DashboardAllocationGroup = "stocks" | "etfs" | "cash" | "other"

interface DashboardAllocation {
  group: DashboardAllocationGroup
  marketValue: Decimal
  percentage: Decimal
}

interface DashboardActivity {
  id: string
  kind: "transaction" | "exchange_rate"
  type: string
  title: string
  description: string
  occurredAt: string // ISO timestamp
}

interface DashboardViewModel {
  baseCurrency: string
  netWorth: NetWorthResult // see 1.2
  cash: {
    projectedBalanceBase: Decimal
    accountCount: number
    currencyCode: string
    isPartial: boolean
  }
  investments: {
    marketValueBase: Decimal | null
    unrealizedGainLossBase: Decimal | null
    unrealizedReturnPercent: Decimal | null
    holdingsCount: number
    currencyCode: string
    priceSources: Array<{
      symbol: string | null
      provider: string
      priceType: string
      fetchedAt: string
    }>
  }
  allocation: DashboardAllocation[]
  performance: {
    marketValueBase: Decimal | null
    unrealizedGainLossBase: Decimal | null
    unrealizedReturnPercent: Decimal | null
    isHistorical: false // hardcoded placeholder; no historical series yet
  }
  activities: DashboardActivity[]
  missingData: {
    priceHoldings: Array<{
      holdingId: string
      assetId: string
      assetName: string
      symbol: string | null
    }>
    exchangeRatePairs: Array<{
      sourceCurrencyCode: string
      destinationCurrencyCode: string
    }>
  }
  isEmpty: boolean // true if zero cash accounts AND zero holdings AND zero transactions
}
```

### 1.2 `NetWorthResult` (rich dashboard)

```ts
interface NetWorthResultBase {
  accountCount: number
  baseCurrency: string
  totalLiabilities: Decimal // hardcoded "0" — no liability tracking yet
  cashAssets: Decimal
  investmentAssets: Decimal
  investmentHoldingCount: number
  missingPriceHoldings: Array<{
    holdingId: string
    assetId: string
    assetName: string
    symbol: string | null
  }>
  missingCurrencyPairs: Array<{
    sourceCurrencyCode: string
    destinationCurrencyCode: string
  }>
  fxRates?: FxRateMetadata[]
}
type NetWorthResult =
  | (NetWorthResultBase & {
      status: "success" | "empty"
      totalAssets: Decimal
      netWorth: Decimal
    })
  | (NetWorthResultBase & {
      status: "partial"
      totalAssets: Decimal
      netWorth: Decimal
    })
```

> ⚠️ **Naming collision**: the _production_ `NetWorthCard` uses a completely different, simpler local type also called `NetWorthResult` (see §1.3). They are unrelated — don't conflate them when writing mobile types.

### 1.3 Production `NetWorthResult` (`useNetWorth.ts` — the currently-live, simpler type)

```ts
interface NetWorthResult {
  baseCurrencyCode: string
  total: number // plain JS float here (not Decimal string) — inconsistent with the rest of the app
  accountCount: number
  skippedTypes: AccountTypeCode[] // account types excluded from this total, see §3.2
  unavailablePairs: string[] // "SRC/DST" strings for currencies that couldn't be converted
}
```

### 1.4 Production `AccountsOverviewCard` snapshot groups

The live Accounts Overview consumes the same Dashboard valuation snapshot already loaded for Net Worth and allocation; it makes no independent account, market-price, metal-price, or FX request. Active accounts are grouped as Cash, Bank Debit, Brokerage, Gold, Silver, Real Estate, Business, and Other. Each card shows its active account count and one decimal-safe Total Current Value in the profile base currency. Snapshot `currentValues` supply each account's current native value and the snapshot rate map converts it to base currency; any unavailable value or rate makes that whole group unavailable rather than partial.

Bank Credit is excluded from the Bank asset group: Available Credit is never shown as positive wealth and its Amount Due remains represented only by Dashboard liabilities. Gold and Silver use snapshot live per-account valuations. Every card links to the matching Accounts type filter; Gold and Silver retain `/accounts?type=gold&metal=gold|silver` navigation.

### 1.5 Portfolio valuation model (feeds `investments`/`performance`/`allocation` in the rich dashboard)

```ts
interface HoldingValuationResult {
  holdingId: string
  assetId: string
  symbol: string | null
  assetName: string
  assetType: string
  quantity: Decimal
  averageCost: Decimal | null
  costBasisNative: Decimal
  costBasisCurrency: string
  marketPrice: Decimal | null
  marketPriceCurrency: string | null
  marketPriceTimestamp: string | null
  marketPriceSource: string | null
  marketPriceType?:
    "realtime" | "delayed" | "previous_close" | "stale" | "manual" | null
  marketValueNative: Decimal | null
  unrealizedGainLossNative: Decimal | null
  unrealizedReturnPercent: Decimal | null
  marketValueBase: Decimal | null
  costBasisBase: Decimal | null
  unrealizedGainLossBase: Decimal | null
  baseCurrency: string
  missingMarketPrice: boolean
  missingExchangeRate: Array<{
    sourceCurrencyCode: string
    destinationCurrencyCode: string
  }>
  stalePrice: boolean | null // true if price age > 24h
}

interface PortfolioValuationResult {
  baseCurrency: string
  holdings: HoldingValuationResult[]
  totalMarketValueBase: Decimal | null
  totalCostBasisBase: Decimal | null
  totalUnrealizedGainLossBase: Decimal | null
  totalUnrealizedReturnPercent: Decimal | null
  valuedHoldingsCount: number
  missingPriceHoldings: Array<{
    holdingId: string
    assetId: string
    assetName: string
    symbol: string | null
  }>
  missingExchangeRatePairs: Array<{
    sourceCurrencyCode: string
    destinationCurrencyCode: string
  }>
  completenessStatus: "complete" | "partial" | "unavailable"
}
```

## 2. Business logic / calculations

All exact math uses a **bigint-based decimal library** (`add/subtract/multiply/divideDecimals`, `compareDecimals`) — values are transported and computed as decimal strings, never JS floats, in the rich-dashboard code path. (The production `useNetWorth` hook is an exception — see §3.2's float caveat.)

### 2.1 Portfolio valuation

Per holding: fetch current market price → compute native market value (`quantity * price`) → convert cost basis and market value into the base currency (collecting any missing FX pairs) → compute native and base-currency gain/loss and return% (`gain / costBasis * 100`, only if costBasis > 0) → flag `stalePrice` if the price is more than 24h old.

Portfolio totals: sum market value / cost basis / gain-loss only over holdings that successfully resolved (nulls excluded from sums, not treated as zero). `totalUnrealizedReturnPercent = totalGainLoss / valuedCostBasis * 100` (only if valued cost basis > 0). `completenessStatus`: `"complete"` if nothing missing; `"partial"` if some data missing but ≥1 holding valued; `"unavailable"` if missing data and zero holdings valued.

### 2.2 Net worth aggregation (live shared aggregate)

- The live `NetWorthCard` uses `calculateDashboardAggregate`, with decimal strings end-to-end and the existing current-value services rather than raw account opening balances.
- Assets are converted to the user's base currency and grouped as Cash & Bank (Cash and Bank Debit ledger-projected current balances), Brokerage (the existing complete Brokerage Current Value), Gold & Silver (live metal value), Real Estate and Business (latest effective full manual valuation multiplied by server-derived remaining ownership), and Other (stored current-value semantics). Real Estate/Business ownership derives from immutable effective disposal events rather than the account's editable current projection; fully sold accounts are inactive and excluded. Missing valuation or ownership baseline makes the aggregate unavailable rather than using legacy `opening_balance`. The required Certificates bucket is present but currently has no supported account type and is therefore zero.
- Bank Credit is never an asset: `amount_due = credit_card_limit - get_account_balances.current_balance`; it is converted through the current FX service and summed as liabilities. `netWorth = totalAssets - totalLiabilities`.
- Any missing current value, missing/invalid Bank Credit limit or ledger balance, or unavailable FX rate makes the aggregate `incomplete`; totals and Net Worth are unavailable rather than treating a source as zero.
- The live Dashboard page loads this aggregate once and passes the same snapshot to Net Worth, Assets Breakdown, and Portfolio Allocation; none of those cards performs its own valuation, FX lookup, or aggregation.
- Market-dependent account values and FX rates come from the authenticated `dashboard-valuation` server snapshot. A per-user/base-currency persisted snapshot is reused for 15 minutes and returns one `asOf`, expiry, and `fresh`/`stale`/`unavailable` freshness state. It batches Brokerage assets through the persisted `market_prices` flow, resolves FX through the existing provider cache with the existing user-rate fallback, and resolves Gold/Silver once per metal symbol. Dashboard totals therefore do not use browser-local FX or metal caches.
- A central database invalidation helper deletes only the affected user's snapshots after posted financial transactions, holdings, metal purchases, financial-account changes, valuation-relevant asset changes, and user-owned manual market-price changes. Its triggers are row-level and use table-specific transaction-status handling, so non-transaction rows never access transaction-only fields. The next Dashboard request builds a fresh snapshot; unchanged data keeps the 15-minute TTL.

### 2.3 Portfolio allocation grouping

The live Portfolio Allocation card is Brokerage-investments-only. The Dashboard snapshot returns one base-currency row per positive Brokerage holding (`assetId`, `assetTypeCode`, `marketValueBaseCurrency`) from the same market-price and FX pass used for Brokerage Current Value. The UI aggregates those rows as `stock` → Stocks, `etf` → ETFs, `bond` → Bonds, `mutual_fund` → Mutual Funds, `cryptocurrency` → Cryptocurrency, and every other supported asset type → Other. Brokerage cash, Cash/Bank accounts, Gold/Silver, Real Estate, Business, and liabilities are excluded. Percentages use positive holding market value only; the final group receives the decimal residual to make the total exactly 100. If any positive holding lacks a current price, valid asset type, or required FX conversion, the entire allocation is unavailable rather than partial.

### 2.4 Recent activity feed

Up to 8 most recent **posted** transactions, each mapped to an activity with a title derived from transaction type (`buy`→"Investment purchased", `deposit`→"Deposit posted", `withdrawal`→"Withdrawal posted", `fee`→"Fee posted", else falls back to the transaction's own description) — plus one synthetic "Investment fee" activity per transaction entry whose memo is `"investment_fee"` — plus up to 3 most recent exchange-rate updates ("Exchange rate updated", described as `"{base}/{quote}"`). All merged, sorted descending by `occurredAt`, then truncated to the first 8 (so a synthetic fee/rate entry can push out an older transaction activity even though the transaction fetch itself was already capped at 8).

### 2.5 Missing-data / empty-state determination

`isEmpty = (cash accounts = 0) AND (holdings = 0) AND (transactions = 0)` — should drive a dedicated empty-state screen (see §5.2) instead of the normal dashboard.

Missing exchange-rate pairs are split into:

- **Auto-retryable** — pairs supported by the live FX provider (Frankfurter) → shown with a "temporarily unavailable" message + a Retry action that re-triggers the dashboard load.
- **Unsupported** — pairs the provider can't supply at all → informational only, no retry (implies the user needs to enter a manual rate elsewhere in the app).

The missing-data card section should render nothing at all if there are zero missing price holdings AND zero missing FX pairs.

### 2.6 Gold/silver live pricing (used by `AccountsOverviewCard`, both dashboard variants)

- Metal symbol: gold → `XAU`, silver → `XAG`. Fetches USD price per troy ounce from an external metals-price API, converts to USD-per-gram (÷ 31.1034768), then converts to the account's currency via the FX service if not already USD.
- Cached in-memory for 6 hours, with in-flight request de-duplication per symbol.
- Returns `null` (never throws) on any failure — UI must show "Current price unavailable" rather than erroring.

### 2.7 Exchange rate resolution

Live rate is fetched first from an external FX provider (6h in-memory cache, request de-duplication per currency pair; identity rate `1` if source = destination). If the live fetch fails, falls back to the most recent **manually-entered** rate stored in the app's own exchange-rates table (checking both the direct and inverted direction). If neither is available, the conversion fails with a "rate unavailable" error, which calling code (net worth / portfolio valuation) catches and folds into `missingCurrencyPairs`/`missingExchangeRatePairs` rather than failing the whole dashboard load.

### 2.8 Production net worth calculation

The live card no longer uses the legacy float `useNetWorth` calculation. It consumes the shared aggregate in §2.2, remains unavailable until a base currency is set, and reloads on the existing global data-change event. The older rich dashboard remains unused; Portfolio Allocation and its other cards are not part of this live valuation change.

### 2.9 Refresh behavior

No polling/interval refresh anywhere. Each Dashboard load starts the profile read, account read, and unchanged Dashboard snapshot request concurrently; it aggregates only when all required inputs are available. The initial load runs once per mounted Dashboard instance, including React StrictMode's development effect replay. A single-flight coordinator prevents overlapping loads: data-change events arriving during a load coalesce into exactly one subsequent silent refresh, while an explicit user-triggered "Try again"/refresh retains its loading state. Existing unavailable/error behavior and the server snapshot contract remain unchanged. In development builds, browser Performance entries named `tharwati:dashboard:<load-id>:<stage>` measure profile, accounts, Edge snapshot transport, parsing/aggregation, and total ready time without recording financial or user data. All dashboard data loads once on mount and reloads whenever a **global cross-feature "data changed" event** fires (broadcast elsewhere in the app after any mutation — account edits, transactions, exchange rate changes, etc.). **Mobile needs an equivalent global invalidation mechanism** — e.g. a shared event emitter or query-cache invalidation by a shared key — since there's no `window` object to dispatch a DOM event on.

The `dashboard-valuation` Edge Function has opt-in aggregate timing logs when its `DASHBOARD_VALUATION_TIMING_LOGS` environment variable is exactly `true`. Each safe log contains `snapshotMode` (`hit`, `rebuild`, or `error`), `coldStartObserved` (the first request handled by that Edge isolate), total milliseconds, stage milliseconds, and only account/unique-FX-pair/metal-symbol counts. It never logs user identifiers, account names, symbols, currencies, financial values, or response payloads. A persisted snapshot hit reports only auth/profile/snapshot-lookup timing; a rebuild additionally reports the account/RPC/provider/persistence stages. After the accounts read, the independent balance, valuation, ownership, holdings, and metal-purchase reads run concurrently and preserve their original error-check order. Market-price and metal-symbol requests then run concurrently; the two metal symbols are capped at two concurrent requests. Rebuilds pre-resolve their existing required FX pairs with a maximum of three concurrent requests, preserving the same per-pair provider/fallback/cache result before the existing decimal-safe valuation pass. `fx_calls` and `metal_price_calls` are wall-clock durations of their complete bounded batches; `fx_request_sum` and `metal_price_request_sum` are separately-labelled sums of individual request durations and can exceed wall time when requests overlap.

## 3. UI / UX flow

### 3.1 Production dashboard (currently live)

Page = supplied mountain asset (`src/assets/dashboard-mountain.png`) as a compact responsive top background with theme-aware readability overlays. Personalized greeting (`Good afternoon, {firstName} 👋` / Arabic equivalent), `Your wealth at a glance` / `ثروتك في لمحة`, localized calendar date, visual-only notification bell, and compact avatar access live inside that mountain masthead. Desktop has no top bar; mobile retains its hamburger/logo/avatar bar. Net Worth follows closely enough to remain fully or almost fully visible in initial desktop viewport. Then Assets Breakdown and Key Insights; then Brokerage-only Portfolio Allocation and `DashboardGoalsCard`. Light/Colorful overlays retain mountain contrast instead of washing it out. On mobile, Total Assets occupies full metric-row width; Total Liabilities and Accounts sit beneath it, maintaining unbroken currency values without horizontal overflow. Dashboard monetary and percentage strings use stable English digits and currency-code spacing in an explicit LTR container even when Arabic labels remain RTL. Assets Breakdown/Key Insights share a desktop row. Portfolio Allocation/Goals share a 60/40 desktop row. Both stack on narrower screens. Goals stack their data groups until the layout has enough width for three columns, preventing narrow vertical text. `AccountsOverviewCard` remains available to the Accounts feature but is not rendered on Dashboard. Below 640 px, main-section gap is 2 rem; at `sm` and above it retains shared section spacing.

**Net Worth hero** states, in priority order:

1. Loading — pulsing skeleton.
2. Error — warning icon + message + "Try again".
3. No base currency set — prompt + "Complete onboarding" link.
4. Complete — prominent semibold base-currency total (`{currency} {amount}`, forced LTR), exact Total Assets, Total Liabilities, and account count. Its existing eased 500 ms count-up runs once when a valid total first loads, does not replay on silent refreshes or re-renders, and immediately shows the final value for reduced-motion users. Incomplete — financial totals are explicitly unavailable, with a missing-FX or missing-current-value message; no partial total is displayed.

**Assets Breakdown** uses the same loaded aggregate snapshot. It renders a responsive donut with the exact base-currency Total Assets in its center and an aligned legend list for positive Cash & Bank, Brokerage, Gold & Silver, Real Estate, Business, and Other values (marker, category, amount, percentage). Percentages are converted to numbers only for Recharts geometry; all displayed financial totals remain decimal strings. Percentages use Total Assets only and sum to 100%; zero categories are omitted. Bank Credit available credit is excluded, while Total Liabilities is shown as a separate base-currency line. The entire breakdown is unavailable when the aggregate is incomplete, rather than displaying a partial allocation.

**Key Insights** is a localized, deterministic Dashboard-data quality surface. It only reports aggregate incompleteness, stale snapshot freshness, no accounts, or that Dashboard values are available; it creates no performance, allocation, notifications, or other inferred financial claims.

**`DashboardPortfolioAllocationCard`** shares a row with Goals when space permits. It uses only the positive Brokerage holding rows embedded in the same server snapshot and renders a responsive donut with exact total Brokerage investments in its center plus an aligned category, amount, and percentage list. It does not include Brokerage cash or non-Brokerage wealth, and is unavailable if any positive Brokerage holding could not be valued. Within the card, a fixed, non-zero chart box keeps the donut visible and desktop places it left of the legend while mobile centers it above the compact legend. Each mobile legend item keeps marker and category at logical start, with a breakable localized monetary amount at logical end and a bold percentage directly beneath that amount.

**`AccountsOverviewCard`** states: loading (3 skeleton tiles) / error / empty ("add an account" prompt) / success (a responsive grid). Every card shows its type, active account count, and one base-currency Total Current Value from the shared snapshot; unavailable groups show an explicit unavailable state. Every card links to its matching `/accounts?type=…` filter, while Gold and Silver retain their metal-specific filters.

**`DashboardGoalsCard`** is a separate full-width card after Wealth Overview and before Accounts Overview; it does not participate in the Dashboard valuation aggregate. It loads at most three active, unarchived goals, ordered by target date ascending with undated goals last and oldest creation time as the tie-breaker; this naturally places overdue dates before future dates. A count-only user-scoped query distinguishes a user with no goals from one with only completed, cancelled, or archived goals. Progress entries are fetched only for displayed goal IDs and summarized through shared decimal-safe Goals domain logic.

Each row uses a compact responsive grid: desktop shows goal name and due/overdue date, funded/target and surplus, then percentage and a short progress bar. Small screens stack those groups without horizontal scrolling; a missing target date leaves no placeholder space. Mobile also reduces header-to-content spacing while retaining the 44 px View all target. Currencies are never converted or aggregated. The card states that tracking is manual and money is not reserved. Loading uses three compact skeleton rows; failures remain isolated to this card with Retry; invalid stored decimals are unavailable rather than zero. Empty users receive a Create your first goal link, while users with only non-active goals receive a View all goals link. All navigation targets `/goals`; layout retains at least 44 px action targets.

### 3.2 Rich dashboard (unused in production, but the more complete design)

Intended composition, top to bottom:

1. **`DashboardEmptyState`** — renders instead of everything else when `isEmpty` is true: heading, description, two CTAs ("Add cash account", "View investments").
2. **`DashboardSummary`** — 3-card metric row: Net Worth, Cash, Investments (the Investments card also shows signed gain/loss + return%, plus a list of price-provenance lines like `"{symbol}: {provider} · {priceType} · {fetchedAt}"`).
3. **`MissingDataCards`** — an "Action required" banner section (hidden entirely if nothing is missing); up to 3 cards: missing market prices (link to a market-prices screen), auto-retryable FX pairs (with Retry), unsupported FX pairs (informational only).
4. **`PerformanceCard`** — market value / unrealized gain-loss / unrealized return% surface; explicitly notes no historical time-series is available yet (a placeholder for future charting — worth designing with a chart slot in mind for mobile even if not populated initially).
5. **`PortfolioAllocationCard`** — per-group (stocks/ETFs/cash/other) rows with percentage + a horizontal progress-bar fill; empty-state text if allocation is empty.
6. **`RecentActivityCard`** — ordered list of activities (title, description, localized date); empty-state "No posted activity yet."
7. **`AccountsOverviewCard`** — same component/behavior as the production dashboard (§3.1).

### 3.3 Number/currency formatting conventions (apply throughout, both variants)

- Money formatted with exactly 2 decimal places; percentages with up to 2 decimal places (no forced minimum).
- **All numeric/currency/date text is forced left-to-right**, even inside an RTL (Arabic) page layout — this is deliberate and must be replicated on mobile regardless of the app's overall text direction.
- Dates: medium date + short time style for price provenance; localized date-only for activity timestamps.
- Signed values (gain/loss): prefix `+` unless already negative; render "Unavailable" for `null`.

## 4. API / data layer

The live Dashboard aggregate consumes an authenticated `dashboard-valuation` Edge Function snapshot. Its `dashboard_valuation_snapshots` table stores one unexpired snapshot per user and supported base currency (`USD`, `SAR`, `EGP`, `EUR`, or `GBP`), and `store_dashboard_valuation_snapshot(...)` atomically preserves the first valid snapshot in the 15-minute window. The final base-currency grouping and liability arithmetic remains in the shared decimal-safe TypeScript aggregate.

When the Edge Function cannot build or persist a snapshot, its 500 response contains only a fixed diagnostic `reason` stage code (including account-value construction, FX conversion, snapshot persistence, or response serialization); it never returns provider, database, account, or secret details.

Raw Brokerage holding quantities and effective metal-purchase gram quantities are normalized to decimal strings at the Edge boundary before valuation, so PostgreSQL numeric JSON representation does not affect decimal-safe valuation.

- **`get_account_balances(p_account_ids?)`** — ledger-adjusted balance read model: `current_balance = opening_balance + Σ(posted debit − posted credit account-side entries)`, excluding asset-side entries and draft/void transactions. Used by the rich net-worth path (not by the production `useNetWorth`, which reads raw `opening_balance` directly).
- **`resolve_historical_exchange_rate(source, destination, requested_at)`** — for historical-rate lookups (not used by current-value dashboard calculations, which resolve _current_ rates via a live external FX call with a stored-table fallback).
- Plain table reads: `financial_accounts` (accounts), `holdings` (open positions, `quantity > 0` only, with joined asset + account details), `financial_transactions` + `transaction_entries` (recent activity), `exchange_rates` (manual-rate fallback), `profiles.base_currency_code` (throws a "not found"/onboarding-incomplete error if unset).
- External integrations (not Supabase): a live FX rate API (6h cache) and a live metals-price API (6h cache) — see §2.6/§2.7.

**Implication for mobile**: achieving parity means either (a) porting the client-side `NetWorthService` / `PortfolioValuationService` / decimal-arithmetic logic to the mobile app as well, or (b) — the better long-term option — requesting a proper server-side aggregation endpoint/RPC so both platforms share one source of truth. Flag this as a decision point rather than silently choosing one.

## 5. i18n / RTL

- Production components (`NetWorthCard`, `AccountsOverviewCard`) are fully localized via `t("dashboard.*")` / `t("pages.dashboard.*")` keys, present in both `en` and `ar` translation dictionaries.
- **Gap**: the rich-dashboard components (`DashboardSummary`, `PerformanceCard`, `PortfolioAllocationCard`, `RecentActivityCard`, `DashboardEmptyState`) currently use **hardcoded English strings**, not translation keys — if mobile builds against the rich design, new i18n keys need to be added to both dictionaries (they don't exist yet); don't assume they're already there.
- RTL: numeric/currency/date values are always rendered left-to-right regardless of page direction (see §3.3) — the one hard rule to carry over into the mobile layout system (e.g. explicit LTR writing-direction override, not a blanket RTL flip of numeric strings).

## 6. Summary of decisions to make before/while building the mobile version

1. **Which dashboard design to build**: the simple, currently-live one (§3.1), or the richer, more complete but unused one (§3.2)? Recommended: the rich one, pending product sign-off — it's clearly the intended experience.
2. **Net worth semantics**: replicate the production `useNetWorth`'s narrower/simpler behavior (only cash/bank/real_estate, raw opening balances, float math) for strict parity, or use the more correct rich-dashboard semantics (all account types incl. brokerage/gold, decimal-safe math)? These produce genuinely different totals for the same data.
3. **New i18n keys** are needed if building the rich design (§5).
4. **All monetary/quantity data must be handled as decimal strings**, not floats, throughout the mobile app's calculations and network payloads — port the bigint-decimal arithmetic approach (or an equivalent library) rather than relying on native numbers.
5. **A global data-invalidation mechanism** is needed to replace the web's DOM-event-based cross-feature refresh signal (§2.9).
