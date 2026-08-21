-- Idempotent correction/reversal linkage foundation for immutable ledger rows.

alter table public.financial_transactions
  add column if not exists reverses_transaction_id uuid,
  add column if not exists corrects_transaction_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.financial_transactions'::regclass
      and conname = 'financial_transactions_reverses_transaction_id_fkey'
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_reverses_transaction_id_fkey
      foreign key (reverses_transaction_id)
      references public.financial_transactions (id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.financial_transactions'::regclass
      and conname = 'financial_transactions_corrects_transaction_id_fkey'
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_corrects_transaction_id_fkey
      foreign key (corrects_transaction_id)
      references public.financial_transactions (id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.financial_transactions'::regclass
      and conname = 'financial_transactions_reversal_not_self_check'
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_reversal_not_self_check
      check (reverses_transaction_id is null or reverses_transaction_id <> id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.financial_transactions'::regclass
      and conname = 'financial_transactions_correction_not_self_check'
  ) then
    alter table public.financial_transactions
      add constraint financial_transactions_correction_not_self_check
      check (corrects_transaction_id is null or corrects_transaction_id <> id);
  end if;
end
$$;

create unique index if not exists financial_transactions_one_reversal_per_transaction_idx
  on public.financial_transactions (reverses_transaction_id)
  where reverses_transaction_id is not null;

create unique index if not exists financial_transactions_one_correction_per_transaction_idx
  on public.financial_transactions (corrects_transaction_id)
  where corrects_transaction_id is not null;
