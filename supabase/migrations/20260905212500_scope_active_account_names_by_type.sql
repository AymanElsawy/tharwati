-- Active non-metal names may repeat across distinct user-facing account types.
-- Bank subtype participates because Debit and Credit are distinct account types in the UI.

drop index public.financial_accounts_non_metal_user_name_lower_key;

create unique index financial_accounts_non_metal_user_name_lower_key
  on public.financial_accounts (
    user_id,
    lower(btrim(name)),
    account_type_code,
    coalesce(bank_subtype, '')
  )
  where account_type_code <> 'gold' and is_active;

comment on function public.reopen_financial_account(uuid) is
  'Reopens an owned Closed account. Active non-metal name conflicts are scoped to the same account type, including Bank subtype.';
