create type role_enum as enum('owner','manager','staff');
create type payment_enum as enum('cash','card');
create type expense_enum as enum('rent','supplies','other');
create type frequency_enum as enum('monthly','yearly');
create table businesses(id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),name text not null,owner_user_id uuid not null unique,owner_name text not null,owner_email text not null,owner_phone text not null default '',venue_type text not null,country text not null,city text not null,currency_code text not null,currency_symbol text not null,language text not null default 'en',opening_hours text not null default '',setup_completed boolean not null default false,plan text default 'none',stripe_customer_id text,stripe_subscription_id text,trial_ends_at timestamptz,current_period_ends_at timestamptz,subscription_status text,enabled_modules jsonb default '{}');
create table app_users(id uuid primary key references auth.users(id),business_id uuid references businesses(id),username text not null,full_name text not null,role role_enum not null default 'staff',hourly_rate numeric,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table ingredients(id uuid primary key default gen_random_uuid(),business_id uuid not null references businesses(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),name text not null,unit text not null,qty numeric not null default 0,low_threshold numeric not null default 0);
create table products(id uuid primary key default gen_random_uuid(),business_id uuid not null references businesses(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),name_en text not null,translations jsonb not null default '{}',category text not null,price numeric not null,emoji text,active boolean not null default true);
create table product_ingredients(id uuid primary key default gen_random_uuid(),business_id uuid not null references businesses(id),product_id uuid not null references products(id),ingredient_id uuid not null references ingredients(id),quantity_used numeric not null);
create table sales(id uuid primary key default gen_random_uuid(),business_id uuid not null references businesses(id),created_at timestamptz not null default now(),subtotal numeric not null,payment_method payment_enum not null,cashier_user_id uuid references app_users(id),cashier_username text not null,cashier_fullname text not null);
create table sale_items(id uuid primary key default gen_random_uuid(),sale_id uuid not null references sales(id),product_id uuid references products(id),name_en text not null,translations jsonb not null default '{}',qty integer not null,line_total numeric not null,extras jsonb not null default '[]');
create table sale_item_extras(id bigserial primary key,sale_item_id bigint not null,product_id bigint,name_en text not null,price numeric not null);
create table expenses(id uuid primary key default gen_random_uuid(),business_id uuid not null references businesses(id),name text not null,category expense_enum not null,amount numeric not null,date date not null,is_recurring boolean not null default false,frequency frequency_enum,receipt_image text);
create table work_shifts(id uuid primary key default gen_random_uuid(),business_id uuid not null references businesses(id),user_id uuid not null references app_users(id),date date not null,start_time time not null,end_time time not null,break_minutes integer not null default 0,total_hours numeric not null,notes text);
grant all on all tables in schema public to anon,authenticated;
grant all on all sequences in schema public to anon,authenticated;
do $$ declare t text; begin foreach t in array array['businesses','app_users','products','ingredients','product_ingredients','sales','sale_items','expenses','work_shifts'] loop
 execute format('alter table %I enable row level security',t);
 execute format('alter table %I force row level security',t);
 execute format('create policy old_permissive on %I for all using (true) with check (true)',t);
end loop; end $$;
create function public.old_profile_lookup() returns setof public.app_users language sql security definer as $$ select * from public.app_users $$;
create publication supabase_realtime;
alter publication supabase_realtime add table products,sales;
insert into auth.users(id) values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003');
insert into businesses(id,name,owner_user_id,owner_name,owner_email,venue_type,country,city,currency_code,currency_symbol,plan,enabled_modules) values
('20000000-0000-4000-8000-000000000001','Demo Cafe','10000000-0000-4000-8000-000000000001','Owner','owner@example.test','Cafe','UK','London','GBP','£','pro','{"parkTickets":true,"sales":true}'),
('20000000-0000-4000-8000-000000000002','Other Cafe','10000000-0000-4000-8000-000000000002','Other','other@example.test','Cafe','UK','London','GBP','£','none','{}');
insert into app_users(id,business_id,username,full_name,role) values
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','owner','Owner','owner'),
('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','other','Other','owner'),
('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','staff','Staff','staff');
insert into products(id,business_id,name_en,category,price) values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Coffee','Drinks',3);
insert into ingredients(id,business_id,name,unit,qty) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Beans','g',500);
insert into product_ingredients(business_id,product_id,ingredient_id,quantity_used) values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',18);
insert into sales(id,business_id,subtotal,payment_method,cashier_username,cashier_fullname) values('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',6,'card','staff','Staff');
insert into sale_items(sale_id,product_id,name_en,qty,line_total) values('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Coffee',2,6);
insert into sale_item_extras(sale_item_id,product_id,name_en,price) values(123,456,'Unlinked legacy extra',1);
insert into expenses(business_id,name,category,amount,date,is_recurring,frequency) values('20000000-0000-4000-8000-000000000001','Rent','rent',500,current_date,true,'monthly');
insert into work_shifts(business_id,user_id,date,start_time,end_time,break_minutes,total_hours) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',current_date,'09:00','17:00',30,7.5);

-- Match the hosted procedure metadata; executing it must fail the test.
create procedure public.create_rls_policy(IN table_name text) language plpgsql as $$
begin raise exception 'Legacy procedure must never execute during upgrade'; end $$;
grant execute on procedure public.create_rls_policy(text) to anon,authenticated,service_role;
