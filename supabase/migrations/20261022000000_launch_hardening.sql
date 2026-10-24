begin;
-- Supabase defaults can grant table-wide rights that RLS does not cover.
do $$ declare t text; begin
 foreach t in array array['businesses','app_users','products','ingredients','prepared_stock','sales','sale_items','orders','expenses','work_shifts','rota_shifts'] loop
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['previsio_limits','previsio_discount_approvals','previsio_stock_ledger','previsio_billing_locks','browser_backups'] loop
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant select on public.browser_backups to authenticated;
revoke all on all sequences in schema public from public,anon,authenticated;
grant usage,select on public.app_users_numeric_id_seq,public.sale_items_id_seq to authenticated;
grant all on all sequences in schema public to service_role;
create unique index app_users_business_username on public.app_users(business_id,lower(username));
create unique index app_users_numeric_id on public.app_users(numeric_id);
create index products_business on public.products(business_id,id);
create index ingredients_business on public.ingredients(business_id,id);
create index prepared_stock_business on public.prepared_stock(business_id,id);
create index sales_business_created on public.sales(business_id,created_at desc);
create index sale_items_sale on public.sale_items(sale_id);
create index orders_business_status on public.orders(business_id,status,created_at desc);
create index expenses_business_date on public.expenses(business_id,date);
create index shifts_business_date on public.work_shifts(business_id,date);
create index rota_business_date on public.rota_shifts(business_id,date);
-- Real Supabase Auth users are authoritative. Test bootstrap supplies a synthetic auth.users.
alter table public.app_users add constraint app_users_auth_user foreign key(id) references auth.users(id) on delete cascade;
alter table public.businesses add constraint businesses_auth_owner foreign key(owner_user_id) references auth.users(id);
-- Only add application tables; preserve other publication members.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['orders','products','ingredients','prepared_stock','sales','sale_items'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
    execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
  end loop;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
