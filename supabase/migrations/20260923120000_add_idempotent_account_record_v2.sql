create schema if not exists private;

create table private.account_record_mutation_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation, idempotency_key),
  constraint account_record_mutation_receipts_operation_not_blank
    check (btrim(operation) <> ''),
  constraint account_record_mutation_receipts_request_hash_sha256
    check (request_hash ~ '^[0-9a-f]{64}$')
);

alter table private.account_record_mutation_receipts enable row level security;

revoke all on schema private from public, anon, authenticated;
revoke all on table private.account_record_mutation_receipts from public, anon, authenticated;

create or replace function public.add_account_record_v2(
  p_record_type text,
  p_account_id uuid,
  p_counterparty_account_id uuid,
  p_amount numeric,
  p_received_amount numeric,
  p_occurred_at timestamptz,
  p_category text,
  p_notes text,
  p_idempotency_key uuid,
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
  v_operation constant text := 'add_account_record_v2';
  v_request jsonb;
  v_request_hash text;
  v_receipt private.account_record_mutation_receipts%rowtype;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'idempotency key is required' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'record_type', p_record_type,
    'account_id', p_account_id,
    'counterparty_account_id', p_counterparty_account_id,
    'amount', case when p_amount is null then null else trim_scale(p_amount)::text end,
    'received_amount', case when p_received_amount is null then null else trim_scale(p_received_amount)::text end,
    'occurred_at', case
      when p_occurred_at is null then null
      else to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    end,
    'category', nullif(btrim(p_category), ''),
    'notes', nullif(btrim(p_notes), ''),
    'main_category_id', p_main_category_id,
    'subcategory_id', p_subcategory_id
  );
  v_request_hash := encode(extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || v_operation || ':' || p_idempotency_key::text, 0)
  );

  select *
  into v_receipt
  from private.account_record_mutation_receipts
  where user_id = v_user_id
    and operation = v_operation
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_receipt.request_hash <> v_request_hash then
      raise exception 'idempotency key was already used with a different request'
        using errcode = '22023';
    end if;
    return v_receipt.result || jsonb_build_object('replayed', true);
  end if;

  v_result := public.add_account_record(
    p_record_type,
    p_account_id,
    p_counterparty_account_id,
    p_amount,
    p_received_amount,
    p_occurred_at,
    p_category,
    p_notes,
    p_main_category_id,
    p_subcategory_id
  );

  insert into private.account_record_mutation_receipts (
    user_id, operation, idempotency_key, request_hash, result
  ) values (
    v_user_id, v_operation, p_idempotency_key, v_request_hash, v_result
  );

  return v_result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.add_account_record_v2(
  text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid, uuid
) from public, anon;
grant execute on function public.add_account_record_v2(
  text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid, uuid
) to authenticated, service_role;

comment on table private.account_record_mutation_receipts is
  'Server-private receipts for replay-safe financial mutations. Clients have no direct access.';

comment on function public.add_account_record_v2(
  text, uuid, uuid, numeric, numeric, timestamptz, text, text, uuid, uuid, uuid
) is
  'Idempotent Income, Expense, and Transfer creation. Identical retries replay the original committed result.';
