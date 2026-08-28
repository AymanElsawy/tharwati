-- Immutable manual valuations for Real Estate and Business accounts.

alter table public.financial_accounts
  add column location text,
  add column initial_ownership_percentage numeric(5, 2),
  add column closed_on date,
  add column closed_reason text;

alter table public.financial_accounts
  add constraint financial_accounts_location_check check (
    location is null or account_type_code = 'real_estate'
  );

alter table public.financial_accounts
  add constraint financial_accounts_initial_ownership_percentage_check check (
    initial_ownership_percentage is null
    or (account_type_code in ('real_estate', 'business') and initial_ownership_percentage between 0 and 100)
  ),
  add constraint financial_accounts_closed_reason_check check (
    closed_reason is null or closed_reason = 'sold'
  );

create table public.account_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.financial_accounts (id) on delete cascade,
  valuation_amount numeric(20, 2) not null check (valuation_amount >= 0),
  valued_on date not null,
  valuation_method text,
  notes text,
  corrects_valuation_id uuid references public.account_valuations (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint account_valuations_not_self_correcting check (id is distinct from corrects_valuation_id)
);

create unique index account_valuations_one_direct_correction_idx
  on public.account_valuations (corrects_valuation_id)
  where corrects_valuation_id is not null;
create index account_valuations_effective_lookup_idx
  on public.account_valuations (account_id, valued_on desc, created_at desc);

-- Disposal consideration is audit information only. Ownership is derived from
-- the initial ownership and the effective immutable disposal-event timeline.
create table public.account_disposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.financial_accounts (id) on delete cascade,
  disposed_on date not null,
  sale_amount numeric(20, 2) not null check (sale_amount >= 0),
  sale_currency_code text not null check (sale_currency_code in ('USD', 'SAR', 'EGP', 'EUR', 'GBP')),
  ownership_percentage_sold numeric(5, 2) not null check (ownership_percentage_sold > 0 and ownership_percentage_sold <= 100),
  notes text,
  corrects_disposal_id uuid references public.account_disposals (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint account_disposals_not_self_correcting check (id is distinct from corrects_disposal_id)
);
create unique index account_disposals_one_direct_correction_idx
  on public.account_disposals (corrects_disposal_id)
  where corrects_disposal_id is not null;
create index account_disposals_effective_lookup_idx
  on public.account_disposals (account_id, disposed_on, created_at, id);
alter table public.account_disposals enable row level security;
create policy "account_disposals_select_own" on public.account_disposals
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.account_disposals to authenticated;

create function public.get_account_current_ownership(p_account_ids uuid[] default null)
returns table (account_id uuid, ownership_percentage numeric, is_sold boolean)
language sql security invoker set search_path = '' stable
as $$
  select account.id,
    case when account.initial_ownership_percentage is null then null
      else account.initial_ownership_percentage - coalesce(sum(disposal.ownership_percentage_sold), 0) end,
    case when account.initial_ownership_percentage is null then false
      else account.initial_ownership_percentage - coalesce(sum(disposal.ownership_percentage_sold), 0) = 0 end
  from public.financial_accounts account
  left join public.account_disposals disposal
    on disposal.account_id = account.id
    and not exists (select 1 from public.account_disposals correction where correction.corrects_disposal_id = disposal.id)
  where account.user_id = (select auth.uid())
    and account.account_type_code in ('real_estate', 'business')
    and (p_account_ids is null or account.id = any(p_account_ids))
  group by account.id, account.initial_ownership_percentage;
$$;

create function public.get_account_disposals(p_account_ids uuid[] default null)
returns table (
  id uuid, user_id uuid, account_id uuid, disposed_on date, sale_amount numeric,
  sale_currency_code text, ownership_percentage_sold numeric, notes text,
  corrects_disposal_id uuid, created_at timestamptz, is_effective boolean
)
language sql security invoker set search_path = '' stable
as $$
  select disposal.id, disposal.user_id, disposal.account_id, disposal.disposed_on,
    disposal.sale_amount, disposal.sale_currency_code, disposal.ownership_percentage_sold,
    disposal.notes, disposal.corrects_disposal_id, disposal.created_at,
    not exists (select 1 from public.account_disposals correction where correction.corrects_disposal_id = disposal.id)
  from public.account_disposals disposal
  join public.financial_accounts account on account.id = disposal.account_id
  where disposal.user_id = (select auth.uid()) and account.user_id = (select auth.uid())
    and (p_account_ids is null or disposal.account_id = any(p_account_ids))
  order by disposal.account_id, disposal.disposed_on desc, disposal.created_at desc;
$$;

create function public.recalculate_account_disposal_projection(p_account_id uuid)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_account public.financial_accounts; v_disposal public.account_disposals; v_remaining numeric;
begin
  select * into v_account from public.financial_accounts where id = p_account_id for update;
  if not found or v_account.initial_ownership_percentage is null then
    raise exception using errcode = '23514', message = 'An initial ownership percentage is required';
  end if;
  v_remaining := v_account.initial_ownership_percentage;
  for v_disposal in
    select disposal.* from public.account_disposals disposal
    where disposal.account_id = p_account_id
      and not exists (select 1 from public.account_disposals correction where correction.corrects_disposal_id = disposal.id)
    order by disposal.disposed_on, disposal.created_at, disposal.id
  loop
    if v_disposal.ownership_percentage_sold > v_remaining then
      raise exception using errcode = '23514', message = 'A disposal cannot sell more ownership than was held on its effective date';
    end if;
    if v_account.account_type_code = 'real_estate' and v_disposal.ownership_percentage_sold <> v_remaining then
      raise exception using errcode = '23514', message = 'Real Estate supports full sale only';
    end if;
    v_remaining := v_remaining - v_disposal.ownership_percentage_sold;
  end loop;
  perform set_config('tharwati.disposal_projection', 'on', true);
  update public.financial_accounts
  set ownership_percentage = v_remaining,
      is_active = case when v_remaining = 0 then false when v_account.closed_reason = 'sold' then true else is_active end,
      closed_on = case when v_remaining = 0 then (select max(disposed_on) from public.account_disposals d where d.account_id = p_account_id and not exists (select 1 from public.account_disposals c where c.corrects_disposal_id = d.id)) else null end,
      closed_reason = case when v_remaining = 0 then 'sold' else null end
  where id = p_account_id;
  return v_remaining;
end;
$$;

create function public.add_account_disposal(
  p_account_id uuid, p_disposed_on date, p_sale_amount numeric,
  p_sale_currency_code text, p_ownership_percentage_sold numeric, p_notes text default null
)
returns public.account_disposals language plpgsql security definer set search_path = '' as $$
declare v_account public.financial_accounts; v_row public.account_disposals;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  select * into v_account from public.financial_accounts where id = p_account_id and user_id = auth.uid() and is_active for update;
  if not found or v_account.account_type_code not in ('real_estate', 'business') then raise exception using errcode = '23514', message = 'An active owned Real Estate or Business account is required'; end if;
  if p_disposed_on is null or p_disposed_on > current_date or p_sale_amount is null or p_sale_amount < 0
    or p_sale_currency_code not in ('USD', 'SAR', 'EGP', 'EUR', 'GBP')
    or p_ownership_percentage_sold is null or p_ownership_percentage_sold <= 0 or p_ownership_percentage_sold > 100 then
    raise exception using errcode = '23514', message = 'Valid non-future disposal fields are required';
  end if;
  insert into public.account_disposals (user_id, account_id, disposed_on, sale_amount, sale_currency_code, ownership_percentage_sold, notes)
  values (auth.uid(), p_account_id, p_disposed_on, p_sale_amount, p_sale_currency_code, p_ownership_percentage_sold, nullif(btrim(p_notes), '')) returning * into v_row;
  perform public.recalculate_account_disposal_projection(p_account_id);
  return v_row;
end;
$$;

create function public.correct_account_disposal(
  p_disposal_id uuid, p_disposed_on date, p_sale_amount numeric,
  p_sale_currency_code text, p_ownership_percentage_sold numeric, p_notes text default null
)
returns public.account_disposals language plpgsql security definer set search_path = '' as $$
declare v_original public.account_disposals; v_account public.financial_accounts; v_row public.account_disposals;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  select * into v_original from public.account_disposals where id = p_disposal_id and user_id = auth.uid() for update;
  if not found or exists (select 1 from public.account_disposals where corrects_disposal_id = p_disposal_id) then raise exception using errcode = '23514', message = 'Only an effective owned disposal can be corrected'; end if;
  select * into v_account from public.financial_accounts where id = v_original.account_id and user_id = auth.uid() for update;
  if not found or v_account.account_type_code not in ('real_estate', 'business') then raise exception using errcode = '23514', message = 'A supported owned account is required'; end if;
  if p_disposed_on is null or p_disposed_on > current_date or p_sale_amount is null or p_sale_amount < 0
    or p_sale_currency_code not in ('USD', 'SAR', 'EGP', 'EUR', 'GBP')
    or p_ownership_percentage_sold is null or p_ownership_percentage_sold <= 0 or p_ownership_percentage_sold > 100 then raise exception using errcode = '23514', message = 'Valid non-future disposal fields are required'; end if;
  insert into public.account_disposals (user_id, account_id, disposed_on, sale_amount, sale_currency_code, ownership_percentage_sold, notes, corrects_disposal_id)
  values (auth.uid(), v_original.account_id, p_disposed_on, p_sale_amount, p_sale_currency_code, p_ownership_percentage_sold, nullif(btrim(p_notes), ''), p_disposal_id) returning * into v_row;
  perform public.recalculate_account_disposal_projection(v_original.account_id);
  return v_row;
end;
$$;

alter table public.account_valuations enable row level security;
create policy "account_valuations_select_own" on public.account_valuations
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.account_valuations to authenticated;

create function public.get_effective_account_valuations(p_account_ids uuid[] default null)
returns table (
  id uuid, user_id uuid, account_id uuid, valuation_amount numeric,
  valued_on date, valuation_method text, notes text, corrects_valuation_id uuid,
  created_at timestamptz
)
language sql security invoker set search_path = '' stable
as $$
  select valuation.id, valuation.user_id, valuation.account_id,
    valuation.valuation_amount, valuation.valued_on, valuation.valuation_method,
    valuation.notes, valuation.corrects_valuation_id, valuation.created_at
  from public.account_valuations valuation
  join public.financial_accounts account on account.id = valuation.account_id
  where valuation.user_id = (select auth.uid())
    and account.user_id = (select auth.uid())
    and account.account_type_code in ('real_estate', 'business')
    and (p_account_ids is null or valuation.account_id = any(p_account_ids))
    and not exists (
      select 1 from public.account_valuations correction
      where correction.corrects_valuation_id = valuation.id
    )
  order by valuation.account_id, valuation.valued_on desc, valuation.created_at desc;
$$;

create function public.add_account_valuation(
  p_account_id uuid, p_valuation_amount numeric, p_valued_on date,
  p_valuation_method text default null, p_notes text default null
)
returns public.account_valuations
language plpgsql security definer set search_path = ''
as $$
declare v_account public.financial_accounts; v_row public.account_valuations;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  select * into v_account from public.financial_accounts
  where id = p_account_id and user_id = auth.uid() and is_active for update;
  if not found or v_account.account_type_code not in ('real_estate', 'business') then
    raise exception using errcode = '23514', message = 'An active owned Real Estate or Business account is required';
  end if;
  if p_valuation_amount is null or p_valuation_amount < 0 or p_valued_on is null then
    raise exception using errcode = '23514', message = 'A non-negative valuation amount and valuation date are required';
  end if;
  if v_account.account_type_code <> 'business' and nullif(btrim(coalesce(p_valuation_method, '')), '') is not null then
    raise exception using errcode = '23514', message = 'Valuation method is supported only for Business accounts';
  end if;
  insert into public.account_valuations (user_id, account_id, valuation_amount, valued_on, valuation_method, notes)
  values (auth.uid(), p_account_id, p_valuation_amount, p_valued_on,
    nullif(btrim(p_valuation_method), ''), nullif(btrim(p_notes), '')) returning * into v_row;
  return v_row;
end;
$$;

create function public.correct_account_valuation(
  p_valuation_id uuid, p_valuation_amount numeric, p_valued_on date,
  p_valuation_method text default null, p_notes text default null
)
returns public.account_valuations
language plpgsql security definer set search_path = ''
as $$
declare v_original public.account_valuations; v_account public.financial_accounts; v_row public.account_valuations;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  select * into v_original from public.account_valuations where id = p_valuation_id and user_id = auth.uid() for update;
  if not found or exists (select 1 from public.account_valuations where corrects_valuation_id = p_valuation_id) then
    raise exception using errcode = '23514', message = 'Only an effective owned valuation can be corrected';
  end if;
  select * into v_account from public.financial_accounts where id = v_original.account_id and user_id = auth.uid() for update;
  if not found or v_account.account_type_code not in ('real_estate', 'business') then raise exception using errcode = '23514', message = 'A supported owned account is required'; end if;
  if p_valuation_amount is null or p_valuation_amount < 0 or p_valued_on is null then raise exception using errcode = '23514', message = 'A non-negative valuation amount and valuation date are required'; end if;
  if v_account.account_type_code <> 'business' and nullif(btrim(coalesce(p_valuation_method, '')), '') is not null then raise exception using errcode = '23514', message = 'Valuation method is supported only for Business accounts'; end if;
  insert into public.account_valuations (user_id, account_id, valuation_amount, valued_on, valuation_method, notes, corrects_valuation_id)
  values (auth.uid(), v_original.account_id, p_valuation_amount, p_valued_on,
    nullif(btrim(p_valuation_method), ''), nullif(btrim(p_notes), ''), p_valuation_id) returning * into v_row;
  return v_row;
end;
$$;

create function public.create_valued_account(
  p_account_type_code text, p_name text, p_currency_code text,
  p_property_type text, p_business_type text, p_industry text,
  p_ownership_percentage numeric, p_location text, p_account_notes text,
  p_valuation_amount numeric, p_valued_on date, p_valuation_method text, p_valuation_notes text
)
returns public.financial_accounts
language plpgsql security definer set search_path = ''
as $$
declare v_account public.financial_accounts;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'Authentication is required'; end if;
  if p_account_type_code not in ('real_estate', 'business') or nullif(btrim(p_name), '') is null
    or p_currency_code not in ('USD', 'SAR', 'EGP', 'EUR', 'GBP')
    or p_ownership_percentage is null or p_ownership_percentage < 0 or p_ownership_percentage > 100
    or p_valuation_amount is null or p_valuation_amount < 0 or p_valued_on is null then
    raise exception using errcode = '23514', message = 'Valid account and valuation fields are required';
  end if;
  if p_account_type_code = 'real_estate' and p_property_type not in ('apartment', 'villa', 'land', 'office', 'other') then raise exception using errcode = '23514', message = 'A property type is required'; end if;
  if p_account_type_code = 'business' and (nullif(btrim(p_business_type), '') is null or nullif(btrim(p_industry), '') is null) then raise exception using errcode = '23514', message = 'Business type and industry are required'; end if;
  insert into public.financial_accounts (user_id, account_type_code, name, currency_code, opening_balance, notes, property_type, ownership_percentage, initial_ownership_percentage, business_type, industry, location)
  values (auth.uid(), p_account_type_code, btrim(p_name), p_currency_code, 0, nullif(btrim(p_account_notes), ''),
    case when p_account_type_code = 'real_estate' then p_property_type else null end, p_ownership_percentage, p_ownership_percentage,
    case when p_account_type_code = 'business' then nullif(btrim(p_business_type), '') else null end,
    case when p_account_type_code = 'business' then nullif(btrim(p_industry), '') else null end,
    case when p_account_type_code = 'real_estate' then nullif(btrim(p_location), '') else null end) returning * into v_account;
  perform public.add_account_valuation(v_account.id, p_valuation_amount, p_valued_on, p_valuation_method, p_valuation_notes);
  return v_account;
end;
$$;

create function public.prevent_legacy_non_market_opening_balance_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.account_type_code in ('real_estate', 'business')
    and (new.initial_ownership_percentage is null or new.initial_ownership_percentage is distinct from new.ownership_percentage) then
    raise exception using errcode = '23514', message = 'Real Estate and Business accounts require an initial ownership percentage';
  end if;
  if new.account_type_code in ('real_estate', 'business')
    and ((tg_op = 'INSERT' and new.opening_balance <> 0)
      or (tg_op = 'UPDATE' and new.opening_balance is distinct from old.opening_balance)) then
    raise exception using errcode = '23514', message = 'Real Estate and Business current values must use valuations';
  end if;
  if tg_op = 'UPDATE' and new.account_type_code in ('real_estate', 'business')
    and new.currency_code is distinct from old.currency_code
    and (exists (select 1 from public.account_valuations where account_id = old.id)
      or exists (select 1 from public.account_disposals where account_id = old.id)) then
    raise exception using errcode = '23514', message = 'This account already contains financial history. Its currency cannot be changed';
  end if;
  if tg_op = 'UPDATE' and new.account_type_code in ('real_estate', 'business')
    and (new.ownership_percentage is distinct from old.ownership_percentage
      or new.initial_ownership_percentage is distinct from old.initial_ownership_percentage)
    and (exists (select 1 from public.account_valuations where account_id = old.id)
      or exists (select 1 from public.account_disposals where account_id = old.id))
    and current_setting('tharwati.disposal_projection', true) is distinct from 'on' then
    raise exception using errcode = '23514', message = 'This account already contains financial history. Its ownership cannot be changed directly';
  end if;
  if tg_op = 'UPDATE' and new.account_type_code in ('real_estate', 'business')
    and (new.closed_on is distinct from old.closed_on or new.closed_reason is distinct from old.closed_reason)
    and current_setting('tharwati.disposal_projection', true) is distinct from 'on' then
    raise exception using errcode = '23514', message = 'Account sale status is derived from disposal history';
  end if;
  if tg_op = 'UPDATE' and old.closed_reason = 'sold' and new.is_active is distinct from old.is_active
    and current_setting('tharwati.disposal_projection', true) is distinct from 'on' then
    raise exception using errcode = '23514', message = 'A sold account can be reactivated only by correcting its disposal history';
  end if;
  return new;
end;
$$;
create trigger financial_accounts_non_market_opening_balance_guard
before insert or update on public.financial_accounts for each row execute function public.prevent_legacy_non_market_opening_balance_write();

create trigger dashboard_snapshot_account_valuations
after insert or update or delete on public.account_valuations
for each row execute function public.invalidate_dashboard_snapshot_for_row();
create trigger dashboard_snapshot_account_disposals
after insert or update or delete on public.account_disposals
for each row execute function public.invalidate_dashboard_snapshot_for_row();

revoke all on function public.add_account_valuation(uuid,numeric,date,text,text) from public, anon;
revoke all on function public.correct_account_valuation(uuid,numeric,date,text,text) from public, anon;
revoke all on function public.create_valued_account(text,text,text,text,text,text,numeric,text,text,numeric,date,text,text) from public, anon;
revoke all on function public.add_account_disposal(uuid,date,numeric,text,numeric,text) from public, anon;
revoke all on function public.correct_account_disposal(uuid,date,numeric,text,numeric,text) from public, anon;
revoke all on function public.recalculate_account_disposal_projection(uuid) from public, anon, authenticated;
grant execute on function public.get_effective_account_valuations(uuid[]) to authenticated;
grant execute on function public.get_account_current_ownership(uuid[]) to authenticated;
grant execute on function public.get_account_disposals(uuid[]) to authenticated;
grant execute on function public.add_account_valuation(uuid,numeric,date,text,text) to authenticated;
grant execute on function public.correct_account_valuation(uuid,numeric,date,text,text) to authenticated;
grant execute on function public.create_valued_account(text,text,text,text,text,text,numeric,text,text,numeric,date,text,text) to authenticated;
grant execute on function public.add_account_disposal(uuid,date,numeric,text,numeric,text) to authenticated;
grant execute on function public.correct_account_disposal(uuid,date,numeric,text,numeric,text) to authenticated;
