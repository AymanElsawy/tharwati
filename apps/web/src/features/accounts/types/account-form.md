# Account form

## Purpose

Defines account-form option lists, form values, defaults, display helpers, and conversion of form data into account-type-specific fields.

## Types and interfaces

- `AccountTypeCode`: one of the configured account type codes.
- `AccountFormValues`: all editable form values, stored mostly as strings.
- `AccountTypeSpecificFields`: normalized fields for persistence; non-applicable type-specific values are `null`, while `openingBalance` starts as `undefined`.

## Supported account types

`cash`, `bank`, `brokerage`, `gold`, `real_estate`, `business`, and `other`.

## Fields

- `name`: account name.
- `accountTypeCode`: selected account type.
- `currencyCode`: currency (`USD`, `SAR`, `EGP`, `EUR`, or `GBP`).
- `openingBalance`: starting balance; for gold accounts it is derived from metal quantity and cost per unit.
- `bankSubtype`: `debit` or `credit` for bank accounts.
- `investmentType`: `stock_etf`, `crypto`, or `other` for brokerage accounts.
- `balanceGrams`, `metalType`, `purity`, `purchaseDate`, `costPerUnit`: metal-account details. Metal type is `gold` or `silver`.
- `propertyType`, `ownershipPercentage`: real-estate details. Property type is `apartment`, `villa`, `land`, `office`, or `other`.
- `businessType`, `industry`, `ownershipPercentage`: business details.
- `notes`: free-form notes.
- `isActive`: active-status flag.

## Type-specific output

`toAccountTypeSpecificFields` returns only the applicable values:

- `cash`, `other`: `openingBalance`.
- `bank`: `openingBalance`, `bankSubtype`.
- `brokerage`: `openingBalance`, `investmentType`.
- `gold`: calculated `openingBalance`, plus metal fields.
- `real_estate`: `openingBalance`, `propertyType`, `ownershipPercentage`.
- `business`: `openingBalance`, `businessType`, `industry`, `ownershipPercentage`.

## Validation and business rules

- Values emitted by `toAccountTypeSpecificFields` are trimmed; optional text/select fields become `null` when empty.
- A gold account's opening balance is `costPerUnit * balanceGrams`, using `multiplyDecimals`; empty operands are treated as `"0"`.
- Purity options depend on metal type: gold has `24k` through `9k`, silver has `999` through `800`, and both allow `other`.
- Balance label selection: brokerage uses the starting-cash-balance label; real estate and business use the current-value label; all others use the starting-balance label.
- This file defines option sets and conversions, but no general required-field, numeric-range, date, or ownership-percentage validation.

## Defaults

New forms default to cash, USD, opening balance `"0"`, grams `"0"`, ownership `"100"`, cost per unit `"0"`, blank optional fields/notes, and `isActive: true`.

## Important dependencies

- `AccountSummary`: source type used by `accountToFormValues` to populate the form.
- `multiplyDecimals`: decimal multiplication used for a metal account's total amount.
- `Translate`: translation-function type used by `getAccountTypeLabel`.

## Needs verification

- The account type is named `gold`, but its metal-specific options also support silver.
- `accountToFormValues` casts stored account and currency codes to form unions instead of checking that they are supported.
