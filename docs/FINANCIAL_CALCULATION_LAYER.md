# Financial Calculation Layer

`src/lib/financial-calculations` is the application-wide boundary for
financial formulas and financial-value validation. It is framework
independent: repositories, services, reports, and future market or FX
modules may consume it, but it does not import React or UI code.

## Implemented now

- Validate and normalize exact decimal quantities without floating-point
  arithmetic.
- Identify open holdings from positive projected quantities.
- Expose ledger-derived holding quantity, total cost basis, average cost,
  and cost currency.
- Aggregate open holding cost basis by cost currency. Different currencies
  are never combined.
- Calculate the change shown by the existing static dashboard series. This
  is presentation-series behavior only and is not ledger profit/loss.

PostgreSQL owns ledger balancing and the derivation of holding quantity,
`total_cost_basis`, and `average_cost` from posted entries. The calculation
layer validates and aggregates those projection values. UI code owns only
presentation and locale-aware formatting.

## Intentionally deferred

FX conversion, reporting-currency totals, market prices, current market
value, profit/loss, Total Assets, liabilities, and Net Worth are not
implemented. Future services must add those calculations through this
boundary rather than placing formulas in components, pages, or hooks.
