-- Shared Income/Expense category catalog. System rows are immutable defaults;
-- user rows and per-user overrides provide personalization without changing them.

create table public.record_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  parent_id uuid references public.record_categories (id) on delete restrict,
  system_code text unique,
  level text not null,
  name text not null,
  sort_order integer not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint record_categories_level_check check (level in ('main', 'subcategory')),
  constraint record_categories_name_not_blank_check check (btrim(name) <> ''),
  constraint record_categories_sort_order_positive_check check (sort_order > 0),
  constraint record_categories_system_ownership_check check (
    (user_id is null and system_code is not null and not is_archived)
    or (user_id is not null and system_code is null)
  ),
  constraint record_categories_parent_level_check check (
    (level = 'main' and parent_id is null)
    or (level = 'subcategory' and parent_id is not null)
  )
);

create table public.record_category_overrides (
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.record_categories (id) on delete cascade,
  name text,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_id),
  constraint record_category_overrides_name_not_blank_check check (
    name is null or btrim(name) <> ''
  )
);

create unique index record_categories_custom_main_name_key
  on public.record_categories (user_id, lower(btrim(name)))
  where user_id is not null and level = 'main' and not is_archived;
create unique index record_categories_custom_subcategory_name_key
  on public.record_categories (user_id, parent_id, lower(btrim(name)))
  where user_id is not null and level = 'subcategory' and not is_archived;
create index record_categories_visible_tree_idx
  on public.record_categories (parent_id, sort_order, id);
create index record_category_overrides_user_idx
  on public.record_category_overrides (user_id, category_id);

create or replace function public.validate_record_category_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.record_categories%rowtype;
begin
  if new.level = 'main' then return new; end if;

  select * into v_parent from public.record_categories where id = new.parent_id;
  if not found or v_parent.level <> 'main' then
    raise exception 'subcategory parent must be a main category' using errcode = '23514';
  end if;
  if new.user_id is null then
    if v_parent.user_id is not null then
      raise exception 'system subcategories require a system main category' using errcode = '23514';
    end if;
  elsif v_parent.user_id is not null and v_parent.user_id <> new.user_id then
    raise exception 'custom subcategory parent must be owned by the same user' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.validate_record_category_override()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.record_categories
    where id = new.category_id and user_id is null and system_code is not null
  ) then
    raise exception 'category overrides apply only to system categories' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger record_categories_validate_hierarchy
  before insert or update of user_id, parent_id, level on public.record_categories
  for each row execute function public.validate_record_category_hierarchy();
create trigger record_category_overrides_validate_system_category
  before insert or update of category_id on public.record_category_overrides
  for each row execute function public.validate_record_category_override();
create trigger record_categories_set_updated_at
  before update on public.record_categories
  for each row execute function public.set_updated_at();
create trigger record_category_overrides_set_updated_at
  before update on public.record_category_overrides
  for each row execute function public.set_updated_at();

insert into public.record_categories (system_code, level, name, sort_order)
values
  ('food_drinks', 'main', 'Food & Drinks', 1),
  ('shopping', 'main', 'Shopping', 2),
  ('housing', 'main', 'Housing', 3),
  ('transportation', 'main', 'Transportation', 4),
  ('travel', 'main', 'Travel', 5),
  ('vehicle', 'main', 'Vehicle', 6),
  ('healthcare', 'main', 'Healthcare', 7),
  ('education', 'main', 'Education', 8),
  ('life_entertainment', 'main', 'Life & Entertainment', 9),
  ('communication', 'main', 'Communication', 10),
  ('subscriptions', 'main', 'Subscriptions', 11),
  ('family_children', 'main', 'Family & Children', 12),
  ('financial_expenses', 'main', 'Financial Expenses', 13),
  ('investments', 'main', 'Investments', 14),
  ('income', 'main', 'Income', 15),
  ('others', 'main', 'Others', 16)
on conflict (system_code) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into public.record_categories (parent_id, system_code, level, name, sort_order)
select parent.id, source.system_code, 'subcategory', source.name, source.sort_order
from (values
  ('food_drinks', 'food_drinks.restaurant_fast_food', 'Restaurant & Fast Food', 1),
  ('food_drinks', 'food_drinks.cafe_bar', 'Café & Bar', 2),
  ('food_drinks', 'food_drinks.groceries', 'Groceries', 3),
  ('shopping', 'shopping.clothes_shoes', 'Clothes & shoes', 1),
  ('shopping', 'shopping.bags', 'Bags', 2),
  ('shopping', 'shopping.accessories', 'Accessories', 3),
  ('shopping', 'shopping.electronics', 'Electronics', 4),
  ('shopping', 'shopping.home_garden', 'Home & Garden', 5),
  ('shopping', 'shopping.health_supplements_vitamins', 'Health (Supplements & Vitamins)', 6),
  ('shopping', 'shopping.jewelry', 'Jewelry', 7),
  ('shopping', 'shopping.gifts', 'Gifts', 8),
  ('shopping', 'shopping.pets_animals', 'Pets & Animals', 9),
  ('housing', 'housing.rent', 'Rent', 1),
  ('housing', 'housing.mortgage', 'Mortgage', 2),
  ('housing', 'housing.utilities', 'Electricity, Gas & any Utilities', 3),
  ('housing', 'housing.maintenance_repair', 'Maintenance & Repair', 4),
  ('housing', 'housing.property_insurance', 'Property Insurance', 5),
  ('housing', 'housing.services', 'Services', 6),
  ('transportation', 'transportation.taxi', 'Taxi', 1),
  ('transportation', 'transportation.train', 'Train', 2),
  ('transportation', 'transportation.bus', 'Bus', 3),
  ('transportation', 'transportation.metro', 'Metro', 4),
  ('transportation', 'transportation.others', 'Others', 5),
  ('travel', 'travel.flight', 'Flight', 1),
  ('travel', 'travel.hotel_accommodation', 'Hotel / Accommodation', 2),
  ('travel', 'travel.visa', 'Visa', 3),
  ('travel', 'travel.tours_activities', 'Tours & Activities', 4),
  ('travel', 'travel.travel_insurance', 'Travel Insurance', 5),
  ('travel', 'travel.travel_transportation', 'Travel Transportation', 6),
  ('vehicle', 'vehicle.insurance', 'Vehicle Insurance', 1),
  ('vehicle', 'vehicle.car_wash', 'Car Wash', 2),
  ('vehicle', 'vehicle.rental', 'Vehicle Rental', 3),
  ('vehicle', 'vehicle.registration_licensing', 'Registration & Licensing', 4),
  ('vehicle', 'vehicle.tolls', 'Tolls', 5),
  ('vehicle', 'vehicle.maintenance', 'Vehicle Maintenance', 6),
  ('vehicle', 'vehicle.parking', 'Parking', 7),
  ('vehicle', 'vehicle.fuel', 'Fuel', 8),
  ('healthcare', 'healthcare.doctor_fees', 'Doctor Fees', 1),
  ('healthcare', 'healthcare.hospital_fees', 'Hospital Fees', 2),
  ('healthcare', 'healthcare.dental', 'Dental', 3),
  ('healthcare', 'healthcare.optical', 'Optical', 4),
  ('healthcare', 'healthcare.pharmacy_medicine', 'Pharmacy & Medicine', 5),
  ('healthcare', 'healthcare.medical_tests', 'Medical Tests', 6),
  ('healthcare', 'healthcare.health_insurance', 'Health Insurance', 7),
  ('education', 'education.school_university', 'School & University', 1),
  ('education', 'education.courses', 'Courses', 2),
  ('education', 'education.books', 'Books', 3),
  ('education', 'education.training', 'Training', 4),
  ('education', 'education.certifications', 'Certifications', 5),
  ('life_entertainment', 'life_entertainment.tailor_laundry', 'Tailor or Laundry', 1),
  ('life_entertainment', 'life_entertainment.tobacco_cigarettes', 'Tobacco & Cigarettes', 2),
  ('life_entertainment', 'life_entertainment.hobbies', 'Hobbies', 3),
  ('life_entertainment', 'life_entertainment.cinema', 'Cinema', 4),
  ('life_entertainment', 'life_entertainment.gym_sport', 'Gym & Sport', 5),
  ('life_entertainment', 'life_entertainment.shaving_wellness', 'Shaving & Wellness', 6),
  ('life_entertainment', 'life_entertainment.games', 'Games', 7),
  ('communication', 'communication.phone_credit', 'Phone Credit', 1),
  ('communication', 'communication.internet', 'Internet', 2),
  ('subscriptions', 'subscriptions.gaming', 'Gaming Subscriptions', 1),
  ('subscriptions', 'subscriptions.apps_software', 'Apps & Software', 2),
  ('subscriptions', 'subscriptions.streaming', 'Streaming', 3),
  ('subscriptions', 'subscriptions.cloud_storage', 'Cloud Storage', 4),
  ('subscriptions', 'subscriptions.memberships', 'Memberships', 5),
  ('family_children', 'family_children.childcare', 'Childcare', 1),
  ('family_children', 'family_children.babysitter_nanny', 'Babysitter / Nanny', 2),
  ('family_children', 'family_children.family_support', 'Family Support', 3),
  ('family_children', 'family_children.allowance', 'Allowance', 4),
  ('family_children', 'family_children.child_expenses', 'Child Expenses', 5),
  ('family_children', 'family_children.parent_support', 'Parent Support', 6),
  ('financial_expenses', 'financial_expenses.charges_fees', 'Charges & Fees', 1),
  ('financial_expenses', 'financial_expenses.fines', 'Fines', 2),
  ('financial_expenses', 'financial_expenses.bank_fees', 'Bank Fees', 3),
  ('financial_expenses', 'financial_expenses.loan_payments', 'Loan Payments', 4),
  ('financial_expenses', 'financial_expenses.interest', 'Interest', 5),
  ('financial_expenses', 'financial_expenses.taxes', 'Taxes', 6),
  ('investments', 'investments.savings', 'Savings', 1),
  ('investments', 'investments.financial_investments', 'Financial Investments', 2),
  ('investments', 'investments.collections', 'Collections', 3),
  ('income', 'income.gifts', 'Gifts', 1),
  ('income', 'income.salary', 'Salary', 2),
  ('income', 'income.business_income', 'Business Income', 3),
  ('income', 'income.freelance', 'Freelance', 4),
  ('income', 'income.bonus', 'Bonus', 5),
  ('income', 'income.refunds', 'Refunds', 6),
  ('income', 'income.rental_income', 'Rental Income', 7),
  ('income', 'income.interest_dividends', 'Interest & Dividends', 8),
  ('income', 'income.incentive_commission', 'Incentive & Commission', 9),
  ('income', 'income.compensation', 'Compensation', 10),
  ('income', 'income.pension', 'Pension', 11),
  ('others', 'others.unknown', 'Unknown', 1),
  ('others', 'others.charity_donations', 'Charity & Donations', 2)
) as source(parent_code, system_code, name, sort_order)
join public.record_categories parent on parent.system_code = source.parent_code
on conflict (system_code) do update set
  parent_id = excluded.parent_id,
  name = excluded.name,
  sort_order = excluded.sort_order;

alter table public.financial_transactions
  add column main_category_id uuid references public.record_categories (id) on delete restrict,
  add column subcategory_id uuid references public.record_categories (id) on delete restrict;
create index financial_transactions_user_categories_idx
  on public.financial_transactions (user_id, main_category_id, subcategory_id)
  where main_category_id is not null;

create or replace function public.assert_visible_record_category_selection(
  p_user_id uuid,
  p_main_category_id uuid,
  p_subcategory_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_main public.record_categories%rowtype;
  v_subcategory public.record_categories%rowtype;
  v_label text;
begin
  select * into v_main from public.record_categories where id = p_main_category_id;
  select * into v_subcategory from public.record_categories where id = p_subcategory_id;
  if v_main.id is null or v_subcategory.id is null
    or v_main.level <> 'main' or v_subcategory.level <> 'subcategory'
    or v_subcategory.parent_id <> v_main.id then
    raise exception 'a valid main category and linked subcategory are required' using errcode = '22023';
  end if;
  if (v_main.user_id is not null and v_main.user_id <> p_user_id)
    or (v_subcategory.user_id is not null and v_subcategory.user_id <> p_user_id)
    or v_main.is_archived or v_subcategory.is_archived then
    raise exception 'selected category is not available' using errcode = '42501';
  end if;
  if exists (select 1 from public.record_category_overrides where user_id = p_user_id and category_id in (v_main.id, v_subcategory.id) and is_hidden) then
    raise exception 'selected category is hidden' using errcode = '22023';
  end if;
  select coalesce(override.name, v_subcategory.name) into v_label
  from (select 1) as ignored
  left join public.record_category_overrides override
    on override.user_id = p_user_id and override.category_id = v_subcategory.id;
  return v_label;
end;
$$;

-- One backward-compatible RPC signature. Existing text-entry calls omit the
-- optional IDs; linked calls supply both. No old posted transaction changes.
drop function public.add_account_record(text,uuid,uuid,numeric,numeric,timestamptz,text,text);
create function public.add_account_record_linked(
  text,uuid,uuid,numeric,numeric,timestamptz,text,text,uuid,uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'internal record-category posting function is not initialized';
end;
$$;
create or replace function public.add_account_record(
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
  v_category_label text;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_record_type = 'transfer' then
    if p_main_category_id is not null or p_subcategory_id is not null then
      raise exception 'transfers cannot have categories' using errcode = '22023';
    end if;
  else
    if (p_main_category_id is null) <> (p_subcategory_id is null) then
      raise exception 'a visible main category and subcategory are required' using errcode = '22023';
    end if;
    if p_main_category_id is not null then
      v_category_label := public.assert_visible_record_category_selection(v_user_id, p_main_category_id, p_subcategory_id);
    elsif nullif(btrim(p_category), '') is null then
      raise exception 'a visible main category and subcategory are required' using errcode = '22023';
    end if;
  end if;
  return public.add_account_record_linked(
    p_record_type, p_account_id, p_counterparty_account_id, p_amount,
    p_received_amount, p_occurred_at, coalesce(v_category_label, p_category), p_notes,
    p_main_category_id, p_subcategory_id
  );
end;
$$;

-- Copy of the established posting logic with only category linkage added.
create or replace function public.add_account_record_linked(
  p_record_type text, p_account_id uuid, p_counterparty_account_id uuid,
  p_amount numeric, p_received_amount numeric, p_occurred_at timestamptz,
  p_category text, p_notes text, p_main_category_id uuid, p_subcategory_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid(); v_account public.financial_accounts%rowtype; v_counterparty public.financial_accounts%rowtype;
  v_transaction public.financial_transactions%rowtype; v_account_balance numeric; v_counterparty_balance numeric; v_received numeric;
begin
  if p_record_type not in ('income', 'expense', 'transfer') then raise exception 'record type must be income, expense, or transfer' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive' using errcode = '22023'; end if;
  if p_occurred_at is null then raise exception 'date and time are required' using errcode = '22023'; end if;
  if p_record_type <> 'transfer' and nullif(btrim(p_category), '') is null then raise exception 'category is required' using errcode = '22023'; end if;
  select * into v_account from public.financial_accounts where id = p_account_id and user_id = v_user_id and is_active and account_type_code in ('cash', 'bank') for update;
  if not found then raise exception 'selected account is not available' using errcode = '42501'; end if;
  select v_account.opening_balance + coalesce(sum(case e.entry_side when 'debit' then e.account_amount else -e.account_amount end) filter (where t.status = 'posted'), 0) into v_account_balance from public.transaction_entries e join public.financial_transactions t on t.id = e.transaction_id where e.account_id = v_account.id and e.asset_id is null;
  if p_record_type = 'transfer' then
    if p_counterparty_account_id is null or p_counterparty_account_id = p_account_id then raise exception 'from and to accounts must be different' using errcode = '22023'; end if;
    select * into v_counterparty from public.financial_accounts where id = p_counterparty_account_id and user_id = v_user_id and is_active and account_type_code in ('cash', 'bank') for update;
    if not found then raise exception 'destination account is not available' using errcode = '42501'; end if;
    v_received := case when v_account.currency_code = v_counterparty.currency_code then p_amount else p_received_amount end;
    if v_received is null or v_received <= 0 then raise exception 'received amount must be positive' using errcode = '22023'; end if;
    if v_account_balance < p_amount then raise exception 'insufficient available balance' using errcode = 'P0002'; end if;
    select v_counterparty.opening_balance + coalesce(sum(case e.entry_side when 'debit' then e.account_amount else -e.account_amount end) filter (where t.status = 'posted'), 0) into v_counterparty_balance from public.transaction_entries e join public.financial_transactions t on t.id = e.transaction_id where e.account_id = v_counterparty.id and e.asset_id is null;
    if v_counterparty.account_type_code = 'bank' and v_counterparty.bank_subtype = 'credit' then
      if v_counterparty.credit_card_limit is null then raise exception 'destination credit account requires a credit card limit before available credit can increase' using errcode = '23514'; end if;
      if v_counterparty_balance + v_received > v_counterparty.credit_card_limit then raise exception 'destination available credit would exceed its credit limit' using errcode = '23514'; end if;
    end if;
  elsif p_record_type = 'expense' and v_account_balance < p_amount then raise exception 'insufficient available balance' using errcode = 'P0002';
  elsif p_record_type = 'income' and v_account.account_type_code = 'bank' and v_account.bank_subtype = 'credit' then
    if v_account.credit_card_limit is null then raise exception 'credit account requires a credit card limit before available credit can increase' using errcode = '23514'; end if;
    if v_account_balance + p_amount > v_account.credit_card_limit then raise exception 'available credit would exceed its credit limit' using errcode = '23514'; end if;
  end if;
  insert into public.financial_transactions (user_id, transaction_type_code, transaction_currency_code, status, occurred_at, description, notes, main_category_id, subcategory_id)
  values (v_user_id, p_record_type, v_account.currency_code, 'draft', p_occurred_at, case p_record_type when 'transfer' then 'Account transfer' else initcap(p_record_type) || ': ' || btrim(p_category) end, nullif(btrim(p_notes), ''), p_main_category_id, p_subcategory_id) returning * into v_transaction;
  if p_record_type = 'income' then
    insert into public.transaction_entries (transaction_id,user_id,account_id,entry_side,transaction_amount,account_amount,memo) values (v_transaction.id,v_user_id,v_account.id,'debit',p_amount,p_amount,btrim(p_category)), (v_transaction.id,v_user_id,null,'credit',p_amount,p_amount,'owner_contribution');
  elsif p_record_type = 'expense' then
    insert into public.transaction_entries (transaction_id,user_id,account_id,entry_side,transaction_amount,account_amount,memo) values (v_transaction.id,v_user_id,null,'debit',p_amount,p_amount,'owner_draw'), (v_transaction.id,v_user_id,v_account.id,'credit',p_amount,p_amount,btrim(p_category));
  else
    insert into public.transaction_entries (transaction_id,user_id,account_id,entry_side,transaction_amount,account_amount,memo) values (v_transaction.id,v_user_id,v_counterparty.id,'debit',p_amount,v_received,'transfer_received'), (v_transaction.id,v_user_id,v_account.id,'credit',p_amount,p_amount,'transfer_sent');
  end if;
  select * into v_transaction from public.post_transaction(v_transaction.id);
  return jsonb_build_object('transaction', to_jsonb(v_transaction));
end;
$$;

alter table public.record_categories enable row level security;
alter table public.record_category_overrides enable row level security;
create policy record_categories_select_visible on public.record_categories for select to authenticated using (user_id is null or user_id = auth.uid());
create policy record_categories_insert_own on public.record_categories for insert to authenticated with check (user_id = auth.uid() and system_code is null);
create policy record_categories_update_own on public.record_categories for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and system_code is null);
create policy record_category_overrides_select_own on public.record_category_overrides for select to authenticated using (user_id = auth.uid());
create policy record_category_overrides_insert_own on public.record_category_overrides for insert to authenticated with check (user_id = auth.uid());
create policy record_category_overrides_update_own on public.record_category_overrides for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy record_category_overrides_delete_own on public.record_category_overrides for delete to authenticated using (user_id = auth.uid());

revoke all on table public.record_categories, public.record_category_overrides from public, anon;
grant select, insert, update on table public.record_categories to authenticated;
grant select, insert, update, delete on table public.record_category_overrides to authenticated;
revoke all on function public.validate_record_category_hierarchy(), public.validate_record_category_override(), public.assert_visible_record_category_selection(uuid,uuid,uuid), public.add_account_record_linked(text,uuid,uuid,numeric,numeric,timestamptz,text,text,uuid,uuid) from public, anon, authenticated;
revoke all on function public.add_account_record(text,uuid,uuid,numeric,numeric,timestamptz,text,text,uuid,uuid) from public, anon;
grant execute on function public.add_account_record(text,uuid,uuid,numeric,numeric,timestamptz,text,text,uuid,uuid) to authenticated;
