# Wealth Analysis

## Purpose and status

Wealth Analysis is Tharwati's primary analysis destination. It explains the
user's wealth across supported account classes without becoming a transaction,
account-management, or advice surface.

The top-level destination is **Analysis** in English and **التحليل** in Arabic.
Its page title is **Wealth Analysis** in English and **تحليل الثروة** in Arabic.
Mobile uses the third tab; web exposes the protected `/analysis` destination.

Web and mobile implement the same approved V1 hierarchy: Wealth Health,
Attention Summary, six-class Wealth Allocation, and Target Allocation & Drift,
with an Edit Target flow. Both platforms reuse the Dashboard valuation contract
and the shared target-plan persistence contract. Supporting net wealth is
secondary, the calm no-observation state is compact, and the allocation donut
shows Largest exposure once. Brokerage-specific analysis remains at
`/portfolio`; specialized asset-analysis pages and broader analysis dimensions
are not presented in V1. Account creation and editing, records, Brokerage
trades, and dividends remain in Accounts.

## Product boundary

Wealth Analysis is the cross-asset analysis layer above the existing account
domains. It can summarize and route into specialized analysis for:

- Cash and Bank;
- Brokerage securities;
- Gold and Silver;
- Real Estate;
- Business;
- Credit and liabilities;
- Other supported account classes.

Including an asset class in Wealth Analysis does not merge its domain model
with another class. Each specialized page retains the financial rules,
availability semantics, and source data of its underlying account domain.

Gold and Silver remain outside the Brokerage/securities portfolio architecture.
Real Estate and Business remain valued-account domains. Cash and Bank remain
ledger-backed account domains.

## Navigation contract

### Top-level destination

- Mobile reserves the third top-level tab for **Analysis / التحليل**.
- The destination opens **Wealth Analysis / تحليل الثروة**.
- Web exposes Wealth Analysis at `/analysis` as a top-level destination.
- Portfolio is not a top-level destination under this architecture.
- The web sidebar order is Dashboard, Accounts, Analysis, Goals, then Settings.

### Dashboard entry points

- **Assets Breakdown** opens Wealth Analysis.
- **Portfolio Allocation** opens Portfolio Analysis directly.

The cards remain read-only previews and retain their established calculation
contracts. Navigation must not create a second valuation path or alter the
values shown on Dashboard.

### Specialized analysis pages

Wealth Analysis routes each supported asset class to a separate specialized
analysis page rather than combining incompatible details into one generic
screen:

- Cash/Bank Analysis;
- Portfolio Analysis for Brokerage/securities;
- Gold/Silver Analysis;
- Real Estate Analysis;
- Business Analysis;
- other specialized pages when their domain is supported.

Portfolio Analysis is defined by `docs/portfolio.md`. It is a child analysis
surface even if its platform route remains `/portfolio` for compatibility.

Account and holding detail navigation may leave Analysis and open the existing
Accounts presentation. Mutation controls do not move into Analysis.

## Wealth Analysis V1 launch scope

Web and mobile present these sections in this exact order:

1. **Wealth Health** — a concise qualitative synthesis of the available wealth
   evidence, with Net Worth as secondary context. It has no repeated Cash,
   liability, or valuation KPI tiles.
2. **Attention Summary** — only incomplete or stale valuation conditions that
   genuinely warrant attention. With no such conditions it is a compact calm
   state.
3. **Wealth Allocation** — a responsive donut of the full reliably valued
   six-class wealth universe, with valued total, class/value/percentage legend,
   and one compact Largest exposure observation. Complete-coverage copy appears
   only when the aggregate is complete.
4. **Target Allocation & Drift** — the user's persisted targets, tolerance,
   compact comparison rows/cards, one primary drift observation, and the
   optional combined excluded-target observation. The Edit Target flow is part
   of this section.

The stable target display and editor order is Cash & Bank, Brokerage, Gold &
Silver, Real Estate, Business, then Other. Web uses compact responsive rows;
mobile uses denser native cards and a full-screen editor. Both support
English/Arabic, RTL/LTR-safe financial values, Light/Dark themes, complete,
incomplete, unavailable, empty, loading, error, and retry states.
Arabic labels remain RTL while Web and mobile render financial amounts,
percentages, decimal input, and currency codes LTR with Western `0-9` digits.
The Web target editor normalizes Arabic/Persian decimal input digits at its
presentation boundary without changing decimal validation or calculations.

Wealth Health is qualitative only. It has no numeric score, thresholds, advice,
or inferred judgement about whether an allocation is good or bad. Per-section
and per-asset-class health scores remain explicitly deferred.

### Deferred Key Insights contract

Standalone Key Insights are not presented in Wealth Analysis V1. The retained
domain derivation remains available for a future approved presentation pass.

Key Insights are descriptive, not prescriptive. They state neutral, positive,
or noteworthy facts and never recommend an account, allocation, investment, or
transaction action. The derivation reuses the current aggregate and allocation
evidence and does not create a second valuation path.

- Data-quality issues are prioritized first. Stale, unresolved, incomplete, and
  unavailable states preserve the aggregate's existing semantics. A concise
  complete/current observation is allowed when the evidence supports it.
- A concentration observation appears when one reliably valued asset class is
  at least 50% of valued wealth. It states the class and percentage without a
  risk label or recommendation and does not reuse the Largest Exposure label.
- Breadth reports the count of asset classes with a reliable positive value; it
  does not imply that a larger count is better.
- Liquidity reports the Cash/Bank share of reliably valued wealth without
  classifying that share.
- Positive liabilities are compared with gross reliably valued assets using
  decimal-safe division. A zero or unavailable denominator yields an explicit
  unavailable ratio rather than division or substitution.
- At most four insights are shown. After material data-quality issues, selection
  prioritizes concentration, liabilities, liquidity, then breadth.

### Target Allocation and drift contract

Target Allocation is a user-authored analytical preference, not a Tharwati model
allocation or recommendation. The editor lists the supported Wealth Analysis
classes: Cash/Bank, Brokerage, Gold/Silver, Real Estate, Business, and Other.
Certificates/Deposits are not implemented. Every percentage is a decimal from
0 through 100, zero is allowed, and the complete set must total exactly 100
before it can be saved. The editor shows a live `Total: X% / 100%` value.

Targets persist per user in `public.wealth_allocation_targets`, one row per
supported asset class, with `(user_id, asset_class)` as the primary key. One
plan-wide tolerance persists separately in
`public.wealth_allocation_target_preferences`, keyed by `user_id`; it is not
duplicated across the six target rows. Both tables cascade on Auth-user deletion,
enable RLS, and allow authenticated users to select only their own data. Direct
table writes are not granted. `replace_wealth_allocation_plan(jsonb, numeric)`
derives ownership from `auth.uid()`, reuses the exact target validation, validates
the tolerance, and atomically replaces the targets and upserts the preference.
The earlier target-only RPC remains callable by authenticated clients temporarily
for compatibility with deployed clients. It does not save a tolerance; when its
users have no preference row, application and domain boundaries use the product
default of `0%`. Updated web and mobile clients use the plan RPC. The legacy RPC
must be revoked only by a new forward migration after
those clients are deployed; the tolerance migration does not grant it to `anon`
or `public` and does not add any permission beyond its existing authenticated
`EXECUTE` grant.

The six-class target table and target-validation RPC were introduced by applied
migration `20260913170000_add_wealth_allocation_targets.sql`. Tolerance uses the
new forward-only migration
`20260913183000_add_wealth_allocation_target_tolerance.sql`; application code
does not apply migrations. The six-class constraint is V1. Adding
Certificates/Deposits or another target class requires another forward migration
to extend the stored class constraint and complete-set validation.

Only classes whose saved target is greater than zero participate in Target
Comparison. A zero-target class and its current value are excluded from both the
rows and denominator even when that class has wealth. Wealth Allocation remains
unchanged and continues to show the full reliably valued wealth universe.

For participating classes, where `comparison_base` is the sum of their reliable
current values in the user's primary/base currency, calculations are:

- `current_percentage = current_value / comparison_base * 100`;
- `target_percentage = saved_target_percentage`;
- `gap_percentage = current_percentage - target_percentage`;
- `target_implied_value = comparison_base * target_percentage / 100`;
- `monetary_gap = current_value - target_implied_value`.

The user selects one decimal tolerance from 0% through 100%, with at most six
decimal places, for the whole plan. No judgemental tolerance is supplied by
Tharwati. A missing saved preference and a blank editor input both normalize to
`0%`; non-empty invalid input remains invalid. At `0%`, only an exact current
percentage match is within range; target percentages remain unchanged.

PostgREST may represent PostgreSQL `numeric` percentages as JSON numbers at
runtime. The target repository boundary accepts finite string or number payloads
and converts them to decimal strings before they enter the target domain. Form
values and hook state remain strings; an absent persisted tolerance becomes the
decimal string `"0"`. Domain validation rejects any non-string value that bypasses
the boundary rather than passing it to the shared decimal parser. Precision, range, and exact-100%
validation continue to use decimal-string helpers only.

For each participating class:

- `lower_bound = max(0, target_percentage - tolerance_percentage)`;
- `upper_bound = min(100, target_percentage + tolerance_percentage)`;
- `current_percentage > upper_bound` is **Above target range**;
- `current_percentage < lower_bound` is **Below target range**;
- either inclusive boundary and every value between them is **Within target
  range**.

The primary largest-deviation observation describes its percentage gap relative
to the exact selected target; the row status independently describes whether it
is within, above, or below the selected tolerance range.

All operations use decimal strings and the shared decimal helpers. The signed
percentage gap remains relative to the exact target, never the nearest range
boundary. Current and Target show percentages only. Gap shows the signed
percentage plus signed primary-currency amount and uses `%`, not percentage
points. Monetary gaps keep their full decimal precision internally and round to
whole primary-currency units for display only. On desktop the final Status column
follows Gap. On narrow screens each class reflows without horizontal scrolling
and preserves Current, Target, Gap, then Status as the final item.

Target remains visually neutral. Above-range Current and Gap evidence uses green
directional styling and an upward icon; below-range evidence uses red and a
downward icon; within-range evidence uses explicit Tharwati gold and a check
icon. The primary drift observation and calm within-range observation use neutral
containers, reserving directional color for their icon and key evidence. The
status text and icon remain present so color is never the only cue. These colors
describe direction relative to the user's selected target, not quality, risk, or
advice.

Unavailable prices, values, or FX are never replaced with zero. If the current
aggregate is incomplete, a participating class is unavailable, or the comparison
base is zero, Target Comparison remains unavailable and does not produce current
percentages, implied values, or gaps. A real, reliably valued zero remains
distinct from an unavailable value.

At most one primary drift observation identifies the largest absolute
exact-target gap among participating classes that are outside their selected
ranges. It includes the percentage gap and approximate primary-currency monetary
magnitude. When every participating class is within range, a calm factual state
replaces the deviation observation. It is factual, not prescriptive: no row,
status, or observation recommends rebalancing, buying, selling, or changing a
target. Largest Exposure remains solely in Wealth Allocation.

Zero-target classes never appear as comparison rows, never receive a target
status, and remain excluded from the comparison denominator. If one or more such
classes has a reliable positive current value, one combined supporting insight
names the excluded class or classes. True-zero classes create no insight.
Unavailable valuation is never treated as zero and is never described as holding
value. This supporting context explains why Target Comparison percentages can
differ from the full Wealth Allocation view.

The target domain and persistence contract are UI-independent and mobile-ready.
Portfolio Analysis may later reuse the validation and drift-calculation pattern,
but it must define its own securities universe rather than importing Wealth
Analysis asset-class classifications.

The MVP does not add transaction feeds, investment/trading actions,
recommendations that initiate mutations, forecasting, or mutation controls.

## Current web Portfolio page disposition

The existing `apps/web/src/pages/PortfolioPage.tsx` is the implementation
foundation for Wealth Analysis. Its current sections are classified below by
their product destination. “Modify” means retain the interaction or presentation
pattern while replacing Brokerage-only assumptions with cross-asset wealth
semantics.

| Current section | Classification | Target use | Wealth priority |
| --- | --- | --- | --- |
| `PortfolioExecutiveSkeleton` | Modify for cross-asset wealth use | Wealth Analysis loading shell with stable page geometry. | P0 |
| `PortfolioExecutiveError` and update-warning banner | Modify for cross-asset wealth use | Wealth-level load, stale-update, retry, and preserved-content states. | P0 |
| `PortfolioHeader` and scope control | Modify for cross-asset wealth use | Wealth Analysis header, freshness, completeness, and supported wealth scope. Brokerage account scoping stays in Portfolio Analysis. | P0 |
| `PortfolioValuePerformance` | Modify for cross-asset wealth use | Net wealth remains compact supporting evidence inside Wealth Health rather than a large Dashboard-style hero. | P0 |
| `PortfolioAllocationExplorer` | Modify for cross-asset wealth use | Primary cross-asset allocation donut and legend; specialized entry points remain deferred. | P0 |
| `PortfolioHealth` | Modify for cross-asset wealth use | Becomes qualitative overall **Wealth Health** with no numeric score or Brokerage-specific thresholds. | P0 |
| `PortfolioAnalysisContextBar` | Modify for cross-asset wealth use | Wealth-level analytical context and clear-filter affordance where the retained analysis needs it. | P2 |
| `PortfolioDiversificationAnalysis` | Modify for cross-asset wealth use | Deferred descriptive asset-class spread; it does not create a diversification score. | P1 |
| `PortfolioRiskConcentration` | Modify for cross-asset wealth use | Largest exposure is represented once in Wealth Allocation; advanced risk remains deferred. | P1 |
| `PortfolioAttentionSummary` | Modify for cross-asset wealth use | Read-only incomplete or stale valuation observations only; no mutation or investment CTA. | P0 |
| `PortfolioHoldingsEvidence` | Move to Portfolio Analysis | Brokerage securities holdings, filters, sorting, and holding-detail entry. | — |
| `PortfolioHoldingDetail` | Move to Portfolio Analysis | Brokerage holding evidence/detail. Trading remains in Accounts. | — |
| `PortfolioCustodyBreakdown` | Move to Portfolio Analysis | Brokerage account/custodian and Available Cash context. | — |
| `PortfolioRecommendedActions` | Remove | Investment, trading, dividend, or account-write actions do not belong in analysis pages. Existing actions remain in Accounts. | — |
| `PortfolioActivity` | Remove | Trade, dividend, and transaction history remains inside Brokerage Accounts and holdings. | — |

### Retained Wealth Analysis priority

1. **P0 — V1 analysis center:** qualitative Wealth Health, Attention Summary,
   Wealth Allocation, and Target Allocation & Drift only.
2. **P1 — richer evidence:** source-currency exposure after a suitable aggregate
   contract exists, plus additional cross-asset facts without scoring.
3. **P2 — advanced read-only analysis:** context/filtering and validated
   diversification or concentration/risk drill-down after the core view is
   trustworthy.

No P0–P2 section includes Add Investment, Buy, Sell, Dividend, Reinvest, or
other account mutations. Per-asset-class and per-section health scores are not
part of these priorities and remain deferred.

## Financial and availability rules

- Financial calculations use decimal-safe values and the existing domain
  contracts; native floating point is not used for monetary aggregation.
- Missing prices, FX rates, balances, or valuations are never treated as zero.
- Legitimate zero values remain distinct from unavailable values.
- Partial or incomplete coverage is labelled explicitly and is never presented
  as complete wealth.
- Fresh, stale, unavailable, and error states from the source valuation contract
  are preserved.
- Specialized pages must not silently apply different totals from Dashboard for
  the same source data and scope.

## Activity and mutations

Wealth Analysis has no aggregate activity feed. Portfolio Activity is not part
of Wealth Analysis or Portfolio Analysis. Transaction and activity history
stays in the relevant account domain:

- Cash/Bank records remain in Cash/Bank Accounts;
- Brokerage trade and dividend history remains in Brokerage Accounts and
  holdings;
- metal purchase history remains in Gold/Silver Accounts;
- valuation and disposal history remains in valued Accounts.

Buy, Sell, Dividend, Reinvest, Correct, Reverse, account lifecycle, and other
write actions remain in Accounts. Analysis pages are read-only.

## Mobile architecture

The implementation uses a dedicated analysis feature rather than coupling
Flutter to web components:

- shared analysis models with nullable values, completeness, and freshness;
- a caller-scoped repository over existing authenticated contracts;
- a controller for loading, refresh, scope, and stale-request protection;
- reusable decimal-safe valuation and allocation functions where existing
  contracts do not already provide the result;
- separate presentation pages for Wealth Analysis and each specialized domain;
- catalog-backed English/Arabic copy through `AppLanguageScope`;
- explicit LTR rendering for money, quantities, percentages, dates, symbols,
  currency codes, and identifiers inside RTL layouts;
- responsive widgets using the existing Tharwati Light/Dark design system.

Analysis controllers expose no financial or account mutation methods. The mobile
target controller writes only the user-owned target preference through the shared
atomic plan RPC. Existing Accounts repositories and controllers
remain the owners of account, trade, dividend, record, purchase, valuation, and
disposal writes.

The mobile Analysis tab signals activation when the user returns to it. Its
controller orders overlapping async loads, ignores stale completions, and does
not notify after disposal. A failed background refresh retains the last
successfully loaded analysis with an explicit refresh warning; an initial or
foreground load failure keeps the full honest error state.

Navigation and valuation presentation require no database changes. User-defined
targets use the dedicated RLS-protected table and atomic replacement RPC described
above. Any later server aggregation contract requires a separate approved backend
task.

## Explicitly deferred

- standalone Key Insights, Structure & Exposure, Diversification &
  Concentration, Liquidity, Currency Exposure, detailed Valuation Quality, and
  Explore Your Wealth sections on web and mobile;
- non-Brokerage specialized analysis pages on web and mobile;
- per-section and per-asset-class health scores;
- numeric Wealth Health scoring and recommendation thresholds;
- source-currency exposure until the aggregate provides its required inputs;
- recommendations that initiate investment or account actions;
- forecasting or advice;
- cross-domain diversification and risk drill-down;
- custody analysis;
- cross-portfolio or cross-wealth activity;
- historical performance charts and return series;
- all transaction and account mutation controls.

## Acceptance criteria

- Analysis / التحليل is the mobile top-level label.
- Wealth Analysis / تحليل الثروة is the primary analysis page title.
- Assets Breakdown opens Wealth Analysis.
- Portfolio Allocation opens the separate Portfolio Analysis page.
- Portfolio Analysis contains only Brokerage/securities analysis.
- Brokerage opens Portfolio Analysis; other asset classes remain visible without
  fake navigation until their specialized pages exist.
- Wealth Health is qualitative and evidence-based; numeric, per-section, and
  per-asset-class scores remain deferred.
- Web and mobile render only Wealth Health, Attention Summary, Wealth
  Allocation, and Target Allocation & Drift, in that order.
- Portfolio Activity is absent; history remains inside Accounts.
- Analysis surfaces remain read-only with respect to financial/account data and
  preserve unavailable/stale states.
- Target Allocation may persist the user's descriptive target preference but
  does not mutate accounts, valuations, transactions, or holdings.
- Trading and dividends remain in Brokerage Accounts.
- Add Investment and other account mutation actions remain in Accounts.
- No financial, repository, or backend behavior changes merely to support
  navigation.

## Open architecture decisions

1. **Mobile navigation:** choose nested Navigator routing or the existing root
   Navigator for specialized pages while preserving the Analysis tab state.
2. **Shared valuation ownership:** decide whether Wealth Analysis consumes the
   Dashboard snapshot directly or a neutral shared valuation controller.
3. **Future quantitative health contract:** decide whether a numeric Wealth
   Health score is ever useful and define cross-asset factors and thresholds
   before introducing one.
4. **Specialized-page rollout:** define which non-Portfolio analysis page is
   implemented after the Wealth Analysis shell.
