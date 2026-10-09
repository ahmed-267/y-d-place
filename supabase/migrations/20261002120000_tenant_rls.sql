-- PreVisio tenant RLS: members of a business (via app_users.id = auth.uid()) may access that tenant's rows.
-- Anon has no access to private tenant tables. Public menu/order uses dedicated policies + RPCs where needed.
-- Apply in Supabase SQL editor or: supabase db push

-- Helper: business ids for the current authenticated user
create or replace function public.previsio_my_business_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select business_id::text
  from public.app_users
  where id::text = auth.uid()::text
    and business_id is not null;
$$;

revoke all on function public.previsio_my_business_ids() from public;
grant execute on function public.previsio_my_business_ids() to authenticated;

create or replace function public.previsio_is_owner_of(biz_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users
    where id::text = auth.uid()::text
      and business_id::text = biz_id
      and role = 'owner'
  );
$$;

revoke all on function public.previsio_is_owner_of(text) from public;
grant execute on function public.previsio_is_owner_of(text) to authenticated;

-- Drop plaintext credential column if present
alter table if exists public.app_users drop column if exists local_password;
alter table if exists public.app_users drop column if exists password;

-- App expects this JSONB map on businesses (onlineOrders, tables, etc.)
alter table if exists public.businesses
  add column if not exists enabled_modules jsonb
  default '{"orders":true,"sales":true,"stock":true,"staff":true,"finance":true,"tables":false,"customers":false,"tips":false,"onlineOrders":false,"parkTickets":false}'::jsonb;

-- Enable RLS on tenant tables (ignore if already enabled)
do $$
declare
  t text;
begin
  foreach t in array array[
    'businesses',
    'app_users',
    'products',
    'ingredients',
    'prepared_stock',
    'sales',
    'sale_items',
    'orders',
    'expenses',
    'work_shifts',
    'rota_shifts'
  ]
  loop
    begin
      execute format('alter table public.%I enable row level security', t);
    exception when undefined_table then
      raise notice 'skip missing table %', t;
    end;
  end loop;
end $$;

-- BUSINESSSES
drop policy if exists previsio_businesses_select on public.businesses;
drop policy if exists previsio_businesses_insert on public.businesses;
drop policy if exists previsio_businesses_update on public.businesses;
drop policy if exists previsio_businesses_delete on public.businesses;

create policy previsio_businesses_select on public.businesses
  for select to authenticated
  using (
    id::text in (select public.previsio_my_business_ids())
    or owner_user_id::text = auth.uid()::text
  );

create policy previsio_businesses_insert on public.businesses
  for insert to authenticated
  with check (owner_user_id::text = auth.uid()::text);

create policy previsio_businesses_update on public.businesses
  for update to authenticated
  using (
    id::text in (select public.previsio_my_business_ids())
    or owner_user_id::text = auth.uid()::text
  )
  with check (
    id::text in (select public.previsio_my_business_ids())
    or owner_user_id::text = auth.uid()::text
  );

create policy previsio_businesses_delete on public.businesses
  for delete to authenticated
  using (public.previsio_is_owner_of(id::text));

-- APP_USERS
drop policy if exists previsio_app_users_select on public.app_users;
drop policy if exists previsio_app_users_insert on public.app_users;
drop policy if exists previsio_app_users_update on public.app_users;
drop policy if exists previsio_app_users_delete on public.app_users;

create policy previsio_app_users_select on public.app_users
  for select to authenticated
  using (
    id::text = auth.uid()::text
    or business_id::text in (select public.previsio_my_business_ids())
  );

-- Owners can insert staff for their business; users can upsert their own owner profile
create policy previsio_app_users_insert on public.app_users
  for insert to authenticated
  with check (
    id::text = auth.uid()::text
    or (
      public.previsio_is_owner_of(business_id::text)
      and coalesce(role, 'staff') <> 'owner'
    )
  );

create policy previsio_app_users_update on public.app_users
  for update to authenticated
  using (
    id::text = auth.uid()::text
    or public.previsio_is_owner_of(business_id::text)
  )
  with check (
    id::text = auth.uid()::text
    or (
      public.previsio_is_owner_of(business_id::text)
      and coalesce(role, 'staff') <> 'owner'
    )
  );

create policy previsio_app_users_delete on public.app_users
  for delete to authenticated
  using (
    public.previsio_is_owner_of(business_id::text)
    and id::text <> auth.uid()::text
  );

-- Generic tenant-scoped tables (business_id column)
do $$
declare
  t text;
  pol text;
begin
  foreach t in array array[
    'products',
    'ingredients',
    'prepared_stock',
    'sales',
    'orders',
    'expenses',
    'work_shifts',
    'rota_shifts'
  ]
  loop
    begin
      execute format('drop policy if exists previsio_%s_all on public.%I', t, t);
      execute format(
        'create policy previsio_%s_all on public.%I for all to authenticated using (business_id::text in (select public.previsio_my_business_ids())) with check (business_id::text in (select public.previsio_my_business_ids()))',
        t, t
      );
    exception when undefined_table then
      raise notice 'skip policies for missing table %', t;
    when undefined_column then
      raise notice 'skip policies for % (no business_id)', t;
    end;
  end loop;
end $$;

-- sale_items: via parent sale
do $$
begin
  begin
    alter table public.sale_items enable row level security;
    drop policy if exists previsio_sale_items_all on public.sale_items;
    create policy previsio_sale_items_all on public.sale_items
      for all to authenticated
      using (
        exists (
          select 1 from public.sales s
          where s.id = sale_items.sale_id
            and s.business_id::text in (select public.previsio_my_business_ids())
        )
      )
      with check (
        exists (
          select 1 from public.sales s
          where s.id = sale_items.sale_id
            and s.business_id::text in (select public.previsio_my_business_ids())
        )
      );
  exception when undefined_table then
    raise notice 'skip sale_items';
  end;
end $$;

-- Public read of active products for businesses with online orders enabled (menu link)
drop policy if exists previsio_products_public_menu on public.products;
do $$
begin
  begin
    create policy previsio_products_public_menu on public.products
      for select to anon, authenticated
      using (
        active is not false
        and exists (
          select 1 from public.businesses b
          where b.id::text = products.business_id::text
            and coalesce((b.enabled_modules->>'onlineOrders')::boolean, false) = true
        )
      );
  exception when undefined_table then
    raise notice 'skip public products policy';
  when undefined_column then
    raise notice 'skip public products policy (schema mismatch)';
  end;
end $$;

-- Online orders are inserted only via server (service role) after price validation.
-- Do not allow anon/authenticated direct inserts — that would bypass price checks.
-- DROP POLICY still errors when the table itself is missing, so skip that case.
do $$
begin
  drop policy if exists previsio_orders_public_insert on public.orders;
exception when undefined_table then
  raise notice 'skip orders public insert policy (table missing)';
end $$;

-- Public can read business name/currency for order page (minimal columns enforced by app select)
do $$
begin
  drop policy if exists previsio_businesses_public_menu on public.businesses;
  create policy previsio_businesses_public_menu on public.businesses
    for select to anon, authenticated
    using (
      coalesce((enabled_modules->>'onlineOrders')::boolean, false) = true
    );
exception when undefined_table then
  raise notice 'skip public businesses policy';
when undefined_column then
  raise notice 'skip public businesses policy (schema mismatch)';
end $$;

comment on function public.previsio_my_business_ids() is 'Tenant membership for RLS — PreVisio';
