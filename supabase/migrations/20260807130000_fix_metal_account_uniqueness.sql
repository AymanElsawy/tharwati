alter table public.financial_accounts
  add column metal_type text;

update public.financial_accounts
set metal_type = case
  when lower(btrim(name)) = 'silver' then 'silver'
  else 'gold'
end
where account_type_code = 'gold';

drop index if exists public.financial_accounts_user_name_lower_key;

create unique index financial_accounts_non_metal_user_name_lower_key
  on public.financial_accounts (user_id, lower(btrim(name)))
  where account_type_code <> 'gold';

create unique index financial_accounts_user_currency_metal_type_key
  on public.financial_accounts (user_id, currency_code, metal_type)
  where account_type_code = 'gold';

alter table public.financial_accounts
  add constraint financial_accounts_gold_metal_type_required_check check (
    (account_type_code = 'gold' and metal_type in ('gold', 'silver'))
    or (account_type_code <> 'gold' and metal_type is null)
  );
