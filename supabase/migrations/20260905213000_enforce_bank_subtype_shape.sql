-- Bank accounts must be explicitly classified as Debit or Credit, while
-- every non-bank account must keep bank_subtype null.

alter table public.financial_accounts
  add constraint financial_accounts_bank_subtype_shape_check
  check (
    (
      account_type_code = 'bank'
      and bank_subtype is not null
      and bank_subtype in ('debit', 'credit')
    )
    or (
      account_type_code <> 'bank'
      and bank_subtype is null
    )
  ) not valid;

alter table public.financial_accounts
  validate constraint financial_accounts_bank_subtype_shape_check;

alter table public.financial_accounts
  drop constraint financial_accounts_bank_subtype_check;

alter table public.financial_accounts
  rename constraint financial_accounts_bank_subtype_shape_check
  to financial_accounts_bank_subtype_check;
