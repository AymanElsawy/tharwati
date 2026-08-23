-- The function argument is intentionally still named transaction_id because
-- authenticated clients invoke this RPC with that parameter name.
create or replace function public.post_transaction(transaction_id uuid)
returns public.financial_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction public.financial_transactions%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_transaction
  from public.financial_transactions as transactions
  where transactions.id = post_transaction.transaction_id
    and transactions.user_id = v_user_id
    and transactions.status = 'draft'
  for update;
  if not found then
    raise exception 'owned draft transaction does not exist' using errcode = 'P0002';
  end if;

  perform public.assert_account_record_transaction_balanced(v_transaction.id);

  update public.financial_transactions as transactions
  set status = 'posted'
  where transactions.id = v_transaction.id
  returning * into v_transaction;

  if exists (
    select 1
    from public.transaction_entries as entries
    where entries.transaction_id = v_transaction.id
      and entries.asset_id is not null
  ) then
    perform public.rebuild_holding_projection(v_user_id);
  end if;

  return v_transaction;
end;
$$;

grant execute on function public.post_transaction(uuid) to authenticated;
