alter table public.holdings
  drop constraint holdings_account_id_financial_accounts_fkey,
  add constraint holdings_account_id_financial_accounts_fkey
    foreign key (account_id)
    references public.financial_accounts (id)
    on delete restrict;
