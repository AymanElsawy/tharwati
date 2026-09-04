-- Privacy Stage 2: deterministic, caller-owned JSON export. The rate-limit row
-- is operational state and is intentionally excluded from the export itself.

create table public.user_data_export_rate_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_requested_at timestamptz not null
);

alter table public.user_data_export_rate_limits enable row level security;
revoke all on table public.user_data_export_rate_limits from public, anon, authenticated;

comment on table public.user_data_export_rate_limits is
  'Internal per-user throttle state for Download My Data. Not user export content.';

create function public.export_my_data_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_claimed uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  insert into public.user_data_export_rate_limits (user_id, last_requested_at)
  values (v_user_id, pg_catalog.statement_timestamp())
  on conflict (user_id) do update
    set last_requested_at = excluded.last_requested_at
    where user_data_export_rate_limits.last_requested_at
      <= excluded.last_requested_at - interval '60 seconds'
  returning user_id into v_claimed;

  if v_claimed is null then
    raise exception 'export_rate_limited' using errcode = 'P0001';
  end if;

  select pg_catalog.jsonb_build_object(
    'schema', 'tharwati.user-data-export',
    'version', 1,
    'subject', pg_catalog.jsonb_build_object('user_id', v_user_id),
    'data', pg_catalog.jsonb_build_object(
      'profile', coalesce((
        select pg_catalog.jsonb_build_object(
          'id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url,
          'country_code', p.country_code, 'base_currency_code', p.base_currency_code,
          'selected_goals', p.selected_goals,
          'onboarding_completed', p.onboarding_completed,
          'created_at', p.created_at, 'updated_at', p.updated_at
        ) from public.profiles p where p.id = v_user_id
      ), 'null'::jsonb),
      'financial_accounts', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', a.id, 'user_id', a.user_id, 'account_type_code', a.account_type_code,
          'name', a.name, 'currency_code', a.currency_code,
          'opening_balance', a.opening_balance::text, 'is_active', a.is_active,
          'notes', a.notes, 'bank_subtype', a.bank_subtype,
          'credit_card_limit', case when a.credit_card_limit is null then null else a.credit_card_limit::text end,
          'due_day_of_month', a.due_day_of_month, 'investment_type', a.investment_type,
          'balance_grams', case when a.balance_grams is null then null else a.balance_grams::text end,
          'property_type', a.property_type,
          'ownership_percentage', case when a.ownership_percentage is null then null else a.ownership_percentage::text end,
          'initial_ownership_percentage', case when a.initial_ownership_percentage is null then null else a.initial_ownership_percentage::text end,
          'closed_on', a.closed_on, 'closed_reason', a.closed_reason,
          'business_type', a.business_type, 'industry', a.industry, 'location', a.location,
          'metal_type', a.metal_type, 'purity', a.purity, 'purchase_date', a.purchase_date,
          'cost_per_unit', case when a.cost_per_unit is null then null else a.cost_per_unit::text end,
          'created_at', a.created_at, 'updated_at', a.updated_at
        ) order by a.created_at, a.id)
        from public.financial_accounts a where a.user_id = v_user_id
      ), '[]'::jsonb),
      'financial_transactions', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', t.id, 'user_id', t.user_id, 'transaction_type_code', t.transaction_type_code,
          'transaction_currency_code', t.transaction_currency_code, 'status', t.status,
          'occurred_at', t.occurred_at, 'description', t.description,
          'external_reference', t.external_reference, 'notes', t.notes,
          'main_category_id', t.main_category_id, 'subcategory_id', t.subcategory_id,
          'posted_at', t.posted_at, 'reverses_transaction_id', t.reverses_transaction_id,
          'corrects_transaction_id', t.corrects_transaction_id,
          'created_at', t.created_at, 'updated_at', t.updated_at
        ) order by t.occurred_at, t.created_at, t.id)
        from public.financial_transactions t where t.user_id = v_user_id
      ), '[]'::jsonb),
      'transaction_entries', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', e.id, 'transaction_id', e.transaction_id, 'user_id', e.user_id,
          'account_id', e.account_id, 'asset_id', e.asset_id, 'entry_side', e.entry_side,
          'transaction_amount', e.transaction_amount::text, 'account_amount', e.account_amount::text,
          'quantity_delta', case when e.quantity_delta is null then null else e.quantity_delta::text end,
          'input_quantity', case when e.input_quantity is null then null else e.input_quantity::text end,
          'input_quantity_unit', e.input_quantity_unit,
          'quantity_conversion_factor', case when e.quantity_conversion_factor is null then null else e.quantity_conversion_factor::text end,
          'cost_basis_delta', case when e.cost_basis_delta is null then null else e.cost_basis_delta::text end,
          'account_cost_basis_delta', case when e.account_cost_basis_delta is null then null else e.account_cost_basis_delta::text end,
          'account_fx_rate', case when e.account_fx_rate is null then null else e.account_fx_rate::text end,
          'account_fx_effective_at', e.account_fx_effective_at, 'account_fx_source', e.account_fx_source,
          'unit_price', case when e.unit_price is null then null else e.unit_price::text end,
          'memo', e.memo, 'purity', e.purity, 'created_at', e.created_at, 'updated_at', e.updated_at
        ) order by e.transaction_id, e.created_at, e.id)
        from public.transaction_entries e where e.user_id = v_user_id
      ), '[]'::jsonb),
      'holdings', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', h.id, 'user_id', h.user_id, 'account_id', h.account_id, 'asset_id', h.asset_id,
          'quantity', h.quantity::text,
          'average_cost', case when h.average_cost is null then null else h.average_cost::text end,
          'total_cost_basis', h.total_cost_basis::text, 'cost_currency_code', h.cost_currency_code,
          'notes', h.notes, 'created_at', h.created_at, 'updated_at', h.updated_at
        ) order by h.account_id, h.asset_id, h.id)
        from public.holdings h where h.user_id = v_user_id
      ), '[]'::jsonb),
      'user_assets', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', a.id, 'user_id', a.user_id, 'asset_type_code', a.asset_type_code,
          'symbol', a.symbol, 'name', a.name, 'currency_code', a.currency_code,
          'exchange', a.exchange, 'is_custom', a.is_custom, 'is_active', a.is_active,
          'canonical_quantity_unit', a.canonical_quantity_unit,
          'created_at', a.created_at, 'updated_at', a.updated_at
        ) order by a.created_at, a.id)
        from public.assets a where a.user_id = v_user_id
      ), '[]'::jsonb),
      'asset_identifiers', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', i.id, 'asset_id', i.asset_id, 'user_id', i.user_id, 'scheme', i.scheme,
          'namespace', i.namespace, 'value', i.value, 'normalized_value', i.normalized_value,
          'provider', i.provider, 'is_primary', i.is_primary,
          'created_at', i.created_at, 'updated_at', i.updated_at
        ) order by i.asset_id, i.is_primary desc, i.scheme, i.namespace, i.normalized_value, i.id)
        from public.asset_identifiers i where i.user_id = v_user_id
      ), '[]'::jsonb),
      'metal_purchases', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', m.id, 'user_id', m.user_id, 'account_id', m.account_id, 'purity', m.purity,
          'purchased_at', m.purchased_at, 'quantity_grams', m.quantity_grams::text,
          'cost_per_unit', m.cost_per_unit::text, 'fees', m.fees::text, 'notes', m.notes,
          'funding_mode', m.funding_mode, 'funding_account_id', m.funding_account_id,
          'funding_transaction_id', m.funding_transaction_id, 'created_at', m.created_at
        ) order by m.purchased_at, m.created_at, m.id)
        from public.metal_purchases m where m.user_id = v_user_id
      ), '[]'::jsonb),
      'metal_purchase_lifecycle_events', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', l.id, 'user_id', l.user_id, 'affected_purchase_id', l.affected_purchase_id,
          'action', l.action, 'replacement_purchase_id', l.replacement_purchase_id,
          'funding_reversal_transaction_id', l.funding_reversal_transaction_id,
          'created_at', l.created_at
        ) order by l.created_at, l.id)
        from public.metal_purchase_lifecycle_events l where l.user_id = v_user_id
      ), '[]'::jsonb),
      'account_valuations', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', v.id, 'user_id', v.user_id, 'account_id', v.account_id,
          'valuation_amount', v.valuation_amount::text, 'valued_on', v.valued_on,
          'valuation_method', v.valuation_method, 'notes', v.notes,
          'corrects_valuation_id', v.corrects_valuation_id, 'created_at', v.created_at
        ) order by v.account_id, v.valued_on, v.created_at, v.id)
        from public.account_valuations v where v.user_id = v_user_id
      ), '[]'::jsonb),
      'account_disposals', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', d.id, 'user_id', d.user_id, 'account_id', d.account_id,
          'disposed_on', d.disposed_on, 'sale_amount', d.sale_amount::text,
          'sale_currency_code', d.sale_currency_code,
          'ownership_percentage_sold', d.ownership_percentage_sold::text,
          'notes', d.notes, 'corrects_disposal_id', d.corrects_disposal_id,
          'idempotency_key', d.idempotency_key, 'proceeds_account_id', d.proceeds_account_id,
          'proceeds_transaction_id', d.proceeds_transaction_id, 'created_at', d.created_at
        ) order by d.account_id, d.disposed_on, d.created_at, d.id)
        from public.account_disposals d where d.user_id = v_user_id
      ), '[]'::jsonb),
      'record_categories', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', c.id, 'user_id', c.user_id, 'parent_id', c.parent_id,
          'system_code', c.system_code, 'level', c.level, 'name', c.name,
          'sort_order', c.sort_order, 'is_archived', c.is_archived,
          'created_at', c.created_at, 'updated_at', c.updated_at
        ) order by c.level, c.sort_order, c.created_at, c.id)
        from public.record_categories c where c.user_id = v_user_id
      ), '[]'::jsonb),
      'record_category_overrides', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'user_id', o.user_id, 'category_id', o.category_id, 'name', o.name,
          'is_hidden', o.is_hidden, 'created_at', o.created_at, 'updated_at', o.updated_at
        ) order by o.category_id)
        from public.record_category_overrides o where o.user_id = v_user_id
      ), '[]'::jsonb),
      'goals', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', g.id, 'user_id', g.user_id, 'name', g.name, 'goal_type', g.goal_type,
          'custom_type_name', g.custom_type_name, 'target_amount', g.target_amount::text,
          'currency_code', g.currency_code, 'target_date', g.target_date, 'status', g.status,
          'archived_at', g.archived_at, 'created_at', g.created_at, 'updated_at', g.updated_at
        ) order by g.created_at, g.id)
        from public.goals g where g.user_id = v_user_id
      ), '[]'::jsonb),
      'goal_progress_entries', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', p.id, 'goal_id', p.goal_id, 'user_id', p.user_id,
          'entry_type', p.entry_type, 'amount', p.amount::text, 'effective_on', p.effective_on,
          'note', p.note, 'reverses_entry_id', p.reverses_entry_id,
          'replacement_for_entry_id', p.replacement_for_entry_id, 'created_at', p.created_at
        ) order by p.goal_id, p.effective_on, p.created_at, p.id)
        from public.goal_progress_entries p where p.user_id = v_user_id
      ), '[]'::jsonb),
      'manual_market_prices', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', m.id, 'user_id', m.user_id, 'asset_id', m.asset_id, 'provider', m.provider,
          'price', m.price::text, 'currency_code', m.currency_code, 'as_of', m.as_of,
          'fetched_at', m.fetched_at, 'price_type', m.price_type,
          'created_at', m.created_at, 'updated_at', m.updated_at
        ) order by m.asset_id, m.as_of, m.created_at, m.id)
        from public.market_prices m
        where m.user_id = v_user_id and m.provider = 'manual' and m.price_type = 'manual'
      ), '[]'::jsonb)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.export_my_data_v1() from public, anon, authenticated;
grant execute on function public.export_my_data_v1() to authenticated;

comment on function public.export_my_data_v1() is
  'Returns the authenticated caller own source/audit records as deterministic Tharwati user-data export v1 JSON; limited to one request per minute.';
