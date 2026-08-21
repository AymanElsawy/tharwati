-- Immutable Account Record corrections: reverse the original and post a replacement
-- in the same database transaction. Posted ledger rows are never updated or deleted.

create or replace function public.correct_account_record(
  p_transaction_id uuid,
  p_record_type text,
  p_account_id uuid,
  p_counterparty_account_id uuid,
  p_amount numeric,
  p_received_amount numeric,
  p_occurred_at timestamptz,
  p_category text,
  p_notes text,
  p_main_category_id uuid default null,
  p_subcategory_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_original public.financial_transactions%rowtype;
  v_category_label text;
  v_reversal jsonb;
  v_replacement jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_original
  from public.financial_transactions
  where id = p_transaction_id
    and user_id = v_user_id
    and status = 'posted'
    and transaction_type_code in ('income', 'expense', 'transfer')
  for update;
  if not found then
    raise exception 'posted account record is not available for correction' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.financial_transactions
    where reverses_transaction_id = v_original.id
  ) then
    raise exception 'reversed account record cannot be corrected' using errcode = '23505';
  end if;
  if exists (
    select 1
    from public.financial_transactions
    where corrects_transaction_id = v_original.id
  ) then
    raise exception 'account record has already been corrected' using errcode = '23505';
  end if;

  if p_record_type = 'transfer' then
    if p_main_category_id is not null or p_subcategory_id is not null then
      raise exception 'transfers cannot have categories' using errcode = '22023';
    end if;
  else
    if (p_main_category_id is null) <> (p_subcategory_id is null) then
      raise exception 'a visible main category and subcategory are required' using errcode = '22023';
    end if;
    if p_main_category_id is not null then
      v_category_label := public.assert_visible_record_category_selection(
        v_user_id,
        p_main_category_id,
        p_subcategory_id
      );
    elsif nullif(btrim(p_category), '') is null then
      raise exception 'a visible main category and subcategory are required' using errcode = '22023';
    end if;
  end if;

  -- A PL/pgSQL function runs in the caller's transaction. Any error from the
  -- reversal or replacement helper rolls back both newly-created transactions.
  v_reversal := public.reverse_account_record(v_original.id);
  v_replacement := public.post_account_record_internal(
    p_record_type,
    p_account_id,
    p_counterparty_account_id,
    p_amount,
    p_received_amount,
    p_occurred_at,
    coalesce(v_category_label, p_category),
    p_notes,
    p_main_category_id,
    p_subcategory_id,
    null,
    v_original.id
  );

  return jsonb_build_object(
    'reversal', v_reversal -> 'transaction',
    'transaction', v_replacement -> 'transaction'
  );
end;
$$;

revoke all on function public.correct_account_record(
  uuid, text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid
) from public, anon;
grant execute on function public.correct_account_record(
  uuid, text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid
) to authenticated;

comment on function public.correct_account_record(
  uuid, text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid
) is 'Atomically creates an immutable reversal of an owned posted Account Record and a linked replacement.';
