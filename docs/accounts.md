# Accounts Tab — Data & Logic Spec (for Mobile Reimplementation)

This document describes the **data model, business logic, validation, and UI/UX flow** of the web app's "Accounts" tab (`src/features/accounts/`), so it can be reimplemented for mobile with behavioral parity. Field names below are given in both DB (snake_case) and client (camelCase) form where relevant.

## 1. Feature overview

The Accounts tab manages a single polymorphic table, `financial_accounts`, representing **7 account types**: `cash`, `bank`, `brokerage`, `gold` (covers both gold and silver), `real_estate`, `business`, `other`. Gold/silver accounts have a companion append-only history table, `metal_purchases`, and a dedicated RPC (`add_metal_purchase`) that both records a purchase and updates the parent account's running weighted-average cost/balance.

Related-but-separate features that share the same table (context only, not part of this tab):

- `src/features/cash-accounts/` — a simplified, cash-only accounts page. Uses ledger-adjusted `current_balance` (via `account-balances` RPC) instead of raw `opening_balance`. **Not i18n-driven** (hardcoded English), unlike this tab.
- `src/features/account-balances/` — RPC-driven ledger balance read model (`get_account_balances`), also reused by this tab for Cash, Bank, and Brokerage available cash.

Cash and Bank account records reuse the shared `financial_transactions` / `transaction_entries` ledger. No parallel records table exists.

## 2. Data model

### 2.1 `financial_accounts` table

```sql
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_type_code text not null references public.account_types (code),
  name text not null,
  currency_code text not null,               -- check: one of USD, SAR, EGP, EUR, GBP
  opening_balance numeric(20, 2) not null default 0,
  is_active boolean not null default true,
  notes text,
  bank_subtype text,                          -- 'debit' | 'credit', only when type = bank
  credit_card_limit numeric(20, 2),           -- positive when set; only for bank credit accounts
  due_day_of_month integer,                   -- optional 1-31; only for bank credit accounts
  investment_type text,                       -- 'stock_etf' | 'crypto' | 'other', only when type = brokerage
  balance_grams numeric(20, 3),               -- only when type = gold
  property_type text,                         -- 'apartment'|'villa'|'land'|'office'|'other', only when type = real_estate
  ownership_percentage numeric(5, 2),         -- 0-100, only when type in (real_estate, business)
  business_type text,                         -- only when type = business
  industry text,                              -- only when type = business
  metal_type text,                            -- 'gold' | 'silver', required when type = gold
  purity text,                                -- enum depends on metal_type, only when type = gold
  purchase_date date,                         -- only when type = gold
  cost_per_unit numeric(20, 2),               -- only when type = gold
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

Key constraints:

- `name` cannot be blank.
- `currency_code` restricted to `USD | SAR | EGP | EUR | GBP` (fixed 5-item enum, not user-extensible).
- All type-specific columns are nullable but constrained via CHECK to only be non-null for their matching `account_type_code`.
- `credit_card_limit`, when present, must be positive, and `opening_balance` (available credit) must be between zero and that limit. `due_day_of_month`, when present, must be between 1 and 31. Both credit-only columns must remain null unless the account is a bank account with `bank_subtype = 'credit'`.
- `metal_type` is **required** when `account_type_code = 'gold'`, and must be `null` otherwise.
- Purity enum depends on `metal_type`: gold → `24k,22k,21k,18k,14k,10k,9k,other`; silver → `999,958,950,925,900,835,800,other`.

Uniqueness:

- **Non-metal accounts**: unique on `(user_id, lower(trim(name)))` where `account_type_code <> 'gold'` — case-insensitive unique name per user.
- **Gold/silver accounts**: unique on `(user_id, currency_code, metal_type)` where `account_type_code = 'gold'` — **only one Gold and one Silver account per currency, per user.** This is why gold/silver accounts are always auto-named "Gold"/"Silver" and the name field is hidden in the form.

RLS: standard per-user CRUD (`auth.uid() = user_id`).

Triggers (immutability guards once financial history exists):

- Changing `currency_code` on an account with existing `transaction_entries` raises Postgres error `23514` ("This account already contains financial history. Its currency cannot be changed.").
- Changing `opening_balance` similarly raises `23514` for opening balance.
- `getAccountDeletionEligibility()` queries `transaction_entries`, `holdings`, and `metal_purchases` for rows referencing the given account ids (all scoped to the authenticated user); an account is `hasFinancialHistory: true` (and therefore `canDelete: false`) if any of the three has a matching row. This drives both the locked-field UI states above and the Delete button's disabled state in the Accounts list.

`account_types` reference table (seed data only, not queried dynamically by the client — types are hardcoded client-side):
`cash, bank, brokerage, gold, real_estate, business, other`.

### 2.1a Minimal Cash/Bank ledger foundation

`financial_transactions` also carries nullable immutable-correction links: `reverses_transaction_id` and `corrects_transaction_id`. Each is a self-FK with `ON DELETE RESTRICT`, cannot reference itself, and has a unique partial index so an original transaction can have at most one reversal and one corrected replacement. The internal `post_account_record_internal` function accepts both links only at transaction creation; the public `add_account_record` RPC always passes null for both and retains its existing client contract.

The current project has a deliberately minimal Cash/Bank ledger foundation:

- `transaction_types` contains only `income`, `expense`, and `transfer` for this flow.
- `financial_transactions` stores authenticated-user transaction headers, status, occurrence time, description, and notes.
- `transaction_entries` stores exact decimal debit/credit amounts. `transaction_amount` is the balanced transaction-currency value; `account_amount` is the referenced account-native value. Accountless entries are restricted to the approved external-flow convention.
- Posted transactions and their entries are immutable. Ownership checks restrict Account Records entries to owned Cash or Bank accounts, exact debit/credit balance is validated before posting, and `get_account_balances` projects opening balance plus posted non-asset ledger effects for Cash, Bank, and active Brokerage accounts. Brokerage Available Cash is `opening_balance + posted debits - posted credits`; holding entries are excluded. The internal-only `get_brokerage_available_cash(account_id, required_cash, lock_account)` helper validates an owned active Brokerage account and can reject insufficient cash while holding the account lock for future posting flows.
- `reverse_account_record(transaction_id)` is an authenticated, immutable reversal path for supported posted Income, Expense, and Transfer records. It creates a new linked transaction with `reverses_transaction_id` set at insert time; it never updates or deletes the original. A reversal must leave every affected account non-negative and respect Bank Credit limits. Cross-currency transfers reverse both native account amounts while retaining the original shared transaction amount.
- `correct_account_record(...)` is an authenticated atomic correction path. It locks an owned posted original, rejects already reversed/corrected originals, posts its linked reversal, then posts the submitted replacement with `corrects_transaction_id` set at creation. The submitted type, accounts, amounts (including cross-currency received amount), category IDs, notes, and occurrence time are passed unchanged into the normal internal posting validation; an error from either step rolls back the full correction.
- `add_brokerage_cash_transfer(...)` is the separate authenticated posting path for Cash/Bank-to-Brokerage and Brokerage-to-Cash/Bank cash movements. It preserves the existing cross-currency transfer contract: source-native `p_amount` is the exactly balanced transaction amount and destination-native `p_received_amount` is required when currencies differ. Both accounts are active and owned; Brokerage debits call `get_brokerage_available_cash(account_id, required_cash, true)` and cannot make Available Cash negative. Asset/holding entries are never created. `reverse_brokerage_cash_transfer(transaction_id)` posts a linked exact inverse: it retains the original transaction currency and transaction amount while restoring each original account-native amount, and rejects the reversal if the account being reduced, including Brokerage, lacks enough current available cash. These transfers remain visible in Cash/Bank Account Records and Daily Net but are intentionally not editable/deletable through ordinary Account Record controls until Brokerage transfer UI is introduced.
- The investment foundation supplies `asset_types`, visible global/user-owned `assets`, exchange-scoped `asset_identifiers`, and read-only `holdings` projections. Asset identity is exchange plus symbol, not display name; identifiers remain server/RPC-managed while authenticated users have read access. Posted Brokerage asset entries carry signed canonical quantity and account-currency cost-basis effects. Draft metadata preparation derives identity FX for matching account/transaction currencies; cross-currency asset entries must supply immutable positive historical FX metadata and convert to the ledger's 10-decimal account-amount scale. The existing `post_transaction` remains callable by authenticated users for their own balanced drafts, then rebuilds holdings only when the transaction contains an asset entry. It creates no cash movement, so Cash/Bank balances and Brokerage Available Cash continue to exclude asset entries. `opening_position`, `opening_position_reversal`, `buy`, `sell`, `dividend`, and `adjustment` are reserved ledger types; no investment workflow RPC is introduced by this foundation.
- `add_existing_holding(account_id, asset_id, quantity, average_cost, occurred_at, notes, account_fx_rate)` posts an owned active Brokerage opening position. `quantity` is expressed in the asset's canonical quantity unit, and `average_cost` is the historical average cost per that canonical unit in the asset currency. The opening transaction uses that asset currency. When it differs from the Brokerage account currency, `account_fx_rate` is required as the positive historical Brokerage-currency amount per asset-currency amount; the occurrence timestamp and `opening_position_input` provenance are stored as immutable FX metadata. Matching currencies use identity FX and require no rate. This stage performs no FX lookup or quantity-unit conversion. It reuses the shared visible-asset catalog and holdings projection, creating one asset debit for asset-currency quantity/cost basis and account-currency historical cost basis plus a balancing accountless opening-equity credit. The transaction has no non-asset Brokerage entry, so both `opening_balance` and ledger-projected Brokerage Available Cash remain unchanged. Multiple opening positions for the same asset are allowed; the shared holdings projection aggregates their quantity and total cost basis into the weighted average. `reverse_existing_holding(transaction_id)` posts the exact linked asset-side inverse, never mutates the original, and never creates a cash movement. It copies the original transaction/account amounts and immutable FX metadata, so it never recalculates historical FX. Before creating its draft reversal, it acquires the same per-holding advisory lock as the projection and rejects the operation when the exact inverse would leave negative effective quantity, negative cost basis, or zero quantity with non-zero cost basis. `correct_existing_holding(original_transaction_id, quantity, average_cost, occurred_at, notes, account_fx_rate)` is the atomic correction path: it locks and validates one owned posted opening position, posts its exact immutable reversal, posts a `corrects_transaction_id`-linked replacement using the same canonical-unit and historical-FX rules, and returns the original, reversal, replacement, entries, and resulting holding. Any error rolls back the full correction. It creates no Brokerage cash movement and leaves Available Cash unchanged. `add_brokerage_buy(account_id, asset_id, quantity, unit_price, occurred_at, notes, fees, account_fx_rate)` posts a normal Buy using only the selected Brokerage account's locked Available Cash. Quantity and unit price are in the asset canonical unit and asset currency; `fees` is optional, non-negative, and expressed in that same asset currency. Principal and fees are each normalized to the ledger's 10-decimal asset-currency precision before calculating the transaction cash total, FX conversion, Available Cash validation, cost basis, or entries. They are separate immutable asset entries, so both add to fee-inclusive holding cost basis. For cross-currency Buys, each normalized component is converted and rounded separately to 10-decimal account currency; their sum is the exact Brokerage cash credit, avoiding a rounding-the-sum mismatch. Matching currencies use identity FX and reject an input rate; differing currencies require a positive historical Brokerage-currency-per-asset-currency rate and store `buy_input` provenance. The transaction balances in asset currency and contains no external, Cash, or Bank entry. Insufficient Available Cash rejects before a draft is created. The internal buy helper is not executable by authenticated clients; only the public Buy RPC is.
- `add_brokerage_sell(account_id, asset_id, quantity, unit_sale_price, occurred_at, notes, fees, account_fx_rate)` posts an owned active Brokerage Sell. It reduces an effective holding by quantity and its proportional moving-average asset/account cost basis; a full sell removes the exact remaining basis. Gross asset-currency proceeds less optional asset-currency fees become the exact Brokerage Available Cash credit, with no Cash/Bank or external entry. Cross-currency sales require immutable sale FX for proceeds while a distinct zero-cash asset entry stores the exact intended account carrying-basis reduction instead of re-deriving it from a rounded FX ratio. No realized P/L state is created.
- Holding Details exposes a Sell action for an open Brokerage holding. The form accepts canonical quantity, asset-currency unit sale price, optional asset-currency fees, local Date & Time, notes, and a historical FX rate only when the asset and Brokerage currencies differ. Its decimal-safe preview mirrors the RPC's 10-decimal ledger contract: gross proceeds and fees are normalized separately; cross-currency gross and fees are each converted and rounded before net Brokerage cash proceeds are calculated. The current quantity supplies client-side oversell guidance, while the RPC remains authoritative. A successful Sell refreshes the holding, history, account data, and Available Cash; a full Sell returns to the Brokerage account page. Holding history presents posted Sells with quantity, unit sale price, non-zero fees, net asset proceeds, Brokerage-currency cash proceeds, and cross-currency historical FX only. It intentionally hides internal carrying-basis entries and does not expose Sell edit/delete actions.
- Brokerage Account Details includes an account-level **Activity** history independent of the open-holdings projection, so posted activity remains available after a position is fully sold. It reads posted account-scoped Cash/Bank-to-Brokerage transfers, Existing Holding lifecycle records, Buys, Sells, and reserved future Dividend records from the shared ledger. Entries are grouped by the device-local date; transfer rows use user-facing Transfer in/Transfer out labels. Existing Holding corrections and deletions apply the same clean presentation rules as Holding Details: raw reversal rows and corrected originals are hidden, effective replacements display Updated, and deleted originals remain muted, non-actionable Deleted history rows. Buy/Sell activity opens a read-only user-facing transaction summary, including the related asset even when its current holding is zero. The account-level activity surface never exposes internal carrying-basis entries, lifecycle IDs, or raw ledger labels.
- The Add Existing Holding dialog also offers a debounced external symbol/name search through the authenticated, read-only `asset-search` Edge Function, plus an optional separate native Country dropdown (a shared ~180-country list from `src/lib/countries.ts`). The Country dropdown is not searchable; selecting a country narrows the symbol/name search results to listings in that country. It handles browser `OPTIONS` preflight and includes CORS headers on every response while preserving POST authentication. Search requires at least two characters, returns at most ten results with name, symbol, display exchange, country, currency, instrument type, and MIC code, and uses a short Edge-runtime cache keyed on the normalized query plus the selected country. Twelve Data's own `country` request parameter does not reliably restrict `symbol_search` results, so when a country is selected the Edge Function requests a larger batch from the provider and re-filters by the normalized `country` field itself before applying the ten-result cap; an unfiltered search still returns the provider's top ten directly. The client ranks an exact case-insensitive symbol match for the normalized query ahead of name-only matches while retaining Twelve Data's order within each tier. Results render as a scrollable, elevated card list (own background, shadow, and hover/selected states per card) rather than a plain divided list, and show the listing's symbol, exchange, country, currency, and instrument type distinctly so similarly named listings can be compared. Selecting a result immediately clears the search box and result list. Explicitly selecting a result calls `resolve_external_brokerage_asset`, which normalizes the MIC-plus-symbol identity, reuses a compatible visible asset, or atomically creates one user-owned custom catalog asset and its server-managed Twelve Data provider identifier. The resolver accepts only explicit provider type mappings: Common/Preferred Stock and recognized depositary receipts map to `stock`; ETF labels map to `etf`; Mutual Fund, Bond, and Digital Currency/Cryptocurrency map to their matching catalog types; Warrant maps deliberately to `other`. Any unknown or ambiguous provider type is rejected. Client-supplied provider data never creates or alters a global catalog asset; only an already-identified compatible global asset can be reused. The returned catalog asset is selected in the form, but no holding or ledger activity is created until the user submits Add Existing Holding. Manual private-asset creation remains the fallback. Provider, quota, or resolution failures appear as non-blocking states.
- The protected `market-prices` Edge Function resolves Twelve Data quotes only from a caller-visible asset's persisted `provider/twelve_data` identifier. Its `twelve_data:{MIC}` namespace and normalized symbol are validated against the server-loaded asset before provider calls; requests are grouped by stored MIC so duplicate tickers across listings are not resolved from client-provided exchange data. `market_prices` stores positive 10-decimal provider or user-owned manual prices with currency, effective/fetch timestamps, provenance type, and optional owner. Shared provider rows have no owner; manual rows belong to the authenticated user. RLS exposes prices only when both the price and asset are visible, and allows client writes only for the caller's manual prices. The 15-minute persisted provider cache, stale provider fallback, user-owned manual fallback, and provider provenance/freshness behavior remain unchanged. Assets without a valid Twelve Data identifier or without a provider quote return unavailable unless an existing stale/manual fallback applies. This stage does not display Brokerage market value, account value, or P/L.
- Client roles receive the narrowly scoped table access described above. Ledger writes occur through authenticated security-definer RPCs, including `post_transaction` for an owned balanced draft; PUBLIC and anon have no table or function write access.
- Brokerage Account Details shows ledger-projected Available Cash from `get_account_balances` and its account-scoped holdings projection. It intentionally shows no market value or performance. Holding-row Average Cost and Total Cost use the projection's `cost_currency_code` (the Brokerage account currency); an asset's currency applies only to the historical opening-position input. Each holding opens `/accounts/:accountId/holdings/:assetId`, which shows account-currency projected quantity/cost fields and the asset's currency, plus local-date grouped Existing Holding history. The UI derives a user-facing history from immutable posted lifecycle rows: a corrected original and its raw reversal are hidden, while the effective replacement is shown once as **Updated**; a deleted opening remains as a non-actionable **Deleted** audit entry. Deleted entries preserve their original quantity and cost values but use a subtle muted background/contrast, explicit Deleted badge, and `Deleted · local time` status text; they have no hover, click, Edit, or Delete affordance. Reversal descriptions, UUID-linked system notes, and lifecycle IDs are never rendered. Opening-position details expose timestamp, quantity, historical asset-currency average cost, account-currency cost effect, cross-currency historical FX, and user notes; matching account/asset currencies hide identity FX entirely. Users can open transaction details and edit or delete an unreversed effective opening. Edit initializes quantity, asset-currency historical average cost, local date/time, notes, and cross-currency historical FX from the original immutable entry, then calls `correct_existing_holding` only; it never attempts a client-side reversal plus add. Matching currencies submit no FX rate; differing currencies require a positive Brokerage-currency-per-asset-currency rate. A successful edit refreshes the holding and history immediately and dispatches the shared data-change event; Available Cash remains unchanged. A rejected already-changed edit refreshes history and shows a non-destructive error. Delete continues to call `reverse_existing_holding`; it posts no cash movement and the page refreshes or returns safely when no holding remains. The Add Existing Holding dialog keeps the asset selector, manual-asset action, and quantity field as separate vertically spaced controls. It selects visible catalog assets and calls `add_existing_holding`; historical average cost uses the asset currency, and a historical FX rate is required only when the asset and Brokerage currencies differ. When no suitable catalog asset exists, the dialog can create a private custom asset through the existing RLS-backed `assets` insert path, then automatically select it. The manual flow requires name, symbol, exchange, active database-provided asset type, and one of the shared account currencies; exchange plus symbol is the safe identity and the database's user-scoped unique constraint remains authoritative. Canonical quantity unit remains backend-derived. Saving an opening position refreshes holdings and Available Cash without changing cash.

Brokerage Account Details uses one shared Brokerage valuation snapshot. The header shows Available Cash, Total Holdings Market Value, and Current Value, where Current Value equals Available Cash plus positively held assets valued in the Brokerage account currency. Each positive holding shows Quantity, Average Cost, Current Price, and Market Value; prices and market values show the asset currency. The snapshot uses existing market-price and current-FX services with decimal-safe calculations, and any missing price or FX marks holdings and account Current Value unavailable rather than substituting cost basis or zero. Small screens use a stacked responsive holding layout.

### 2.1b Record categories

`record_categories` is a shared hierarchical catalog for both Income and Expense. Each row is either a `main` category (no parent) or a `subcategory` linked to a main category, with explicit `sort_order` at both levels. System defaults have `user_id = null` and stable `system_code`; custom rows belong to one user and can be archived instead of deleted. The deployed seed preserves the approved display order for every default main category and subcategory.

`record_category_overrides` is per-user and applies only to system rows. It stores an optional replacement name and `is_hidden`, allowing a user to rename, hide, or restore a default without changing it for anyone else. RLS permits authenticated users to read system defaults plus their own custom rows, and to read/write only their own custom rows and overrides.

`financial_transactions.main_category_id` and `subcategory_id` are nullable FKs to `record_categories`. New ID-based Income/Expense RPC calls require a visible, linked main/subcategory pair; Transfer requires both values to be null. Historical transactions remain unchanged with null category IDs and are not backfilled. The web Add Record form uses the ID-based path; the RPC retains its text-category compatibility path only for existing callers.

### 2.2 `metal_purchases` table (append-only purchase history)

```sql
create table public.metal_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.financial_accounts (id) on delete cascade,
  purity text not null,
  purchased_at timestamptz not null,
  quantity_grams numeric(20, 3) not null,     -- check: > 0
  cost_per_unit numeric(20, 2) not null,      -- check: > 0
  fees numeric(20, 2) not null default 0,     -- check: >= 0
  funding_mode text not null,                 -- 'external' | 'cash_account'
  funding_account_id uuid references public.financial_accounts (id) on delete set null,
  funding_transaction_id uuid references public.financial_transactions (id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
)
```

- `funding_account_id` required if and only if `funding_mode = 'cash_account'`.
- Funded purchases retain the posted `investment_purchase` transaction in
  `funding_transaction_id`; external purchases retain no funding transaction.
- RLS: **select + insert only** — no update/delete policy. Purchase records are immutable from the client once created.

### 2.2a Metal purchase lifecycle events

`metal_purchase_lifecycle_events` is an append-only internal audit table. One
event may affect an original purchase: `reversal` makes it ineffective, while
`correction` additionally links an immutable replacement purchase. Events retain
the actor, optional linked funding reversal transaction, and creation time.
Normal purchase history is read through `get_effective_metal_purchases`, which
returns only purchases without a lifecycle event; audit history is not exposed by
the web client.

### 2.3 `add_metal_purchase` RPC — the core "buy more gold/silver" transaction

```
add_metal_purchase(
  p_account_id uuid, p_purity text, p_occurred_at timestamptz,
  p_quantity_grams numeric, p_cost_per_unit numeric,
  p_funding_mode text, p_funding_account_id uuid, p_fees numeric,
  p_notes text default null
) returns financial_accounts
```

Logic (must be replicated exactly, either by calling this same RPC from mobile or reimplementing the equivalent server logic):

1. Requires authenticated user; locks (`FOR UPDATE`) the target account — must be an active, owned, `account_type_code = 'gold'` account with a valid `metal_type`.
2. Validates `quantity_grams > 0`, `cost_per_unit > 0`, `fees >= 0`, and `purity` against the metal-specific enum.
3. `subtotal = quantity_grams * cost_per_unit`; `cost_basis = subtotal + fees`.
4. **Funding**:
   - `funding_mode = 'cash_account'`: funding account must be active, owned, type `cash` or `bank`, **same currency** as the gold account, and have `opening_balance >= cost_basis`. Debits the funding account: `opening_balance -= cost_basis`.
   - `funding_mode = 'external'`: no debit; `funding_account_id` forced to `null`.
5. **Weighted-average cost update** (core valuation formula):
   ```
   new_balance_grams   = old_balance_grams + quantity_grams
   new_cost_per_unit    = (old_balance_grams * old_cost_per_unit + cost_basis) / new_balance_grams
   ```
   Fees are part of acquisition cost and therefore the weighted-average cost.
6. Updates the account: `balance_grams`, `cost_per_unit` (both per formula above), `purity` and `purchase_date` are overwritten with the latest purchase's values.
7. Inserts an immutable `metal_purchases` row with the actual UTC timestamp, original purchase details, and an optional trimmed note.

### 2.4 TypeScript domain types

The `add_account_record` RPC atomically posts exactly `income`, `expense`, or `transfer` records for active, owned Cash and Bank accounts. Income debits the selected account and balances against an accountless `owner_contribution`; Expense credits it and balances against an accountless `owner_draw`. Transfers credit the From account and debit the To account. For cross-currency transfers, both entries use the source-native sent amount as their exactly balanced `transaction_amount`, while each `account_amount` remains native to its referenced account; the destination therefore stores the final user-approved received amount. This records a neutral transfer in the ledger without updating `exchange_rates` or persisting a reusable inferred rate. The RPC locks and validates accounts, rejects insufficient available balance, and rejects any Bank Credit inflow when `credit_card_limit` is null or the resulting available credit would exceed that limit.

```ts
type AccountTypeCode =
  "cash" | "bank" | "brokerage" | "gold" | "real_estate" | "business" | "other"
type Decimal = string // ALL monetary/quantity values are strings, never JS numbers — see §10

type AccountSummary = {
  id: string
  user_id: string
  account_type_code: AccountTypeCode
  name: string
  currency_code: "USD" | "SAR" | "EGP" | "EUR" | "GBP"
  opening_balance: Decimal
  notes: string | null
  is_active: boolean
  bank_subtype: "debit" | "credit" | null
  credit_card_limit: Decimal | null
  due_day_of_month: number | null
  investment_type: "stock_etf" | "crypto" | "other" | null
  balance_grams: Decimal | null
  property_type: "apartment" | "villa" | "land" | "office" | "other" | null
  ownership_percentage: Decimal | null
  business_type: string | null
  industry: string | null
  metal_type: "gold" | "silver" | null
  purity: string | null
  purchase_date: string | null
  cost_per_unit: Decimal | null
  created_at: string
  updated_at: string
}

type MetalPurchaseRecord = {
  id: string
  user_id: string
  account_id: string
  purity: string
  purchased_at: string
  quantity_grams: Decimal
  cost_per_unit: Decimal
  fees: Decimal
  notes: string | null
  funding_mode: "external" | "cash_account"
  funding_account_id: string | null
  created_at: string
}
```

All numeric columns are fetched with `::text` casts to preserve exact decimal precision, then re-validated as decimal strings client-side; a malformed value throws a `RepositoryError({code: "database_error"})`.

### 2.5 Form value shape (`AccountFormValues`)

```ts
type AccountFormValues = {
  name: string
  accountTypeCode: AccountTypeCode
  currencyCode: "USD" | "SAR" | "EGP" | "EUR" | "GBP"
  openingBalance: string
  bankSubtype: "debit" | "credit" | ""
  creditCardLimit: string
  dueDayOfMonth: string
  investmentType: "stock_etf" | "crypto" | "other" | ""
  balanceGrams: string
  propertyType: "apartment" | "villa" | "land" | "office" | "other" | ""
  ownershipPercentage: string
  businessType: string
  industry: string
  metalType: "gold" | "silver" | ""
  purity: string
  purchaseDate: string
  costPerUnit: string
  notes: string
  isActive: boolean
}
// defaults: openingBalance="0", balanceGrams="0", ownershipPercentage="100", costPerUnit="0", isActive=true
```

`toAccountTypeSpecificFields(values)` strips/nulls irrelevant fields per type before sending to the repository:

- `cash` / `other`: `openingBalance` only.
- `bank` Debit: `openingBalance` + `bankSubtype`; credit-only fields are cleared.
- `bank` Credit: `openingBalance` (available credit) + `bankSubtype` + required `creditCardLimit` + optional `dueDayOfMonth`.
- `brokerage`: `openingBalance` + `investmentType`.
- `gold`: **`openingBalance` forced to `"0"`** + `metalType` (actual balance accrues only via metal purchases, never edited directly).
- `real_estate`: `openingBalance` + `propertyType` + `ownershipPercentage`.
- `business`: `openingBalance` + `businessType`/`industry` + `ownershipPercentage`.

### 2.6 Metal purchase form value shape

```ts
type MetalPurchaseFormValues = {
  purity: string
  purchaseDate: string
  unitsGrams: string
  costPerUnit: string
  fees: string
  paidFromAccount: boolean
  fundingAccountId: string
  notes: string
}
// subtotal = unitsGrams * costPerUnit; total cost / cost basis = subtotal + fees
```

## 3. Validation rules

Per-type, on submit (Zod schema, errors shown only after first submit attempt):

| Type                    | Required / validated fields                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `cash`, `other`         | `openingBalance` — pattern `^\d{1,18}(\.\d{1,2})?$`                                                                                  |
| `bank` Debit            | non-negative `openingBalance` + `bankSubtype = debit`                                                                                |
| `bank` Credit           | non-negative `openingBalance` + positive `creditCardLimit` + optional `dueDayOfMonth` from 1-31; `openingBalance <= creditCardLimit` |
| `brokerage`             | above + `investmentType` required                                                                                                    |
| `real_estate`           | above + `ownershipPercentage` (pattern `^\d{1,3}(\.\d{1,2})?$`, ≤ 100) + `propertyType` required                                     |
| `business`              | above + `ownershipPercentage` + `businessType` required + `industry` required                                                        |
| `gold`                  | `metalType` required only (no balance field shown)                                                                                   |
| all types except `gold` | `name` required                                                                                                                      |

Metal purchase form:

- `purity` — must be a valid option for the account's `metalType`.
- `purchaseDate` — required local date and time; converted to UTC before storage.
- `unitsGrams` — pattern `^\d{1,18}(\.\d{1,3})?$`, must be `> 0`.
- `costPerUnit` — pattern `^\d{1,18}(\.\d{1,2})?$`, must be `> 0`.
- `fees` — optional, defaults to `0`, and must be a non-negative decimal amount.
- `fundingAccountId` — required only if `paidFromAccount = true`.

The Add Metal Record dialog shows purity, date and time, grams, cost per gram, optional fees, read-only purchase subtotal, read-only total cost/cost basis, optional Cash/Bank funding, and optional notes. Funding is limited to active same-currency Cash or Bank accounts; the RPC validates ownership and available balance.

## 4. Business logic (create/update/archive/delete)

- **Create**: for `gold`-type accounts, `name` is force-set to `"Silver"` if `metalType === "silver"`, else `"Gold"` (ignores any user input, since the field is hidden). If the form's `isActive` is `false`, creation requires a create-then-immediately-update round trip (insert always creates active, then a second call sets `is_active = false`).
- **Update**: same name-forcing logic for gold accounts; otherwise updates all provided fields.
- **Friendly constraint errors**: both `createAccount()` and `updateAccount()` translate specific Postgres constraint violations into readable `RepositoryError` messages instead of surfacing the raw database error: the gold/silver singleton-per-currency unique index (`financial_accounts_user_currency_metal_type_key`, `23505`) becomes "You already have this type of Gold/Silver account in this currency. Go to that account and add a purchase instead of creating a new one."; the non-metal case-insensitive name uniqueness (`financial_accounts_non_metal_user_name_lower_key`, `23505`) becomes a duplicate-name message; the two immutability triggers (§2.1) keep their existing messages. `AccountFormDialog` catches whatever `onSubmit` throws and renders it as a visible alert inside the dialog (the dialog stays open so the user can correct the field) — previously a create/update failure only surfaced as a generic "Account action failed" banner on the page behind the dialog, or an unhandled rejection in the console, with no readable message shown to the user.
- **Archive**: soft-deactivate only — `updateAccount(id, { isActive: false })`. There is **no separate DB flag**; archived = `is_active = false`. Note the gold/silver singleton unique index has no `is_active` predicate, so an archived Gold/Silver account still occupies its `(user_id, currency_code, metal_type)` slot — creating a replacement in the same currency hits the same friendly duplicate-account error above; the existing archived account must be restored or the new one created in a different currency.
- **Delete**: hard delete, gated by `getAccountDeletionEligibility()`.
- **Mutation guard**: only one mutation may be in flight at a time; a concurrent attempt throws `RepositoryError({code: "conflict"})`.
- **Cross-feature refresh**: after any mutation (including metal purchases), the web app dispatches a global `window` event `"tharwati:data-changed"`, which other hooks (`useAccounts`, `useCashBalances`) listen for to silently refresh their data. **Mobile needs an equivalent global invalidation mechanism** (event emitter, or query-cache invalidation by shared key).

## 5. Repository / API surface

```ts
class AccountsRepository {
  getAccounts(): Promise<AccountSummary[]> // all accounts for user, order by created_at desc
  getAccount(id): Promise<AccountSummary>
  createAccount(input: CreateAccountInput): Promise<AccountSummary>
  updateAccount(id, input: UpdateAccountInput): Promise<AccountSummary>
  archiveAccount(id): Promise<AccountSummary> // = updateAccount(id, {isActive:false})
  getAccountDeletionEligibility(ids): Promise<AccountDeletionEligibility[]> // checks transaction_entries, holdings, metal_purchases
  deleteAccount(id): Promise<void> // throws constraint_violation if ineligible
}

class MetalPurchasesRepository {
  addPurchase(accountId, values: MetalPurchaseFormValues): Promise<void> // calls RPC add_metal_purchase
  getPurchaseHistoryRows(accountIds): Promise<MetalPurchaseRecord[]> // calls get_effective_metal_purchases, ordered by purchased_at desc, created_at desc
}

class AccountRecordsRepository {
  getAccountRecordHistory(accountId, cursor, pageSize?): Promise<AccountRecordHistoryRow[]>
  getAccountRecordDetail(recordId): Promise<AccountRecordRow>
  getAccountBalances(accountIds): Promise<AccountBalanceRow[]>
  addAccountRecord(values): Promise<void> // calls add_account_record with mainCategoryId/subcategoryId for Income and Expense
  correctAccountRecord(recordId, values): Promise<void> // calls correct_account_record
  reverseAccountRecord(recordId): Promise<void> // calls reverse_account_record
}
```

Account-record history embeds the matched entry's `financial_accounts.currency_code` through the deployed `transaction_entries_account_id_fkey` relationship, so each side of a transfer is mapped with its account-native currency.

Normal Account Record history uses `get_account_record_history(accountId, cursor, pageSize, timeZone, filters)` rather than loading the ledger directly. The authenticated RPC returns only effective posted records for the owned Cash/Bank account: reversal audit rows, reversed originals, and corrected originals are excluded; correction replacements remain. All filters apply server-side before paging: case-insensitive search across Notes and the current displayed main/subcategory names, inclusive local-calendar From/To dates using the caller's IANA device timezone, type, main category or subcategory, and optional absolute account-native minimum/maximum amount. Transfers are category-free and therefore do not match a category filter. It uses the stable keyset cursor `(occurred_at, id)` in descending order, defaults to 50 rows, and clamps requested pages to 100. The RPC resolves the cursor page first, identifies only that page's local calendar dates, converts each local midnight boundary to its DST-safe UTC timestamp range, and calculates each returned record's complete signed **filtered** Daily Net across all effective movements in those ranges. Therefore a displayed date spanning pages never shows a partial net without aggregating unrelated historical dates. The web page automatically loads the next page near the end of the current list using a viewport observer that re-arms after each append; it also provides a subtle Load more fallback. A failed page load stops automatic retry and shows a small retry action.

Purchase-history numeric columns are normalized from either a text or finite numeric Supabase response into validated decimal strings before any totals are calculated. The Add RPC returns the updated `financial_accounts` row; the client ignores that response and reloads effective immutable purchases for history.

`CreateAccountInput`/`UpdateAccountInput`: camelCase mirror of the type-specific DB columns (`accountTypeCode, name, currencyCode, openingBalance, notes, bankSubtype, creditCardLimit, dueDayOfMonth, investmentType, balanceGrams, propertyType, ownershipPercentage, businessType, industry, metalType, purity, purchaseDate, costPerUnit`, plus `isActive` on update).

Error handling: Postgres errors are normalized into a `RepositoryError { code, operation, details?, hint? }`, where `code` is one of `database_error | constraint_violation | conflict | not_found | forbidden`, mapped from Postgres codes (`23503→constraint_violation, 23505→conflict, 23514→constraint_violation, 42501→forbidden, PGRST116→not_found`). Note: a duplicate-name violation surfaces as a generic `conflict` with no bespoke friendly message today — design proper mobile-side copy for this case (e.g. "An account with this name already exists").

## 6. UI / UX flow

### 6.1 Page states

1. **Loading** — skeleton placeholders.
2. **Hard error** (error + zero accounts) — icon + message + "Try again".
3. **Normal** — header with "Add account" CTA, optional non-blocking inline error banner if accounts exist despite an error, filter bar, then either an **empty state** (no accounts at all, or none match filters — same copy either way) or the account list/table.

### 6.2 Filtering & sorting (all client-side, over the full loaded account list)

Filters: `search` (case-insensitive substring on name), `type` (exact match), `currency` (exact match; options are derived dynamically from currencies actually present, not the full static enum), and **Show Archived**. Show Archived defaults off and shows active accounts only; when on, it includes both active and archived accounts.
Filters: `search` (case-insensitive substring on name), `type` (exact match), `currency` (exact match; options are derived dynamically from currencies actually present, not the full static enum), `status` (`all | active | archived`).

The page also reads two URL query params on mount (no UI control for either — they only exist to support deep-linking from elsewhere in the app, currently the dashboard's gold/silver cards, see `docs/dashboard.md`): `type` seeds the initial value of the `type` filter above, and `metal` (`gold | silver`) applies an additional, filter-bar-invisible predicate on `metal_type` so a link can land the user on just gold or just silver accounts without exposing a separate metal filter control.

Sort columns: `name | type | balance` — the `balance` sort key is presented as **Current Value** and sorts numerically on the displayed non-metal value or live metal current value. For a Brokerage account, the list displays the shared Brokerage valuation: ledger-projected Available Cash plus all positively held assets valued in the Brokerage account currency. With no positive holdings this equals Available Cash; if any positive holding lacks a current price or required FX, the list displays an unavailable state rather than a stored-balance fallback. Clicking the active sort column flips direction; picking a new column resets to ascending.

**Displayed "Current Value"**: Cash and Bank accounts use `get_account_balances`, so posted Account Records affect the displayed value. Brokerage accounts use the shared Brokerage valuation, adding ledger-projected Available Cash to positively held assets valued through `PortfolioValuationService` and the existing market-data/FX services. The value is unavailable when any positive holding cannot be valued; it never substitutes cost basis or stored opening balance. Other non-gold accounts retain raw `opening_balance`. Gold/silver behavior is unchanged: current quantity in grams multiplied by the live current price per gram in the account currency.

### 6.3 List/table row content

Name, type label (for gold accounts, shows "Gold"/"Silver" from `metal_type`; for bank accounts, shows the stored subtype as "Bank Debit" or "Bank Credit"; all other types use their normal labels), balance (per §6.2, including its currency code), and ownership % (real_estate/business only, else "—"). Currency and status are not table columns.

Row actions:

- **Add purchase** (active gold accounts only) → opens metal purchase dialog.
- **Edit** (always) → opens account form dialog in edit mode.
- **Archive/Restore** (icon+label toggles based on `is_active`) → opens confirm dialog.
- **Delete** (always visible, disabled when ineligible — currently never disabled) → opens confirm dialog.

The entire account row/card is selectable (including keyboard Enter/Space) and navigates to `/accounts/:accountId`. Row action controls stop propagation, so Edit, Archive/Restore, Delete, and Gold/Silver-specific actions do not trigger navigation. Every Account Details header shows a prominent, label-free resolved amount in that account’s own currency; the standalone currency line is omitted because the amount already includes it. The shared Accounts value layer uses ledger balances for Cash/Bank (including Bank Credit available credit), transaction-derived grams × live price for Gold/Silver, the shared Brokerage valuation for Brokerage, and the existing stored `opening_balance` snapshot for Real Estate, Business, and Other. Cash, Bank Debit, and Bank Credit reuse their full Account Records page with Back navigation; account creation/opening balance is excluded because it is not a ledger transaction. A compact filter area sits above the grouped history: Search is prominent, while local date range, record type, main/subcategory, and native amount range remain compact. Active filters are shown as removable chips and Clear all resets the server-side query and cursor. Existing records appear newest first and are grouped by the device-local calendar date. Each date header shows that account's signed Daily Net in its account currency; with filters active it represents all matching effective movements for that date, including movements not yet loaded by pagination. Rows show Time, Category, Notes, and account-native signed Amount. Income/Expense use the current visible subcategory name when linked (with a legacy description fallback), Transfers display “Transfer,” and empty notes display an em dash. Income rows are green, Expense rows red, and Transfers neutral; Daily Net follows the same positive/negative/zero styling. Each effective row is keyboard/click selectable and opens Edit Record with account sides, native transfer amounts, categories, local Date & Time, and notes prefilled. Saving submits an immutable correction; Delete requires confirmation and submits an immutable reversal. Linked audit rows and their superseded originals are filtered from normal history, while correction replacements remain visible. An empty state appears when no records exist, and a visible Add Record action opens the Expense/Income/Transfer form. Gold/Silver opens its account-details page with the dedicated purchase-history content in §6.7. Brokerage now shows Available Cash, shared Brokerage Current Value, and its holdings/activity details; Real Estate, Business, and Other currently show their account-details header only; no new transaction flow is introduced.

The Add Record form presents the Record Type as three responsive, visible buttons rather than a dropdown: Income (green), Expense (red), and Transfer (neutral gray). Selecting one keeps the existing record type value and all conditional fields/validation unchanged. Expense and Income require Amount, selected Account, Category, and Date & Time; Notes are optional and Currency is read-only from the account. Category is a compact field that opens a separate, internally scrollable searchable popover, so it never expands the form. In normal browsing, main categories are subtly colored accordion sections and only their indented subcategories are selectable; configured main/subcategory `sort_order` is retained. Search matches either level and displays the complete path (for example, `Life & Entertainment → Gym & Sport`). A selection closes the popover and is shown in that same path format, with a checkmark in the list. Its Manage Categories dialog lets the current user add custom main/subcategories, rename system or custom items, hide and restore system defaults, and archive custom items; those changes use the user-scoped catalog/override data and never affect another user. Transfer does not render or submit a category. Expense decreases value and Income increases it. Transfer requires different owned From/To accounts, Amount Sent, and Date & Time. Same-currency transfers use the same amount on both sides. Different-currency transfers show a current-rate estimate from the shared FX service, allow the received amount to be overridden, and persist the final native received amount without writing to the app's FX-rate source. Transfers remain transfer transactions, not income or expense. History formats each side with its own account currency, so the destination displays the received amount in the destination currency. The Add Record form defaults Date & Time from the current device/browser local time and explicitly converts the submitted local `datetime-local` value to UTC for storage. The Records table shows separate Date and Time columns from that stored timestamp in the current device/browser local timezone (never raw UTC); Income rows are green, Expense rows are red, and Transfer rows retain neutral styling.

For Bank Credit, value means available credit: Expense/transfer-out decreases it; Income/payment/transfer-in increases it without exceeding the credit limit. Amount Due remains `credit_card_limit - current_balance`.

On a Bank Credit Account Details/Records header, the generic large account-value amount is not shown because it could be mistaken for owned cash. A responsive Credit Summary instead labels Credit Limit, Available Credit (the ledger-projected `current_balance`), Amount Due (`credit_card_limit - current_balance` using decimal-safe subtraction), and optional Due Day. If the limit or projected balance is missing or invalid, the summary is unavailable rather than displaying zero. Bank Debit keeps the existing generic current-value header, and Account Records posting/history behavior is unchanged.

> **Known web-app bug to decide on for mobile**: the "Restore" action for an archived account reuses the _same_ archive confirmation flow and repository call (`archiveAccount`, which always sets `is_active: false`) — so restoring currently does nothing (no-op). There is no working un-archive path in the current app despite the UI implying one. **Recommendation**: fix this on mobile with a distinct `restoreAccount = updateAccount(id, {isActive: true})` call and matching "Restore this account?" dialog copy, but be aware this is a deliberate deviation from current web behavior.

### 6.4 Create/edit flow (form dialog)

The Account Records grouped-history table has no repeated column header. Its compact date-group header displays only the local date and signed, account-currency net amount; at tablet/desktop widths rows reserve 10%/25%/45%/20% for Time, Category, Notes, and Amount, with time and amounts kept on one line. Below 480px in a mobile browser, the same clickable records use a compact stacked layout: Time and Amount share the first line, Category has the full second line and can wrap, and Notes use the third line (or an em dash when empty). Date groups, Daily Net, colors, local-time formatting, and edit behavior are unchanged.

The Add Record Category popover is viewport-aware: it is anchored to its field, opens below when space permits, flips above when it does not, and constrains its internal results list to the visible viewport.

Manage Categories remains a compact settings action on the Category label row. Default main categories use semantic icons with subtle accent colors; search retains a neutral border until it receives focus.

For Income and Expense, Add Record uses a wide two-column grid on tablet/desktop: Account and Category first, then Amount (with its account currency) and Date & Time; Notes spans both columns. The standalone read-only Currency field is not displayed. Narrow screens stack these fields into one column. Transfer retains its existing account, amount, received-amount, and FX behavior. Edit prefill normalizes stored decimal strings by removing only trailing zeroes, so displayed monetary inputs remain valid under the existing two-decimal form rule without changing stored precision.

- **Create mode**: two-step — (1) a type picker (radio-group grid of 7 type cards with icon+label), (2) the form itself, pre-seeded with the chosen type.
- **Edit mode**: skips the type picker; type is effectively immutable from the UI once created.
- Field visibility/labels are conditional on `accountTypeCode` exactly as described in §2.5/§3.
- Balance field label varies by type: `brokerage` → "Starting cash balance"; `real_estate`/`business` → "Current value"; `cash`/`bank`/`other` → "Starting balance"; hidden entirely for `gold`.
- Bank Debit shows Name, Currency, Type, Current Balance, and Active account. Bank Credit additionally shows a required Credit Card Limit and an optional Due Day of Month dropdown (`Unset`, then 1-31). For Bank Credit, Current Balance means available credit, and Amount Due is derived outside the form as `Credit Card Limit - Current Balance`; Amount Due is never entered manually.
- "Active account" toggle shown for all types except `gold` (gold accounts can't be created inactive from this form).
- Locked-field states (currency/opening balance read-only with explanatory caption) exist in the UI for when `hasFinancialHistory` is true (per §2.1, driven by real `transaction_entries`/`holdings`/`metal_purchases` checks).
- Validation errors only render after the first submit attempt, then update live.
- A create/update failure (e.g. a constraint violation) renders as a dismissible alert inside the dialog, above the form fields; the dialog stays open so the user can correct the offending field and resubmit.
- Closing a dirty form should prompt an "unsaved changes" confirmation.

### 6.5 Archive / Delete confirm dialogs

Simple modal: title interpolating account name, description, Cancel + destructive/warning confirm button (disabled + "…ing" label while in flight).

### 6.6 Add metal purchase dialog

Fields: `purity` (options depend on account's `metal_type`), `purchaseDate`, `unitsGrams`, `costPerUnit`, a "Paid from" toggle revealing a funding-account picker (active `cash`/`bank` accounts only) when checked, and a live read-only "Total amount" = `unitsGrams * costPerUnit` (fees excluded from this preview since there's no fee field).

### 6.7 Metal purchase history on the account-details page

The history flow has three transaction-derived layers:

1. **Account list** — Gold/Silver, currency, and current value only. Current value is the sum of each purchase's grams multiplied by the existing live price per gram for the metal and account currency, adjusted by its purity factor.
2. **Purity summary** — opening a metal account navigates to its account-details page and shows a responsive four-column table with one header row: **Purity | Total quantity | Total cost | Current value**. Total quantity is summed from the purchases at that purity. Total cost is the sum of each immutable historical purchase cost (`quantity × historical cost per unit`). Current value is the sum of those purchases' live values after applying the purity factor to the shared live metal price; it shows unavailable rather than falling back to historical cost. Each selectable purity row shows only those values; it does not list individual purchases.
3. **Purity details** — selecting a purity navigates to `/accounts/:accountId/purities/:purity`; it is not a dialog. Both the Gold/Silver account page and purity details page expose the existing Add purchase dialog; the purity page preselects its route purity while retaining the editable purity field. A successful purchase closes the dialog and refreshes the account value and visible purchase history. The page has Back navigation to the Gold/Silver account and shows the purity plus its existing resolved purity-adjusted `Price / gram` in the account currency, without another price fetch. Total quantity, Total cost, and Total current value remain below. Purchases are grouped by the device-local calendar date, newest first, with each date displayed once. Rows show local Time, Quantity, Cost / gram, stored Fees, and fee-inclusive Total cost. Each row is keyboard/click selectable and opens the purchase editor, prefilled with purity, local date/time, quantity, cost, fees, derived subtotal/total cost, optional paid-from account, and notes. Save calls `correct_metal_purchase`; Delete opens the shared confirmation and calls `reverse_metal_purchase`. The overflow action has the same Edit and Delete behavior without opening the row. Successful edits/deletes reload history and account values. The mobile layout keeps the five history values in one compact row per purchase with a single column-label row rather than repeated labels. Per-purchase Current value is intentionally omitted because the page-level summary already derives it from the purity-adjusted live current price. Gold uses karat/24; Silver uses the stored decimal fineness. `other` has no assumed fineness, so its current price and current value are unavailable while its quantity and historical cost remain visible.

The web client reloads effective metal purchases after a successful RPC call. These records remain the source of truth for purchase quantities and historical costs; purchase reversals and corrections are represented by immutable lifecycle events rather than updating or deleting historical rows. Current values are derived at read time from those effective quantities and the shared live metal-price service. Each layer has loading, error, and empty states as applicable.

Brokerage Holding Details also resolves the current price through the shared `MarketDataService` via `PortfolioValuationService`. It displays the asset-currency Current Price and decimal-safe Market Value (`quantity × current price`), with explicit stale and unavailable states and no fallback to cost basis. For cross-currency Brokerage accounts, it displays an additional account-currency market value only when the existing current-FX conversion succeeds; otherwise it keeps the asset-currency Market Value and reports that account-currency valuation is unavailable. It does not display unrealized P/L or change Brokerage account totals. Brokerage Account Details uses the shared `resolveBrokerageCurrentValue` path: Available Cash plus positively held assets converted into the account currency. A zero-holding Brokerage account therefore equals Available Cash; any missing market price or FX makes Current Value unavailable rather than partial or silently zero.

Brokerage Holding Details and the Brokerage holdings list also show holding-level Unrealized P/L and Unrealized P/L % from the same shared valuation snapshot. Unrealized P/L is current market value minus current cost basis, and the percentage is P/L divided by current cost basis times 100; both use the account-currency valuation basis and remain unavailable when current price or required FX is unavailable. Brokerage Account Details additionally shows Total Unrealized P/L and Total Unrealized P/L %, aggregated from the same positive-holding valuation results using total current cost basis; the percentage is unavailable when that basis is not positive. Missing price or FX makes both totals unavailable. No realized P/L is shown.

Brokerage Account Details supports same-currency Dividend posting for a positive holding. Cash Dividend accepts gross dividend, optional withholding tax and fees (both default zero), date/time, and notes. The atomic `add_brokerage_cash_dividend` RPC posts Net Dividend (`gross - tax - fees`) only when it is positive; it credits the same Brokerage Available Cash while recording zero quantity and zero cost-basis effects, so holdings and unrealized P/L are unchanged. Full **Reinvest Dividend** accepts the same fields plus a positive reinvestment unit price; it posts the entire positive Net Dividend into the same holding, increasing quantity by `net / unit price` and cost basis by Net Dividend without changing Available Cash. **Partial Reinvest** additionally accepts a positive reinvested amount that must be less than Net Dividend; it increases the holding by `reinvested amount / unit price`, increases cost basis by the reinvested amount, and credits only the remaining Net Dividend cash. Both modes reject cross-currency assets clearly. Activity shows Dividend, Dividend Reinvested, or Dividend Partially Reinvested with relevant user-facing details; reinvested activity reads its stored reinvestment entry for unit price and added quantity. Cross-currency dividends are not supported.

Brokerage Details also offers a Buy action backed by `add_brokerage_buy`. It selects an existing catalog asset and accepts canonical quantity, asset-currency unit price, optional asset-currency fees, local date/time, notes, and an explicit historical FX rate only when the asset and Brokerage currencies differ. The Buy dialog also offers a debounced authenticated external symbol/name search requiring at least two characters and the same optional separate native, non-searchable Country dropdown as Add Existing Holding. Search results show symbol, display exchange, country, currency, and instrument type; selecting a result explicitly resolves its MIC-plus-symbol identity through `resolve_external_brokerage_asset`, reuses or creates the visible catalog asset, and selects that asset without creating a holding or ledger activity. Provider and resolution failures remain non-blocking, and the existing catalog picker remains available. A decimal-safe preview shows purchase amount, fees, and required Brokerage cash; Available Cash is guidance only and the RPC remains authoritative. Successful Buys refresh Available Cash and holdings. Holding history includes posted Buy entries as non-editable, non-deletable activity alongside Existing Holding lifecycle rows. Buy rows label their per-unit amount as Unit price, show non-zero asset-currency fees, and show the fee-inclusive account-currency cost effect; historical FX is shown only for cross-currency Buys.

## 7. Number formatting & decimal safety (critical — apply throughout)

**All monetary and quantity values must be handled as decimal strings end-to-end** (network payloads, form state, calculations, display) — never native floats — to avoid precision loss. The web app uses a custom bigint-based decimal library (`add/subtract/multiply/divideDecimals`, `compareDecimals`, `normalizeDecimal`). Port an equivalent (e.g. a decimal/bignum library) to mobile.

Display formatting:

- Amounts render as `"{CURRENCY_CODE} {formatted number}"` (e.g. `"USD 1,234.56"`) — **not** a currency symbol, always the ISO code prefix.
- Grouping/decimal separators and digit glyphs are locale-aware (Arabic-Indic digits in `ar` locale), but **numeric text is always displayed left-to-right** (`dir="ltr"`) even inside an RTL (Arabic) page layout — mobile must force LTR writing direction for all numeric/currency/date fields regardless of the app's overall RTL state.

## 8. i18n / RTL

- All copy is looked up via `t("accounts.*")` translation keys (~125 keys), defined in parallel in `src/i18n/en/translations.ts` and `src/i18n/ar/translations.ts`. Port these keys 1:1 to the mobile string catalog so translations can be shared.
- The whole feature is RTL-aware via CSS logical properties (start/end rather than left/right) — mobile should use equivalent RTL-aware layout (React Native flexbox auto-flips with `I18nManager.isRTL`; manually-positioned elements like a trailing "%" suffix need explicit RTL handling).
- Numeric fields always force LTR display (see §7) — this is a deliberate, must-replicate pattern.

## 9. Notable quirks / deviations to decide on deliberately (do not silently "fix")

1. **Gold/silver accounts are singleton-per-currency** and always auto-named "Gold"/"Silver".
2. **Gold account `openingBalance` is always `"0"`** on create/update — real balance only accrues via metal purchases.
3. **Weighted-average cost formula** excludes fees; must be replicated exactly (§2.3 step 5).
4. **"Restore" is effectively broken** in the current web app (§6.3) — recommend fixing on mobile, but note the deviation.
5. **The gold/silver singleton-per-currency unique index does not exclude archived (`is_active = false`) accounts.** Archiving a Gold or Silver account permanently occupies its `(user_id, currency_code, metal_type)` slot for that user — creating a new one in the same currency fails with the same friendly duplicate-account message as a genuine duplicate, and the only way out is to restore the archived account (currently broken, see #4) or delete it (only possible if it has no purchase history) or use a different currency. This is a known rough edge, not yet resolved at the schema level.
6. Cash and Bank values are ledger-adjusted through `get_account_balances`. Active Brokerage accounts also have a ledger-projected Available Cash balance for shared financial reads, while the Accounts list still displays raw `opening_balance` until Brokerage holdings aggregation is introduced; other non-metal account types display raw `opening_balance`.
7. A `"deposit"` account type appears in one funding-account filter but is **not a real type** — dead code; only `cash`/`bank` are valid metal-purchase funding sources.
8. **Metal purchase fees are hardcoded to `"0"`** from the client — no fee input UI exists yet, despite full schema/RPC support. Adding it on mobile is net-new, not parity.
9. Gold/silver historical totals are calculated from immutable purchase records with decimal-safe helpers. Current values combine those immutable quantities with the shared XAU/XAG live price-per-gram path and never fall back to historical cost. The RPC's account-shaped response is not a purchase-history payload and must not be used to render the history.
10. Currency set is a fixed 5-item enum (`USD, SAR, EGP, EUR, GBP`), enforced at both DB and schema level — not user-extensible from this feature today.
