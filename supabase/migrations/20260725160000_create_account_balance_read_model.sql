create index transaction_entries_account_cash_effect_idx
on public.transaction_entries (account_id, transaction_id)
include (entry_side, account_amount)
where asset_id is null;

create or replace function public.get_account_balances(
  p_account_ids uuid[] default null
)
returns table (
  account_id uuid,
  account_type_code text,
  account_name text,
  currency_code text,
  is_active boolean,
  opening_balance text,
  ledger_effect text,
  current_balance text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    accounts.id as account_id,
    accounts.account_type_code,
    accounts.name as account_name,
    accounts.currency_code,
    accounts.is_active,
    accounts.opening_balance::text,
    coalesce(
      sum(
        case entries.entry_side
          when 'debit' then entries.account_amount
          when 'credit' then -entries.account_amount
        end
      ) filter (where transactions.status = 'posted'),
      0::numeric
    )::text as ledger_effect,
    (
      accounts.opening_balance
      + coalesce(
          sum(
            case entries.entry_side
              when 'debit' then entries.account_amount
              when 'credit' then -entries.account_amount
            end
          ) filter (where transactions.status = 'posted'),
          0::numeric
        )
    )::text as current_balance
  from public.financial_accounts as accounts
  left join public.transaction_entries as entries
    on entries.account_id = accounts.id
    -- Asset-side entries drive holdings; only account-side entries change cash.
    and entries.asset_id is null
  left join public.financial_transactions as transactions
    on transactions.id = entries.transaction_id
    and transactions.user_id = accounts.user_id
  where accounts.user_id = (select auth.uid())
    and (
      p_account_ids is null
      or accounts.id = any(p_account_ids)
    )
  group by
    accounts.id,
    accounts.account_type_code,
    accounts.name,
    accounts.currency_code,
    accounts.is_active,
    accounts.opening_balance;
$$;

comment on function public.get_account_balances(uuid[]) is
  'Returns authenticated-user account balances as opening balance plus posted account-side ledger effects. Draft rows are ignored, deleted rows are absent, asset-side holding effects are excluded, and exact account-currency numerics are preserved.';

revoke all on function public.get_account_balances(uuid[]) from public;
revoke all on function public.get_account_balances(uuid[]) from anon;
revoke all on function public.get_account_balances(uuid[]) from authenticated;
grant execute on function public.get_account_balances(uuid[]) to authenticated;
