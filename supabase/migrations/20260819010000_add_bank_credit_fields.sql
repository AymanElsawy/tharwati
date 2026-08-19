alter table public.financial_accounts
  add column credit_card_limit numeric(20, 2),
  add column due_day_of_month integer;

alter table public.financial_accounts
  add constraint financial_accounts_credit_card_limit_positive_check
    check (credit_card_limit is null or credit_card_limit > 0),
  add constraint financial_accounts_due_day_of_month_range_check
    check (due_day_of_month is null or due_day_of_month between 1 and 31),
  add constraint financial_accounts_bank_credit_available_balance_check
    check (
      credit_card_limit is null
      or (opening_balance >= 0 and opening_balance <= credit_card_limit)
    ),
  add constraint financial_accounts_bank_credit_fields_check
    check (
      (credit_card_limit is null and due_day_of_month is null)
      or (account_type_code = 'bank' and bank_subtype = 'credit')
    );

comment on column public.financial_accounts.credit_card_limit is
  'Optional credit limit used only by bank credit accounts.';

comment on column public.financial_accounts.due_day_of_month is
  'Optional statement due day from 1 through 31, used only by bank credit accounts.';
