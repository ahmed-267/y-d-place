begin;
-- Replace ALL policies on the managed tables; permissive legacy policies otherwise bypass fixes.
do $$ declare p record; begin
 for p in select schemaname, tablename, policyname from pg_policies where schemaname='public'
 and tablename = any(array['businesses','app_users','products','ingredients','prepared_stock','sales','sale_items','orders','expenses','work_shifts','rota_shifts']) loop
 execute format('drop policy %I on %I.%I', p.policyname,p.schemaname,p.tablename);
 end loop;
end $$;
create or replace function public.previsio_role(biz text) returns text
language sql stable security definer set search_path=public as $$
 select role from app_users where id::text=auth.uid()::text and business_id::text=biz
$$;
create or replace function public.previsio_active(biz text) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce(plan='pro' or (plan='trialing' and trial_ends_at>now()),false) from businesses where id::text=biz
$$;
revoke all on function public.previsio_role(text), public.previsio_active(text) from public;
grant execute on function public.previsio_role(text), public.previsio_active(text) to authenticated;

create policy businesses_read on public.businesses for select to authenticated
 using (previsio_role(id::text) is not null or owner_user_id::text=auth.uid()::text);
create policy businesses_create on public.businesses for insert to authenticated
 with check(owner_user_id::text=auth.uid()::text and not exists(select 1 from app_users where id::text=auth.uid()::text));
create policy businesses_edit on public.businesses for update to authenticated
 using(previsio_role(id::text) in ('owner','manager') or owner_user_id::text=auth.uid()::text)
 with check(previsio_role(id::text) in ('owner','manager') or owner_user_id::text=auth.uid()::text);
create policy profiles_read on public.app_users for select to authenticated
 using(id::text=auth.uid()::text or previsio_role(business_id::text) in ('owner','manager'));
-- Safe onboarding recovery: a self-created owner profile must reference a business actually owned by that user.
create policy profiles_create on public.app_users for insert to authenticated with check(
 id::text=auth.uid()::text and role='owner' and exists(select 1 from businesses b where b.id::text=business_id::text and b.owner_user_id::text=auth.uid()::text));
create policy profiles_edit on public.app_users for update to authenticated
 using(id::text=auth.uid()::text or previsio_role(business_id::text)='owner')
 with check(id::text=auth.uid()::text or previsio_role(business_id::text)='owner');
create policy profiles_delete on public.app_users for delete to authenticated
 using(previsio_role(business_id::text)='owner' and role<>'owner' and id::text<>auth.uid()::text);

-- Immutable identity and protected fields are enforced even if a caller bypasses the UI.
create or replace function public.previsio_guard_fields() returns trigger
language plpgsql set search_path=public as $$
begin
 if auth.role()='service_role' or auth.uid() is null then return new; end if;
 if tg_table_name='businesses' then
  if tg_op='INSERT' then
   new.plan := 'none'; new.subscription_status := null; new.trial_ends_at := null;
   new.stripe_customer_id := null; new.stripe_subscription_id := null; new.current_period_ends_at := null;
  elsif (to_jsonb(new)-array['name','owner_name','owner_email','owner_phone','venue_type','country','city','address','opening_hours','currency_code','currency_symbol','language','enabled_modules','discount_policy','brand_theme','categories','setup_completed'])
   is distinct from (to_jsonb(old)-array['name','owner_name','owner_email','owner_phone','venue_type','country','city','address','opening_hours','currency_code','currency_symbol','language','enabled_modules','discount_policy','brand_theme','categories','setup_completed']) then
    raise exception 'Protected business fields cannot be changed';
  end if;
 elsif tg_table_name='app_users' then
  if new.role not in ('owner','manager','staff') then raise exception 'Invalid role'; end if;
  if new.id is distinct from old.id or new.business_id is distinct from old.business_id then raise exception 'Identity and membership are immutable'; end if;
  if previsio_role(old.business_id::text)<>'owner' or old.id::text=auth.uid()::text then
   if (to_jsonb(new)-array['full_name','username','revision']) is distinct from (to_jsonb(old)-array['full_name','username','revision']) then raise exception 'Only personal profile fields may be changed'; end if;
  elsif new.role='owner' or old.role='owner' then raise exception 'Ownership cannot be changed here';
  end if;
 elsif tg_table_name='products' and previsio_role(old.business_id::text)='staff' then
  if (to_jsonb(new)-array['active','revision']) is distinct from (to_jsonb(old)-array['active','revision']) then raise exception 'Staff can only toggle menu availability'; end if;
 end if;
 return new;
end $$;
create trigger previsio_business_guard before insert or update on public.businesses for each row execute function public.previsio_guard_fields();
create trigger previsio_profile_guard before update on public.app_users for each row execute function public.previsio_guard_fields();
create trigger previsio_product_guard before update on public.products for each row execute function public.previsio_guard_fields();

do $$ declare t text; begin
 foreach t in array array['products','ingredients','prepared_stock','orders','sales','expenses','work_shifts','rota_shifts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy tenant_read on public.%I for select to authenticated using (previsio_role(business_id::text) is not null)', t);
 if t in ('products','ingredients','prepared_stock') then
 execute format('create policy tenant_insert on public.%I for insert to authenticated with check (previsio_role(business_id::text) in (''owner'',''manager'') and (previsio_active(business_id::text) or exists(select 1 from businesses b where b.id::text=business_id::text and not b.setup_completed)))',t);
 execute format('create policy tenant_update on public.%I for update to authenticated using (previsio_role(business_id::text) is not null) with check (previsio_role(business_id::text) is not null and (previsio_active(business_id::text) or exists(select 1 from businesses b where b.id::text=business_id::text and not b.setup_completed)))',t);
 execute format('create policy tenant_delete on public.%I for delete to authenticated using (previsio_role(business_id::text) in (''owner'',''manager''))',t);
 elsif t='orders' then
 execute format('create policy tenant_write on public.%I for all to authenticated using (previsio_role(business_id::text) is not null and previsio_active(business_id::text)) with check (previsio_role(business_id::text) is not null and previsio_active(business_id::text))',t);
 elsif t<>'sales' then
 execute format('create policy manager_write on public.%I for all to authenticated using (previsio_role(business_id::text) in (''owner'',''manager'') and previsio_active(business_id::text)) with check (previsio_role(business_id::text) in (''owner'',''manager'') and previsio_active(business_id::text))',t);
 end if;
 end loop;
end $$;
-- Financial details and staff pay are restricted; staff can read their own shifts.
drop policy tenant_read on public.expenses;
create policy expense_read on public.expenses for select to authenticated using(previsio_role(business_id::text) in ('owner','manager'));
drop policy tenant_read on public.work_shifts;
create policy shift_self_write on public.work_shifts for all to authenticated using(previsio_role(business_id::text) is not null and previsio_active(business_id::text) and user_id::text=(select u.numeric_id::text from app_users u where u.id::text=auth.uid()::text)) with check(previsio_role(business_id::text) is not null and previsio_active(business_id::text) and user_id::text=(select u.numeric_id::text from app_users u where u.id::text=auth.uid()::text));
create policy shift_read on public.work_shifts for select to authenticated using(previsio_role(business_id::text) in ('owner','manager') or (previsio_role(business_id::text) is not null and user_id::text=(select u.numeric_id::text from app_users u where u.id::text=auth.uid()::text)));
create policy sale_items_read on public.sale_items for select to authenticated using(exists(select 1 from sales s where s.id=sale_id));
revoke all on public.businesses, public.app_users, public.products, public.ingredients, public.prepared_stock, public.sales, public.sale_items, public.orders, public.expenses, public.work_shifts, public.rota_shifts from anon;
grant select,insert,update,delete on public.businesses, public.app_users, public.products, public.ingredients, public.prepared_stock, public.sales, public.sale_items, public.orders, public.expenses, public.work_shifts, public.rota_shifts to authenticated;
grant usage,select on all sequences in schema public to authenticated;

create table public.previsio_limits(key text primary key, count integer not null, expires_at timestamptz not null);
alter table public.previsio_limits enable row level security;
create function public.previsio_rate_limit(bucket_key text, maximum integer, window_seconds integer) returns boolean
language plpgsql security definer set search_path=public as $$
declare used integer; begin
 if maximum<1 or window_seconds<1 then raise exception 'Invalid limit'; end if;
 delete from previsio_limits where expires_at < now()-interval '1 day';
 insert into previsio_limits as l values(bucket_key,1,now()+make_interval(secs=>window_seconds))
 on conflict(key) do update set count=case when l.expires_at<=now() then 1 else least(l.count+1,maximum+1) end,
 expires_at=case when l.expires_at<=now() then now()+make_interval(secs=>window_seconds) else l.expires_at end returning count into used;
 return used<=maximum;
end $$;
revoke all on function public.previsio_rate_limit(text,integer,integer) from public;
grant execute on function public.previsio_rate_limit(text,integer,integer) to service_role;
commit;
