# Dashboard Tab — Data & Logic Spec (for Mobile Reimplementation)

This document describes the **data model, business logic, and UI/UX flow** of the web app's "Dashboard" tab (`src/features/dashboard/`, rendered at route `/dashboard` via `src/pages/DashboardPage.tsx`), so it can be reimplemented for mobile with behavioral parity.

## 0. Important: two parallel implementations exist — pick one deliberately

The codebase contains **two distinct dashboard designs**, and only one is currently live:

1. **Production dashboard** (what actually renders today at `/dashboard`): just `<NetWorthCard />` + `<AccountsOverviewCard />`. These use their own lightweight hooks (`useNetWorth`, `useAccountsOverview`) that read `financial_accounts` more or less directly (raw `opening_balance`, not ledger-adjusted).
2. **Orphaned "rich" dashboard** — a fully-built but currently unused composite: `DashboardSummary` (Net Worth / Cash / Investments metric grid), `MissingDataCards`, `PerformanceCard`, `PortfolioAllocationCard`, `RecentActivityCard`, `DashboardEmptyState`, driven by a single `useDashboard()` hook / `dashboardService.load()` returning a `DashboardViewModel`. No route or page currently renders these components (confirmed via repo-wide search — only a design-mockup page references similarly-named components with fully separate, hardcoded mock data). This richer design is clearly the more complete product intent (net worth + cash + investment performance + allocation + recent activity + missing-data warnings), but it is not wired up.

**Recommendation**: build the mobile dashboard against the richer `DashboardViewModel` design (§2–§4 below cover it fully), since it's the more complete and clearly-intended experience — but confirm with the product owner first, since it is unused in production today and its strings aren't even localized yet (see §6). Both are documented in full below so the decision is informed either way.

## 1. Data model

### 1.1 Core `DashboardViewModel` (rich dashboard)

```ts
type Decimal = string   // exact-precision decimal string, never a float — see §7

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
  occurredAt: string   // ISO timestamp
}

interface DashboardViewModel {
  baseCurrency: string
  netWorth: NetWorthResult                 // see 1.2
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
    priceSources: Array<{ symbol: string | null; provider: string; priceType: string; fetchedAt: string }>
  }
  allocation: DashboardAllocation[]
  performance: {
    marketValueBase: Decimal | null
    unrealizedGainLossBase: Decimal | null
    unrealizedReturnPercent: Decimal | null
    isHistorical: false                    // hardcoded placeholder; no historical series yet
  }
  activities: DashboardActivity[]
  missingData: {
    priceHoldings: Array<{ holdingId: string; assetId: string; assetName: string; symbol: string | null }>
    exchangeRatePairs: Array<{ sourceCurrencyCode: string; destinationCurrencyCode: string }>
  }
  isEmpty: boolean   // true if zero cash accounts AND zero holdings AND zero transactions
}
```

### 1.2 `NetWorthResult` (rich dashboard)

```ts
interface NetWorthResultBase {
  accountCount: number
  baseCurrency: string
  totalLiabilities: Decimal              // hardcoded "0" — no liability tracking yet
  cashAssets: Decimal
  investmentAssets: Decimal
  investmentHoldingCount: number
  missingPriceHoldings: Array<{ holdingId: string; assetId: string; assetName: string; symbol: string | null }>
  missingCurrencyPairs: Array<{ sourceCurrencyCode: string; destinationCurrencyCode: string }>
  fxRates?: FxRateMetadata[]
}
type NetWorthResult =
  | (NetWorthResultBase & { status: "success" | "empty"; totalAssets: Decimal; netWorth: Decimal })
  | (NetWorthResultBase & { status: "partial"; totalAssets: Decimal; netWorth: Decimal })
```

> ⚠️ **Naming collision**: the *production* `NetWorthCard` uses a completely different, simpler local type also called `NetWorthResult` (see §1.3). They are unrelated — don't conflate them when writing mobile types.

### 1.3 Production `NetWorthResult` (`useNetWorth.ts` — the currently-live, simpler type)

```ts
interface NetWorthResult {
  baseCurrencyCode: string
  total: number             // plain JS float here (not Decimal string) — inconsistent with the rest of the app
  accountCount: number
  skippedTypes: AccountTypeCode[]   // account types excluded from this total, see §3.2
  unavailablePairs: string[]        // "SRC/DST" strings for currencies that couldn't be converted
}
```

### 1.4 Production `AccountsOverviewCard` types (`useAccountsOverview.ts`)

```ts
type AccountTypeCurrencyTotal = { currencyCode: string; total: Decimal }

type AccountTypeOverview = {
  kind: "type"
  accountTypeCode: "cash" | "bank" | "brokerage" | "real_estate" | "business" | "other"
  accountCount: number
  currencyTotals: AccountTypeCurrencyTotal[]
}

type MetalOverview = {
  kind: "metal"
  metalType: "gold" | "silver"
  accountCount: number
  totalValueBase: Decimal | null      // null if base currency unset or live metal price fetch failed
  costBasisBase: Decimal | null       // null if base currency unset or an FX pair for a held currency is unavailable
  baseCurrencyCode: string | null
}

type OverviewCard = AccountTypeOverview | MetalOverview
```
`financial_accounts` rows with `account_type_code === "gold"` are split by their `metal_type` column into two separate cards — one for `gold`, one for `silver` — instead of one combined "gold" card. Each metal card shows only a single **total value converted into the user's onboarding base currency** (`profiles.base_currency_code`): sum of that metal's grams across all its accounts, multiplied by the live price-per-gram in the base currency (`getMetalPricePerGram(symbol, baseCurrencyCode)`, which itself does the USD→base FX conversion). Per-account name/units/cost-per-unit/current-price detail rows (previously shown per metal sub-account) are no longer rendered on the dashboard.

**Increase/decrease indicator**: `costBasisBase` is `Σ(balance_grams × cost_per_unit)` per account (that account's weighted-average purchase cost, from `financial_accounts`, not `metal_purchases` history), grouped by the account's own `currency_code` and converted into the base currency via `convertCurrency` (same live-FX-then-manual-fallback resolution as everywhere else, §2.7) — summed across every account of that metal. When both `totalValueBase` and `costBasisBase` resolve, the card renders a colored trend icon (up/emerald if `totalValueBase > costBasisBase`, down/red if less, a dash if equal) next to the total, with a signed `±return%` computed as `(totalValueBase − costBasisBase) / costBasisBase × 100` (only when `costBasisBase > 0`) and a tooltip stating whether the current value is above or below what the user paid. The icon is omitted entirely if either value is `null` (no base currency, or a live price/FX lookup failed).

Non-metal groups are output in fixed order `["cash","bank","brokerage","real_estate","business","other"]`; a type with zero accounts is omitted entirely. The gold/silver metal cards (present only when at least one account of that metal exists) are inserted into the card list immediately after the `brokerage` slot (or at the front if there's no brokerage card), matching the metal group's old position in the order.

### 1.5 Portfolio valuation model (feeds `investments`/`performance`/`allocation` in the rich dashboard)

```ts
interface HoldingValuationResult {
  holdingId: string; assetId: string; symbol: string | null; assetName: string; assetType: string
  quantity: Decimal; averageCost: Decimal | null
  costBasisNative: Decimal; costBasisCurrency: string
  marketPrice: Decimal | null; marketPriceCurrency: string | null
  marketPriceTimestamp: string | null; marketPriceSource: string | null
  marketPriceType?: "realtime" | "delayed" | "previous_close" | "stale" | "manual" | null
  marketValueNative: Decimal | null
  unrealizedGainLossNative: Decimal | null; unrealizedReturnPercent: Decimal | null
  marketValueBase: Decimal | null; costBasisBase: Decimal | null; unrealizedGainLossBase: Decimal | null
  baseCurrency: string
  missingMarketPrice: boolean
  missingExchangeRate: Array<{ sourceCurrencyCode: string; destinationCurrencyCode: string }>
  stalePrice: boolean | null            // true if price age > 24h
}

interface PortfolioValuationResult {
  baseCurrency: string
  holdings: HoldingValuationResult[]
  totalMarketValueBase: Decimal | null
  totalCostBasisBase: Decimal | null
  totalUnrealizedGainLossBase: Decimal | null
  totalUnrealizedReturnPercent: Decimal | null
  valuedHoldingsCount: number
  missingPriceHoldings: Array<{ holdingId: string; assetId: string; assetName: string; symbol: string | null }>
  missingExchangeRatePairs: Array<{ sourceCurrencyCode: string; destinationCurrencyCode: string }>
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
- Assets are converted to the user's base currency and grouped as Cash & Bank (Cash and Bank Debit ledger-projected current balances), Brokerage (the existing complete Brokerage Current Value), Gold & Silver (live metal value), Real Estate, Business, and Other (their stored current-value semantics). The required Certificates bucket is present but currently has no supported account type and is therefore zero.
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
No polling/interval refresh anywhere. All dashboard data loads once on mount and reloads whenever a **global cross-feature "data changed" event** fires (broadcast elsewhere in the app after any mutation — account edits, transactions, exchange rate changes, etc.). A silent background reload (old data stays visible while refetching) is distinguished from an explicit user-triggered "Try again"/refresh (which shows a loading state). **Mobile needs an equivalent global invalidation mechanism** — e.g. a shared event emitter or query-cache invalidation by a shared key — since there's no `window` object to dispatch a DOM event on.

## 3. UI / UX flow

### 3.1 Production dashboard (currently live)
Page = header (eyebrow/title/description) + `NetWorthCard` + `AccountsOverviewCard`.

**`NetWorthCard`** states, in priority order:
1. Loading — pulsing skeleton.
2. Error — warning icon + message + "Try again".
3. No base currency set — prompt + "Complete onboarding" link.
4. Complete — big base-currency total (`{currency} {amount}`, forced LTR), account count, and a link to Accounts. Incomplete — the total is explicitly unavailable, with a missing-FX or missing-current-value message; no partial total is displayed.

**`AssetsBreakdownCard`** follows Net Worth and uses the same loaded aggregate snapshot. It renders a responsive donut with the exact base-currency Total Assets in its center and an aligned legend list for positive Cash & Bank, Brokerage, Gold & Silver, Real Estate, Business, and Other values (marker, category, amount, percentage). Percentages are converted to numbers only for Recharts geometry; all displayed financial totals remain decimal strings. Percentages use Total Assets only and sum to 100%; zero categories are omitted. Bank Credit available credit is excluded, while Total Liabilities is shown as a separate base-currency line. The entire breakdown is unavailable when the aggregate is incomplete, rather than displaying a partial allocation. Desktop places the chart left of the legend; mobile centers it above the compact legend.

**`DashboardPortfolioAllocationCard`** follows Assets Breakdown. It uses only the positive Brokerage holding rows embedded in the same server snapshot and renders a responsive donut with exact total Brokerage investments in its center plus an aligned category, amount, and percentage list. It does not include Brokerage cash or non-Brokerage wealth, and is unavailable if any positive Brokerage holding could not be valued. The two allocation cards share one desktop two-column row with equal-height cards; mobile stacks them. Within each card, a fixed, non-zero chart box keeps the donut visible and desktop places it left of the legend while mobile centers it above the compact legend.

**`AccountsOverviewCard`** states: loading (3 skeleton tiles) / error / empty ("add an account" prompt) / success (a responsive grid of per-account-type cards, plus separate gold/silver metal cards — see below). Each type card shows an icon, localized type label, and account count, with one row per currency held showing the summed total. **Gold** and **silver** are each rendered as their own card (not part of `typeOrder`, and no longer combined into one "gold" card): title is the metal's localized label, subtitle is the account count, and the body shows a single total-value line — that metal's total grams across all its accounts converted into the user's base currency (or "Current price unavailable" if the base currency isn't set or the live price fetch failed) — next to a trend icon comparing that current value against what the user paid for it (see §1.4's "Increase/decrease indicator"). No other per-account detail (name, units, cost-per-unit, live price-per-unit) is shown on the dashboard for metal accounts anymore. Every card, including the metal cards, is a `<Link>`; clicking a type card goes to `/accounts`, and clicking the gold or silver card goes to `/accounts?type=gold&metal=gold` or `/accounts?type=gold&metal=silver` respectively — the Accounts page reads those query params on mount to pre-filter its list to just that metal type.

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
- **`resolve_historical_exchange_rate(source, destination, requested_at)`** — for historical-rate lookups (not used by current-value dashboard calculations, which resolve *current* rates via a live external FX call with a stored-table fallback).
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
