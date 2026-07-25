alter table public.exchange_rates
  add column updated_at timestamptz
    constraint exchange_rates_updated_at_not_null not null
    default now();

create trigger exchange_rates_set_updated_at
before update on public.exchange_rates
for each row
execute function public.set_updated_at();

-- Exchange rates are a shared catalog in the existing model. MVP management
-- therefore grants authenticated users global CRUD access rather than adding
-- ownership semantics or a parallel per-user table.
create policy exchange_rates_insert_authenticated
on public.exchange_rates
for insert
to authenticated
with check (true);

create policy exchange_rates_update_authenticated
on public.exchange_rates
for update
to authenticated
using (true)
with check (true);

create policy exchange_rates_delete_authenticated
on public.exchange_rates
for delete
to authenticated
using (true);
