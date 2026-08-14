-- Simplify accounts to a fixed 7-type taxonomy and add type-specific fields.
-- Confirmed with product owner: no real financial_accounts data exists yet,
-- so existing rows (and any dependents) are cleared before dropping the
-- retirement/deposit account types.

delete from public.transaction_entries;
delete from public.financial_transactions;
delete from public.holdings;
delete from public.financial_accounts;

delete from public.account_types where code in ('retirement', 'deposit');

alter table public.financial_accounts
  add column bank_subtype text,
  add column investment_type text,
  add column balance_grams numeric(20, 3),
  add column property_type text,
  add column ownership_percentage numeric(5, 2),
  add column business_type text,
  add column industry text;

alter table public.financial_accounts
  add constraint financial_accounts_bank_subtype_check
    check (
      bank_subtype is null
      or (account_type_code = 'bank' and bank_subtype in ('debit', 'credit'))
    ),
  add constraint financial_accounts_investment_type_check
    check (
      investment_type is null
      or (
        account_type_code = 'brokerage'
        and investment_type in ('stock_etf', 'crypto', 'other')
      )
    ),
  add constraint financial_accounts_balance_grams_check
    check (
      balance_grams is null or account_type_code = 'gold'
    ),
  add constraint financial_accounts_property_type_check
    check (
      property_type is null
      or (
        account_type_code = 'real_estate'
        and property_type in ('apartment', 'villa', 'land', 'office', 'other')
      )
    ),
  add constraint financial_accounts_ownership_percentage_check
    check (
      ownership_percentage is null
      or (
        account_type_code in ('real_estate', 'business')
        and ownership_percentage between 0 and 100
      )
    ),
  add constraint financial_accounts_business_type_check
    check (
      business_type is null or account_type_code = 'business'
    ),
  add constraint financial_accounts_industry_check
    check (
      industry is null or account_type_code = 'business'
    );
