# Accounts Tab — Data & Logic Spec (for Mobile Reimplementation)

This document describes the **data model, business logic, validation, and UI/UX flow** of the web app's "Accounts" tab (`src/features/accounts/`), so it can be reimplemented for mobile with behavioral parity. Field names below are given in both DB (snake_case) and client (camelCase) form where relevant.

## 1. Feature overview

The Accounts tab manages a single polymorphic table, `financial_accounts`, representing **7 account types**: `cash`, `bank`, `brokerage`, `gold` (covers both gold and silver), `real_estate`, `business`, `other`. Gold/silver accounts have a companion append-only history table, `metal_purchases`, and a dedicated RPC (`add_metal_purchase`) that both records a purchase and updates the parent account's running weighted-average cost/balance.

Related-but-separate features that share the same table (context only, not part of this tab):

- `src/features/cash-accounts/` — a simplified, cash-only accounts page. Uses ledger-adjusted `current_balance` (via `account-balances` RPC) instead of raw `opening_balance`. **Not i18n-driven** (hardcoded English), unlike this tab.
- `src/features/account-balances/` — RPC-driven ledger balance read model (`get_account_balances`). Not used by this tab today (see §9 quirk).

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
- `metal_type` is **required** when `account_type_code = 'gold'`, and must be `null` otherwise.
- Purity enum depends on `metal_type`: gold → `24k,22k,21k,18k,14k,10k,9k,other`; silver → `999,958,950,925,900,835,800,other`.

Uniqueness:

- **Non-metal accounts**: unique on `(user_id, lower(trim(name)))` where `account_type_code <> 'gold'` — case-insensitive unique name per user.
- **Gold/silver accounts**: unique on `(user_id, currency_code, metal_type)` where `account_type_code = 'gold'` — **only one Gold and one Silver account per currency, per user.** This is why gold/silver accounts are always auto-named "Gold"/"Silver" and the name field is hidden in the form.

RLS: standard per-user CRUD (`auth.uid() = user_id`).

Triggers (immutability guards once financial history exists):

- Changing `currency_code` on an account with existing `transaction_entries` raises Postgres error `23514` ("This account already contains financial history. Its currency cannot be changed.").
- Changing `opening_balance` similarly raises `23514` for opening balance.
- **Current caveat**: `getAccountDeletionEligibility()` in the repository always returns `hasFinancialHistory: false` today (this deployment has no populated ledger), so these locked-field UI states never actually trigger yet — but the UI pattern (read-only field + explanatory caption) should still be built for forward compatibility.

`account_types` reference table (seed data only, not queried dynamically by the client — types are hardcoded client-side):
`cash, bank, brokerage, gold, real_estate, business, other`.

### 2.2 `metal_purchases` table (append-only purchase history)

```sql
create table public.metal_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.financial_accounts (id) on delete cascade,
  purity text not null,
  purchased_at date not null,
  quantity_grams numeric(20, 3) not null,     -- check: > 0
  cost_per_unit numeric(20, 2) not null,      -- check: > 0
  fees numeric(20, 2) not null default 0,     -- check: >= 0
  funding_mode text not null,                 -- 'external' | 'cash_account'
  funding_account_id uuid references public.financial_accounts (id) on delete set null,
  created_at timestamptz not null default now()
)
```

- `funding_account_id` required if and only if `funding_mode = 'cash_account'`.
- RLS: **select + insert only** — no update/delete policy. Purchase records are immutable from the client once created.

### 2.3 `add_metal_purchase` RPC — the core "buy more gold/silver" transaction

```
add_metal_purchase(
  p_account_id uuid, p_purity text, p_occurred_at timestamptz,
  p_quantity_grams numeric, p_cost_per_unit numeric,
  p_funding_mode text, p_funding_account_id uuid, p_fees numeric
) returns financial_accounts
```

Logic (must be replicated exactly, either by calling this same RPC from mobile or reimplementing the equivalent server logic):

1. Requires authenticated user; locks (`FOR UPDATE`) the target account — must be an active, owned, `account_type_code = 'gold'` account with a valid `metal_type`.
2. Validates `quantity_grams > 0`, `cost_per_unit > 0`, `fees >= 0`, and `purity` against the metal-specific enum.
3. `total = quantity_grams * cost_per_unit`; `payment_total = total + fees`.
4. **Funding**:
   - `funding_mode = 'cash_account'`: funding account must be active, owned, type `cash` or `bank`, **same currency** as the gold account, and have `opening_balance >= payment_total`. Debits the funding account: `opening_balance -= payment_total`.
   - `funding_mode = 'external'`: no debit; `funding_account_id` forced to `null`.
5. **Weighted-average cost update** (core valuation formula):
   ```
   new_balance_grams   = old_balance_grams + quantity_grams
   new_cost_per_unit    = (old_balance_grams * old_cost_per_unit + total) / new_balance_grams
   ```
   Note: **fees are excluded from the cost-basis average** (only affect the cash debit), even though they reduce the funding account's balance.
6. Updates the account: `balance_grams`, `cost_per_unit` (both per formula above), `purity` and `purchase_date` are overwritten with the latest purchase's values.
7. Inserts an immutable `metal_purchases` row with the original (non-averaged) purchase details.
8. Client always sends `p_fees: "0"` today — **there is no fee input field in the UI**, even though schema/RPC/table fully support fees. Adding fee UI on mobile would be a net-new feature, not parity.

### 2.4 TypeScript domain types

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
- `bank`: `openingBalance` + `bankSubtype`.
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
  paidFromAccount: boolean
  fundingAccountId: string
}
// getMetalPurchaseTotal(values) = multiplyDecimals(unitsGrams, costPerUnit)  — live preview, excludes fees
```

## 3. Validation rules

Per-type, on submit (Zod schema, errors shown only after first submit attempt):

| Type                    | Required / validated fields                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `cash`, `other`         | `openingBalance` — pattern `^\d{1,18}(\.\d{1,2})?$`                                              |
| `bank`                  | above + `bankSubtype` required                                                                   |
| `brokerage`             | above + `investmentType` required                                                                |
| `real_estate`           | above + `ownershipPercentage` (pattern `^\d{1,3}(\.\d{1,2})?$`, ≤ 100) + `propertyType` required |
| `business`              | above + `ownershipPercentage` + `businessType` required + `industry` required                    |
| `gold`                  | `metalType` required only (no balance field shown)                                               |
| all types except `gold` | `name` required                                                                                  |

Metal purchase form:

- `purity` — must be a valid option for the account's `metalType`.
- `purchaseDate` — required.
- `unitsGrams` — pattern `^\d{1,18}(\.\d{1,3})?$`, must be `> 0`.
- `costPerUnit` — pattern `^\d{1,18}(\.\d{1,2})?$`, must be `> 0`.
- `fundingAccountId` — required only if `paidFromAccount = true`.

## 4. Business logic (create/update/archive/delete)

- **Create**: for `gold`-type accounts, `name` is force-set to `"Silver"` if `metalType === "silver"`, else `"Gold"` (ignores any user input, since the field is hidden). If the form's `isActive` is `false`, creation requires a create-then-immediately-update round trip (insert always creates active, then a second call sets `is_active = false`).
- **Update**: same name-forcing logic for gold accounts; otherwise updates all provided fields.
- **Archive**: soft-deactivate only — `updateAccount(id, { isActive: false })`. There is **no separate DB flag**; archived = `is_active = false`.
- **Delete**: hard delete, gated by `getAccountDeletionEligibility()` (currently a no-op stub always returning `canDelete: true`).
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
  getAccountDeletionEligibility(ids): Promise<AccountDeletionEligibility[]> // stub: always canDelete:true
  deleteAccount(id): Promise<void> // throws constraint_violation if ineligible
}

class MetalPurchasesRepository {
  addPurchase(accountId, values: MetalPurchaseFormValues): Promise<void> // calls RPC add_metal_purchase
  getPurchaseHistoryRows(accountIds): Promise<MetalPurchaseRecord[]> // reads metal_purchases, ordered by purchased_at desc, created_at desc
}
```

Purchase-history numeric columns are requested with `::text` casts, then normalized from either a text or finite numeric Supabase response into validated decimal strings before any totals are calculated. The deployed RPC returns the updated `financial_accounts` row; the client ignores that response and reloads immutable `metal_purchases` records for history.

`CreateAccountInput`/`UpdateAccountInput`: camelCase mirror of the type-specific DB columns (`accountTypeCode, name, currencyCode, openingBalance, notes, bankSubtype, investmentType, balanceGrams, propertyType, ownershipPercentage, businessType, industry, metalType, purity, purchaseDate, costPerUnit`, plus `isActive` on update).

Error handling: Postgres errors are normalized into a `RepositoryError { code, operation, details?, hint? }`, where `code` is one of `database_error | constraint_violation | conflict | not_found | forbidden`, mapped from Postgres codes (`23503→constraint_violation, 23505→conflict, 23514→constraint_violation, 42501→forbidden, PGRST116→not_found`). Note: a duplicate-name violation surfaces as a generic `conflict` with no bespoke friendly message today — design proper mobile-side copy for this case (e.g. "An account with this name already exists").

## 6. UI / UX flow

### 6.1 Page states

1. **Loading** — skeleton placeholders.
2. **Hard error** (error + zero accounts) — icon + message + "Try again".
3. **Normal** — header with "Add account" CTA, optional non-blocking inline error banner if accounts exist despite an error, filter bar, then either an **empty state** (no accounts at all, or none match filters — same copy either way) or the account list/table.

### 6.2 Filtering & sorting (all client-side, over the full loaded account list)

Filters: `search` (case-insensitive substring on name), `type` (exact match), `currency` (exact match; options are derived dynamically from currencies actually present, not the full static enum), and **Show Archived**. Show Archived defaults off and shows active accounts only; when on, it includes both active and archived accounts.

Sort columns: `name | type | balance` — string columns use locale compare, `balance` sorts numerically on `currentBalance ?? balance_grams ?? 0`. Clicking the active sort column flips direction; picking a new column resets to ascending.

**Displayed "balance"**: for non-gold accounts this is the raw `opening_balance` column — **not** a ledger-adjusted current balance (there's no transaction-effect calculation on this page, unlike the related `cash-accounts` feature). For gold/silver accounts this is the total purchase value, derived with decimal-safe `quantity_grams * cost_per_unit` across that account's `metal_purchases`; quantity is not shown at this layer.

### 6.3 List/table row content

Name, type label (for gold accounts, shows "Gold"/"Silver" from `metal_type` rather than the generic type label), balance (per §6.2, including its currency code), and ownership % (real_estate/business only, else "—"). Currency and status are not table columns.

Row actions:

- **View purchases** (gold accounts only) → opens purchase history dialog.
- **Add purchase** (active gold accounts only) → opens metal purchase dialog.
- **Edit** (always) → opens account form dialog in edit mode.
- **Archive/Restore** (icon+label toggles based on `is_active`) → opens confirm dialog.
- **Delete** (always visible, disabled when ineligible — currently never disabled) → opens confirm dialog.

For non-gold accounts, selecting the account name opens a read-only Account Records details layer. It loads the existing `financial_transactions` joined through matching `transaction_entries.account_id`, ordered newest first, and shows date, description/type, and amount. The fetch and mapping live in the Accounts repository/service (`account-records.repository` and `account-records.service`) rather than the React dialog, so the same transaction-record layer can be reused by mobile clients. Gold/Silver keeps its dedicated three-layer flow in §6.7.

> **Known web-app bug to decide on for mobile**: the "Restore" action for an archived account reuses the _same_ archive confirmation flow and repository call (`archiveAccount`, which always sets `is_active: false`) — so restoring currently does nothing (no-op). There is no working un-archive path in the current app despite the UI implying one. **Recommendation**: fix this on mobile with a distinct `restoreAccount = updateAccount(id, {isActive: true})` call and matching "Restore this account?" dialog copy, but be aware this is a deliberate deviation from current web behavior.

### 6.4 Create/edit flow (form dialog)

- **Create mode**: two-step — (1) a type picker (radio-group grid of 7 type cards with icon+label), (2) the form itself, pre-seeded with the chosen type.
- **Edit mode**: skips the type picker; type is effectively immutable from the UI once created.
- Field visibility/labels are conditional on `accountTypeCode` exactly as described in §2.5/§3.
- Balance field label varies by type: `brokerage` → "Starting cash balance"; `real_estate`/`business` → "Current value"; `cash`/`bank`/`other` → "Starting balance"; hidden entirely for `gold`.
- "Active account" toggle shown for all types except `gold` (gold accounts can't be created inactive from this form).
- Locked-field states (currency/opening balance read-only with explanatory caption) exist in the UI for when `hasFinancialHistory` is true — currently never triggered live (see §2.1 caveat), but should be built for forward compatibility.
- Validation errors only render after the first submit attempt, then update live.
- Closing a dirty form should prompt an "unsaved changes" confirmation.

### 6.5 Archive / Delete confirm dialogs

Simple modal: title interpolating account name, description, Cancel + destructive/warning confirm button (disabled + "…ing" label while in flight).

### 6.6 Add metal purchase dialog

Fields: `purity` (options depend on account's `metal_type`), `purchaseDate`, `unitsGrams`, `costPerUnit`, a "Paid from" toggle revealing a funding-account picker (active `cash`/`bank` accounts only) when checked, and a live read-only "Total amount" = `unitsGrams * costPerUnit` (fees excluded from this preview since there's no fee field).

### 6.7 Metal purchase history dialog

The history flow has three transaction-derived layers:

1. **Account list** — Gold/Silver, currency, and total value only.
2. **Purity summary** — opening a metal account shows a horizontally scrollable, responsive table with one header row: **Purity | Total quantity | Total value**. Each selectable purity row shows only those values; it does not list individual purchases.
3. **Purity transactions** — opening a purity shows a compact responsive table, newest first, with one header row: **Date | Quantity | Cost per unit | Total amount**. Each purchase is one row; field labels are not repeated in every row. Dates are displayed as `DD-MM-YYYY` without changing their stored value. The table fits its modal on desktop and wraps compact cells on mobile without horizontal scrolling.

The web client reloads `metal_purchases` after a successful RPC call. These records are the source of truth for every displayed aggregate; purchases are never merged or persisted as a summary. Each layer has loading, error, and empty states as applicable.

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
5. **Delete eligibility / locked-field checks are stubbed to always pass** today — the DB-level immutability triggers exist but never fire in this deployment (no populated ledger yet). Build the UI pattern anyway for forward compatibility.
6. **The Accounts tab's balance column is the raw `opening_balance`**, not a ledger-adjusted current balance — this differs from the separate `cash-accounts` feature, which does compute a ledger-adjusted balance via the `get_account_balances` RPC. Recommend matching today's Accounts-tab behavior (raw `opening_balance`) for parity, but flag this inconsistency to the team.
7. A `"deposit"` account type appears in one funding-account filter but is **not a real type** — dead code; only `cash`/`bank` are valid metal-purchase funding sources.
8. **Metal purchase fees are hardcoded to `"0"`** from the client — no fee input UI exists yet, despite full schema/RPC support. Adding it on mobile is net-new, not parity.
9. Gold/silver totals are calculated from immutable purchase records with decimal-safe helpers. The RPC's account-shaped response is not a purchase-history payload and must not be used to render the history.
10. Currency set is a fixed 5-item enum (`USD, SAR, EGP, EUR, GBP`), enforced at both DB and schema level — not user-extensible from this feature today.
