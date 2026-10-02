-- Dedicated LOCAL DEVELOPMENT fixture policy ONLY. Not commercial recommendations.
-- Never apply this file to hosted/production; the migration has no defaults.
select public.configure_provider_capacity('twelve_data',60,300,120,600,true);
select public.configure_provider_capacity('asset_search',10,30,null,null,true);
select public.configure_provider_capacity('frankfurter',10,50,20,100,true);
select public.configure_provider_capacity('gold_api',4,20,8,40,true);
