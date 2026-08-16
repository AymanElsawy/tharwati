-- Gold/Silver accounts need to capture which metal was purchased, its
-- purity, when it was purchased, and the per-unit cost so a total can be
-- derived (units already exist as balance_grams).

alter table public.financial_accounts
  add column metal_type text,
  add column purity text,
  add column purchase_date date,
  add column cost_per_unit numeric(20, 2);

alter table public.financial_accounts
  add constraint financial_accounts_metal_type_check check (
    metal_type is null
    or (account_type_code = 'gold' and metal_type in ('gold', 'silver'))
  ),
  add constraint financial_accounts_purity_check check (
    purity is null
    or (
      account_type_code = 'gold'
      and (
        (metal_type = 'gold' and purity in ('24k', '22k', '21k', '18k', '14k', '10k', '9k', 'other'))
        or (metal_type = 'silver' and purity in ('999', '958', '950', '925', '900', '835', '800', 'other'))
      )
    )
  ),
  add constraint financial_accounts_purchase_date_check check (
    purchase_date is null or account_type_code = 'gold'
  ),
  add constraint financial_accounts_cost_per_unit_check check (
    cost_per_unit is null or account_type_code = 'gold'
  );
