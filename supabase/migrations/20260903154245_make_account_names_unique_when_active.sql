-- Non-metal account names are unique only while the account is active.
-- Gold/Silver uniqueness remains unchanged.

drop index public.financial_accounts_non_metal_user_name_lower_key;

create unique index financial_accounts_non_metal_user_name_lower_key
  on public.financial_accounts (user_id, lower(btrim(name)))
  where account_type_code <> 'gold' and is_active;

create or replace function public.reopen_financial_account(p_account_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_account public.financial_accounts%rowtype;
begin
  select * into v_account from public.financial_accounts
  where id = p_account_id and user_id = auth.uid() for update;
  if not found then raise exception 'account not found' using errcode = 'P0002'; end if;
  if v_account.closed_reason = 'sold' then
    raise exception 'account_reopen_blocked:sold_account' using errcode = '23514';
  end if;
  perform pg_catalog.set_config('tharwati.account_lifecycle_rpc', 'on', true);
  update public.financial_accounts set is_active = true where id = p_account_id;
  return p_account_id;
end;
$$;

revoke all on function public.reopen_financial_account(uuid) from public, anon;
grant execute on function public.reopen_financial_account(uuid) to authenticated;

comment on function public.reopen_financial_account(uuid) is
  'Reopens an owned Closed account. The active-only non-metal name index rejects conflicts with another active account.';
