create or replace function public.prevent_account_currency_change_after_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency_code is distinct from old.currency_code
    and exists (
      select 1
      from public.transaction_entries as entries
      where entries.account_id = old.id
    )
  then
    raise exception
      'This account already contains financial history. Its currency cannot be changed.'
      using
        errcode = '23514',
        constraint =
          'financial_accounts_currency_immutable_after_history_check';
  end if;

  return new;
end;
$$;

comment on function public.prevent_account_currency_change_after_history() is
  'Preserves the denomination of historical ledger amounts by rejecting currency changes after the first account ledger entry. SECURITY DEFINER and an empty search_path ensure the history check cannot be weakened by caller RLS or object shadowing.';

revoke all on function public.prevent_account_currency_change_after_history()
  from public, anon, authenticated;

create trigger financial_accounts_10_prevent_currency_change_after_history
before update of currency_code on public.financial_accounts
for each row
execute function public.prevent_account_currency_change_after_history();
