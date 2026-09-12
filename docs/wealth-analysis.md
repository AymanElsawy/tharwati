# Wealth Analysis

## Purpose and status

Wealth Analysis is Tharwati's primary analysis destination. It explains the
user's wealth across supported account classes without becoming a transaction,
account-management, or advice surface.

The top-level destination is **Analysis** in English and **التحليل** in Arabic.
Its page title is **Wealth Analysis** in English and **تحليل الثروة** in Arabic.
Mobile uses the third tab; web exposes the protected `/analysis` destination.

The read-only navigation shell is implemented: the mobile Analysis tab opens a
localized Wealth Analysis placeholder, and web exposes a localized `/analysis`
placeholder. The existing rich web `/portfolio` page is the presentation and
interaction foundation for Wealth Analysis, but its Brokerage-specific evidence
belongs in Portfolio Analysis and its activity/action surfaces do not carry
forward. Aggregate and specialized analysis data UI remain deferred. Account
creation and editing, records, Brokerage trades, and dividends remain in
Accounts.

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

## Wealth Analysis scope

The first Wealth Analysis implementation should provide:

- an aggregate wealth summary using the existing Dashboard valuation contract;
- asset breakdown by supported account class;
- explicit complete, incomplete, unavailable, empty, loading, error, and retry
  states;
- navigation from each asset class to its specialized analysis page;
- navigation to existing Accounts details where deeper management is required;
- one overall Wealth Health assessment across the supported wealth scope;
- English/Arabic localization, RTL/LTR safety, Light/Dark theming, SafeArea, and
  responsive presentation consistent with the mobile application.

Per-section health scores are explicitly deferred. Asset-class cards may expose
facts, completeness, and navigation, but must not present independent health
scores in the current scope.

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
| `PortfolioValuePerformance` | Modify for cross-asset wealth use | Overall wealth value and supported performance/completeness summary; unavailable inputs remain explicit. | P0 |
| `PortfolioAllocationExplorer` | Modify for cross-asset wealth use | Primary cross-asset allocation/breakdown and entry point to specialized analysis pages. | P0 |
| `PortfolioHealth` | Keep in Wealth Analysis | Becomes the single overall **Wealth Health** assessment. Brokerage-only factors must be generalized or omitted. | P1 |
| `PortfolioAnalysisContextBar` | Modify for cross-asset wealth use | Wealth-level analytical context and clear-filter affordance where the retained analysis needs it. | P2 |
| `PortfolioDiversificationAnalysis` | Modify for cross-asset wealth use | Later cross-asset diversification analysis. It does not create per-section health scores. | P2 |
| `PortfolioRiskConcentration` | Modify for cross-asset wealth use | Later overall wealth risk/concentration evidence, separate from per-section health. | P2 |
| `PortfolioAttentionSummary` | Modify for cross-asset wealth use | Later read-only wealth observations only; no mutation or investment CTA. | P2 |
| `PortfolioHoldingsEvidence` | Move to Portfolio Analysis | Brokerage securities holdings, filters, sorting, and holding-detail entry. | — |
| `PortfolioHoldingDetail` | Move to Portfolio Analysis | Brokerage holding evidence/detail. Trading remains in Accounts. | — |
| `PortfolioCustodyBreakdown` | Move to Portfolio Analysis | Brokerage account/custodian and Available Cash context. | — |
| `PortfolioRecommendedActions` | Remove | Investment, trading, dividend, or account-write actions do not belong in analysis pages. Existing actions remain in Accounts. | — |
| `PortfolioActivity` | Remove | Trade, dividend, and transaction history remains inside Brokerage Accounts and holdings. | — |

### Retained Wealth Analysis priority

1. **P0 — core comprehension:** loading/error/update states, header and
   completeness, overall wealth value, and cross-asset allocation with routes to
   specialized pages.
2. **P1 — overall health:** one transparent Wealth Health assessment using only
   evidence valid across the supported wealth scope.
3. **P2 — deeper read-only analysis:** context/filtering, diversification,
   concentration/risk evidence, and observation summaries after the core view is
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

## Expected mobile architecture

The implementation should use a dedicated read-only analysis feature rather
than coupling Flutter to web components:

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

Analysis controllers expose no mutation methods. Existing Accounts repositories
and controllers remain the owners of account, trade, dividend, record, purchase,
valuation, and disposal writes.

No database, RPC, RLS, or Supabase change is implied by the navigation and
presentation architecture. Any later server aggregation contract requires a
separate approved backend task.

## Explicitly deferred

- Wealth Analysis aggregation and specialized analysis data UI;
- per-section and per-asset-class health scores;
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
- Each other supported asset class opens its own specialized analysis page.
- Only one overall Wealth Health assessment is in current scope; per-section
  and per-asset-class health scores are deferred.
- Portfolio Activity is absent; history remains inside Accounts.
- Analysis surfaces remain read-only and preserve unavailable/stale states.
- Trading and dividends remain in Brokerage Accounts.
- Add Investment and other account mutation actions remain in Accounts.
- No financial, repository, or backend behavior changes merely to support
  navigation.

## Open architecture decisions

1. **Mobile navigation:** choose nested Navigator routing or the existing root
   Navigator for specialized pages while preserving the Analysis tab state.
2. **Shared valuation ownership:** decide whether Wealth Analysis consumes the
   Dashboard snapshot directly or a neutral shared valuation controller.
3. **Overall Wealth Health contract:** define the cross-asset factors and
   thresholds that are valid for the full wealth scope without inventing missing
   evidence.
4. **Specialized-page rollout:** define which non-Portfolio analysis page is
   implemented after the Wealth Analysis shell.
