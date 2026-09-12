# Portfolio Analysis

## Purpose and status

Portfolio Analysis is Tharwati's specialized read-only Brokerage/securities
analysis. It aggregates the authenticated user's Brokerage accounts and
positive open holdings so the user can understand portfolio value, cost,
performance, completeness, and allocation in one place.

`docs/wealth-analysis.md` defines the parent analysis architecture and shared
navigation contract. This document defines only its Brokerage/securities child.

The existing web Portfolio page is available at the protected `/portfolio`
route. Under the Wealth Analysis architecture it is a child analysis page, not
the primary analysis destination. It is implemented in
`apps/web/src/pages/PortfolioPage.tsx` and `apps/web/src/features/portfolio/`.
Flutter Portfolio aggregation and data UI are not implemented yet. The mobile
top-level destination is Analysis / التحليل; Dashboard Portfolio Allocation
opens a separate localized Portfolio Analysis placeholder, and Wealth Analysis
will open the same child page when its data UI is built.

The Mobile Portfolio MVP is read-only. Trading and dividend mutations remain in
the existing Brokerage account and holding detail flows under Accounts.

## Product boundary

The portfolio includes only securities held through accounts whose
`account_type_code` is `brokerage`:

- all active Brokerage accounts when the scope is All accounts;
- one selected active Brokerage account when an account scope is selected;
- positive open holdings only;
- each holding's stored cost basis and current market valuation;
- the selected Brokerage account's ledger-projected Available Cash where an
  account Current Value is shown.

Gold and Silver are not securities holdings and remain in the Accounts metal
architecture. They must not appear in Portfolio totals, allocation, filters, or
holdings.

Cash, Bank, Real Estate, Business, and Other accounts are also outside the
Portfolio. Cash held inside a Brokerage account is relevant only to that
Brokerage account's Current Value; it is not a security holding and does not
contribute to securities allocation, cost basis, or unrealized performance.

## Shared navigation contract

Wealth Analysis is the primary analysis destination. Portfolio Analysis is its
Brokerage/securities-specific child and is not a mobile top-level tab. Web may
keep `/portfolio` as the child page route, but should not present Portfolio as
the primary cross-asset analysis destination.

On web, Dashboard Portfolio Allocation opens `/portfolio`. On mobile, the same
Brokerage-only Dashboard preview opens the separate Portfolio Analysis page.
Wealth Analysis also links to Portfolio Analysis from its Brokerage asset class.
These entry points do not create a separate valuation path: they retain their
existing allocation data and only navigate to the specialized analysis.

Portfolio remains read-only on both platforms. Buy, Sell, Dividend, Reinvest,
Correct, and Reverse actions remain in Brokerage Account and Holding details
under Accounts.

## Relationship to the current web page

The rich composition of the existing web `/portfolio` page becomes the
foundation for Wealth Analysis as defined in `docs/wealth-analysis.md`. It must
not be carried forward wholesale as Brokerage-only Portfolio Analysis.

Portfolio Analysis retains the Brokerage-specific parts of that implementation:

- Brokerage-account scope;
- securities market value, cost basis, unrealized gain/loss, return, and
  valuation coverage;
- securities allocation;
- holdings evidence and holding detail;
- Brokerage custody and Available Cash context.

The executive shell, overall value presentation, overall allocation pattern,
and one overall health presentation are adapted for cross-asset Wealth Analysis.
Per-section and per-asset-class health scores are deferred.

`PortfolioRecommendedActions` does not move to either analysis surface. Add
Investment, Buy, Sell, Dividend, Reinvest, and other write actions remain in
Accounts. `PortfolioActivity` is removed; transaction and activity history
remains in Brokerage Accounts and holdings.

## Mobile MVP

### Portfolio header and scope

The page provides:

- Portfolio Analysis title and concise read-only explanation;
- All Brokerage accounts as the default scope;
- one scope option per eligible Brokerage account;
- immediate reload/recalculation when the scope changes;
- last-updated and stale/unavailable context when supplied by the valuation
  source;
- pull-to-refresh or an equivalent explicit refresh action.

Scope changes affect every value, allocation group, coverage count, and holding
shown on the page. A selected account can navigate to its existing Brokerage
detail page.

### Portfolio summary

The summary shows, in the authenticated profile's base currency:

- total market value of positive holdings;
- total cost basis of those holdings;
- unrealized gain/loss;
- unrealized return percentage when a valid positive cost basis exists;
- valuation coverage as valued holdings out of total holdings;
- a clear Complete, Partial, or Unavailable status.

Unavailable data is never displayed as zero. A legitimate calculated zero is
distinct from an unavailable value.

### Allocation

Allocation is securities-only and is calculated from positive holdings with a
valid market value in the profile base currency. It groups holdings using the
same stable asset-type mapping already used by the Dashboard portfolio
allocation:

- Stocks;
- ETFs;
- Bonds;
- Mutual funds;
- Cryptocurrency;
- Other.

Brokerage Available Cash is excluded from allocation. Gold, Silver, and every
non-Brokerage account type are excluded. If portfolio valuation is incomplete,
the UI must not present a partial allocation as though it described the complete
portfolio. It shows allocation as unavailable/incomplete with the relevant
coverage state.

Allocation percentages use decimal-safe arithmetic. The final displayed group
receives the rounding residual so the complete displayed allocation totals
exactly 100%.

### Holdings grouped by Brokerage account

The page groups positive open holdings by Brokerage account. Each group shows
the account name and currency and can open the existing Brokerage account
detail. Each holding row shows, when available:

- asset name and symbol;
- quantity and canonical unit;
- current price and price currency;
- cost basis;
- current market value in the profile base currency;
- unrealized gain/loss and return;
- stale or unavailable valuation state.

A holding row navigates to the existing Flutter Brokerage holding detail. Portfolio
does not duplicate holding-detail presentation or mutation sheets.

## Financial rules

### Decimal safety

Money, prices, quantities, rates, cost basis, gain/loss, and percentages remain
decimal strings through repository, model, controller, and calculation layers.
Calculations use the shared `D` decimal helpers or equivalent reusable
decimal-safe functions. Native `double` must not calculate or aggregate
financial values; it is allowed only for final visual geometry such as chart
angles after the exact displayed values are established.

### Holding valuation

For each positive holding:

1. Resolve a usable current market price.
2. Calculate native market value as `quantity × current price`.
3. Convert market value and stored cost basis independently into the profile
   base currency using valid current FX data when currencies differ.
4. Calculate unrealized gain/loss as `market value − cost basis` only when both
   values are available in the same currency.
5. Calculate return as `gain/loss ÷ cost basis × 100` only when cost basis is
   positive.

No missing price, FX rate, conversion, or value is substituted with zero.

### Aggregate totals and completeness

The view model carries nullable totals and coverage metadata explicitly. It
distinguishes:

- **Complete**: every in-scope positive holding has the required current price
  and FX conversions.
- **Partial**: at least one holding can be valued, but one or more in-scope
  holdings cannot be fully valued.
- **Unavailable**: holdings exist, but none can be valued sufficiently for the
  requested total.
- **Empty**: there are no positive open holdings in the selected scope.

If the implementation exposes a subtotal for valued holdings in a Partial
state, it must be labelled as partial and accompanied by explicit coverage. It
must never be presented as the complete portfolio total or compared against the
full cost basis to imply performance. An all-or-nothing nullable aggregate is
also valid and matches the current Flutter account-level behavior.

Cost basis is stored data, but its base-currency aggregate is unavailable when
the required FX conversion is unavailable. Unrealized gain/loss and return are
unavailable whenever their comparable market-value or cost-basis inputs are
unavailable.

### Stale and unavailable data

Stale prices remain visibly stale; they are not silently promoted to current.
Unavailable prices, FX rates, or conversions remain unavailable. A transport or
parsing failure produces an error state rather than cached-looking zeroes.

The server snapshot's `fresh`, `stale`, and `unavailable` meanings must be
preserved if the mobile implementation uses that source. If data is loaded
directly instead, the repository/view model must carry equivalent timestamp and
staleness metadata where the provider supplies it.

### Brokerage Current Value

When the Portfolio UI displays a Brokerage account's Current Value, it uses:

`Brokerage Current Value = Available Cash + current market value of positive holdings`

Available Cash comes from the existing ledger-projected Brokerage balance, not
from raw `opening_balance`. Current Value is unavailable when the holdings
market value or a required FX conversion is unavailable. Available Cash must not
be relabelled as invested market value or included in unrealized performance.

## States and behavior

The mobile page implements:

- a first-load skeleton;
- a populated ready state;
- a refreshing/updating state that does not replace valid existing content;
- a no-Brokerage-account state with navigation to Accounts;
- an empty-holdings state for eligible Brokerage accounts;
- Partial and Unavailable valuation states with coverage explanation;
- a load/transport/parse error state;
- Retry and pull-to-refresh behavior;
- protection against a slower previous request overwriting a newer scope or
  refresh result;
- refresh after the shared in-process `DataChange` notification.

An empty portfolio is not an error. An account with Available Cash but no
positive holdings remains an empty securities portfolio; its cash may be shown
as account context but not as invested market value.

## Navigation

The Analysis destination occupies index 2 in `apps/mobile/lib/home_page.dart`
without changing the five-tab order. It opens Wealth Analysis. Portfolio
Analysis is pushed as a separate child page from either Wealth Analysis or the
Dashboard Portfolio Allocation preview; it does not occupy a bottom-navigation
destination.

On web, `/portfolio` remains a valid protected route for Portfolio Analysis.
Dashboard Portfolio Allocation opens that route. Any top-level web analysis
navigation should identify Wealth Analysis as the primary destination rather
than treating Portfolio as the cross-asset analysis page.

- Account group/header → existing Brokerage account detail.
- Holding row → existing Brokerage holding detail for that account and asset.
- Empty no-account action → Accounts tab.

Portfolio supplies no Buy, Sell, Dividend, Reinvest, Correct, or Reverse controls.
Those actions remain reachable only from the existing Accounts Brokerage
surfaces and retain their current behavior.

## Expected Flutter architecture

The implementation should use a dedicated `apps/mobile/lib/portfolio/` feature
with clear read-only boundaries:

- `portfolio_page.dart`: page states, scope control, responsive composition, and
  navigation callbacks;
- `portfolio_controller.dart`: loading/updating state, active scope, stale-request
  protection, refresh, and `DataChange` subscription;
- `portfolio_repository.dart`: authenticated profile base currency, eligible
  Brokerage accounts, positive holdings, ledger-projected Available Cash, live
  prices, and required FX inputs;
- `portfolio_models.dart`: immutable source and view models with decimal strings,
  nullable values, freshness, missing-data details, and completeness;
- `portfolio_valuation.dart`: reusable pure decimal-safe holding and aggregate
  valuation functions;
- `widgets/`: summary, coverage, allocation, account group, holding row,
  skeleton, empty, and error presentation;
- `apps/mobile/lib/i18n/portfolio_copy.dart`: English/Arabic presentation catalog;
- focused repository, valuation, controller, localization, directionality, and
  widget tests.

Existing Brokerage `Asset`, `Holding`, and `MarketPrice` concepts should be
shared or extracted rather than duplicated. Existing account-level and Portfolio
valuation must use one reusable calculation contract so their availability and
decimal rules cannot drift. Mutation methods from `BrokerageRepository` and
`BrokerageController` must not be exposed through the Portfolio controller.

The Dashboard `dashboard-valuation` snapshot may be reused only for fields its
contract actually provides. Its current mobile model supplies per-account
current values and Brokerage allocation rows, but it does not provide the full
per-holding cost-basis, coverage, account grouping, and navigation evidence
required by this MVP. Web React components, hooks, and browser events are not
dependencies of the Flutter implementation.

No schema, RPC, or RLS change is implied by this MVP. Reads continue through the
existing authenticated, user-scoped contracts. A backend aggregation change,
if later chosen, requires an explicit contract and migration/Edge Function task
rather than silently changing this client specification.

## Localization and directionality

All Portfolio presentation copy supports English and Arabic through the existing
`AppLanguageScope` catalog pattern. Arabic renders RTL and English renders LTR.

Money, prices, quantities, percentages, dates/times, asset symbols, currency
codes, exchange identifiers, and account identifiers render explicitly LTR.
Within Arabic captions, only the dynamic numeric or Latin fragment is isolated
LTR; the surrounding sentence remains RTL. Formatting reuses the shared money
and decimal presentation helpers and never changes stored values.

Lower-layer provider/repository errors remain language-neutral or map to stable
presentation states. The repository must not depend on UI locale.

## Responsive and visual behavior

The page uses the existing Tharwati theme, semantic Light/Dark tokens,
typography, spacing, cards, and minimum touch targets. It preserves `SafeArea`
and bottom-navigation spacing.

Phone layouts stack summary, allocation, and account groups vertically. Wider
layouts may place summary/allocation side by side when constraints allow, but
must not require tablet-specific behavior for correctness. Long account names,
symbols, currencies, and unbroken LTR financial strings must wrap or flex
without overflow. Loading and unavailable states should retain the same page
geometry where practical.

## Explicitly excluded and deferred

The Mobile Portfolio MVP does not include:

- portfolio health scoring;
- attention summaries or recommended actions;
- diversification dimension or risk/concentration drill-down;
- custody analysis;
- Buy, Sell, Dividend, Reinvest, Correct, or Reverse actions;
- trading previews, pickers, or confirmations;
- Gold/Silver or other non-Brokerage wealth;
- historical performance charts or return series;
- forecasting, advice, or automated rebalancing.

Portfolio Activity is removed from the target product rather than deferred.
Trade, dividend, and other transaction history remains in Brokerage Accounts
and holding details.

## Acceptance criteria

- Portfolio contains only eligible Brokerage securities and defaults to all
  eligible Brokerage accounts.
- Portfolio Analysis is a child of Wealth Analysis, not a mobile top-level tab.
- Dashboard Portfolio Allocation opens Portfolio Analysis directly.
- Scope changes consistently update summary, coverage, allocation, and holdings.
- Market value, cost basis, unrealized gain/loss, return, and coverage follow the
  rules above using decimal strings.
- Missing price/FX/value inputs never become zero and cannot create misleading
  totals or performance.
- Stale, Partial, Unavailable, Empty, Error, and Retry states are explicit.
- Holdings are grouped by Brokerage account and navigate to existing account and
  holding details.
- There are no trading or dividend controls in Portfolio.
- There is no Portfolio Activity surface; transaction history remains in
  Brokerage Accounts.
- Gold/Silver never appear in Portfolio.
- English/Arabic, RTL/LTR isolation, Light/Dark, SafeArea, and responsive layout
  match the shared mobile architecture.
- No new backend contract is required unless separately approved.

## Open architecture decisions

Before implementation, confirm:

1. **Valuation source:** extend/reuse the server `dashboard-valuation` response
   for portfolio evidence, or load holdings/prices/FX directly on mobile. The
   current snapshot alone is insufficient for the full MVP.
2. **Partial-total presentation:** show an explicitly labelled valued subtotal
   plus coverage, as web does, or keep aggregate market value/performance null
   whenever any holding is unavailable, matching current Flutter Brokerage
   account totals.
3. **Shared valuation extraction:** move the existing Brokerage models and pure
   valuation functions to a neutral shared mobile module, or retain their
   current path while making Portfolio depend on the read-only subset.
4. **Brokerage scopes with cash but no holdings:** the web derives scope options
   from holdings; mobile may instead show every active Brokerage account. The
   MVP product boundary above recommends every eligible account so users can see
   and navigate cash-only Brokerage accounts, but this is a deliberate parity
   decision.
5. **Refresh ownership:** decide whether Portfolio calls the Dashboard snapshot
   independently or shares a process-level cached snapshot/controller. Either
   option must preserve freshness metadata and avoid duplicate conflicting
   valuation rules.
