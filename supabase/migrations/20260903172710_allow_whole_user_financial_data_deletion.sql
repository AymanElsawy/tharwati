-- Preserve immutable financial history during normal operation while allowing
-- PostgreSQL's auth.users cascade to remove an entire user's data graph.

create or replace function public.prevent_posted_account_record_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'posted'
    and not (
      tg_op = 'DELETE'
      and not exists (
        select 1 from auth.users where id = old.user_id
      )
    ) then
    raise exception 'posted transaction % is immutable', old.id
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

comment on function public.prevent_posted_account_record_changes() is
  'Rejects posted transaction updates and direct deletes while the owning Auth user exists. DELETE is permitted only after auth.users parent deletion has begun its cascade.';

create or replace function public.prevent_posted_account_record_entry_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_op = 'DELETE' and not exists (
    select 1 from auth.users where id = old.user_id
  ) then
    return old;
  end if;

  select status into v_status
  from public.financial_transactions
  where id = coalesce(new.transaction_id, old.transaction_id)
  for update;

  if v_status = 'posted' then
    raise exception 'entries of posted transaction are immutable'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

comment on function public.prevent_posted_account_record_entry_changes() is
  'Rejects mutations of posted transaction entries while the owning Auth user exists. DELETE is permitted only during auth.users cascade or after the parent transaction has already cascaded.';

revoke all on function public.prevent_posted_account_record_changes()
  from public, anon, authenticated;
revoke all on function public.prevent_posted_account_record_entry_changes()
  from public, anon, authenticated;

-- Cross-links inside one user-owned history graph must wait until the complete
-- auth.users cascade has run. NO ACTION remains fully enforced at transaction
-- end, so deleting any referenced history row on its own still fails.
alter table public.transaction_entries
  drop constraint transaction_entries_account_id_fkey,
  add constraint transaction_entries_account_id_fkey
    foreign key (account_id) references public.financial_accounts (id)
    on delete no action deferrable initially deferred;

alter table public.transaction_entries
  drop constraint transaction_entries_asset_id_fkey,
  add constraint transaction_entries_asset_id_fkey
    foreign key (asset_id) references public.assets (id)
    on delete no action deferrable initially deferred;

alter table public.financial_transactions
  drop constraint financial_transactions_reverses_transaction_id_fkey,
  add constraint financial_transactions_reverses_transaction_id_fkey
    foreign key (reverses_transaction_id) references public.financial_transactions (id)
    on delete no action deferrable initially deferred,
  drop constraint financial_transactions_corrects_transaction_id_fkey,
  add constraint financial_transactions_corrects_transaction_id_fkey
    foreign key (corrects_transaction_id) references public.financial_transactions (id)
    on delete no action deferrable initially deferred;

alter table public.record_categories
  drop constraint record_categories_parent_id_fkey,
  add constraint record_categories_parent_id_fkey
    foreign key (parent_id) references public.record_categories (id)
    on delete no action deferrable initially deferred;

alter table public.financial_transactions
  drop constraint financial_transactions_main_category_id_fkey,
  add constraint financial_transactions_main_category_id_fkey
    foreign key (main_category_id) references public.record_categories (id)
    on delete no action deferrable initially deferred,
  drop constraint financial_transactions_subcategory_id_fkey,
  add constraint financial_transactions_subcategory_id_fkey
    foreign key (subcategory_id) references public.record_categories (id)
    on delete no action deferrable initially deferred;

alter table public.metal_purchases
  drop constraint metal_purchases_funding_transaction_id_fkey,
  add constraint metal_purchases_funding_transaction_id_fkey
    foreign key (funding_transaction_id) references public.financial_transactions (id)
    on delete no action deferrable initially deferred;

alter table public.metal_purchase_lifecycle_events
  drop constraint metal_purchase_lifecycle_events_affected_purchase_id_fkey,
  add constraint metal_purchase_lifecycle_events_affected_purchase_id_fkey
    foreign key (affected_purchase_id) references public.metal_purchases (id)
    on delete no action deferrable initially deferred,
  drop constraint metal_purchase_lifecycle_events_replacement_purchase_id_fkey,
  add constraint metal_purchase_lifecycle_events_replacement_purchase_id_fkey
    foreign key (replacement_purchase_id) references public.metal_purchases (id)
    on delete no action deferrable initially deferred,
  drop constraint metal_purchase_lifecycle_even_funding_reversal_transaction_fkey,
  add constraint metal_lifecycle_funding_reversal_tx_fkey
    foreign key (funding_reversal_transaction_id) references public.financial_transactions (id)
    on delete no action deferrable initially deferred;

alter table public.holdings
  drop constraint holdings_asset_id_fkey,
  add constraint holdings_asset_id_fkey
    foreign key (asset_id) references public.assets (id)
    on delete no action deferrable initially deferred;

alter table public.account_valuations
  drop constraint account_valuations_corrects_valuation_id_fkey,
  add constraint account_valuations_corrects_valuation_id_fkey
    foreign key (corrects_valuation_id) references public.account_valuations (id)
    on delete no action deferrable initially deferred;

alter table public.account_disposals
  drop constraint account_disposals_corrects_disposal_id_fkey,
  add constraint account_disposals_corrects_disposal_id_fkey
    foreign key (corrects_disposal_id) references public.account_disposals (id)
    on delete no action deferrable initially deferred,
  drop constraint account_disposals_proceeds_account_id_fkey,
  add constraint account_disposals_proceeds_account_id_fkey
    foreign key (proceeds_account_id) references public.financial_accounts (id)
    on delete no action deferrable initially deferred,
  drop constraint account_disposals_proceeds_transaction_id_fkey,
  add constraint account_disposals_proceeds_transaction_id_fkey
    foreign key (proceeds_transaction_id) references public.financial_transactions (id)
    on delete no action deferrable initially deferred;
