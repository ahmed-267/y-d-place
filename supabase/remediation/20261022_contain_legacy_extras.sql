-- Targeted containment for the legacy schema reported by the owner.
-- Does not delete records, change identifiers, or install the new app schema.
-- This repository uses sale_items.extras JSON, not sale_item_extras.
-- The legacy extras table has bigint references incompatible with UUID parent IDs.
-- Quarantine client access rather than inventing an unsafe tenant relationship.
-- Run separately from the application migrations, after reviewing other consumers.
begin;
do $$
declare target text;
begin
 if to_regclass('public.sale_item_extras') is not null then
  alter table public.sale_item_extras enable row level security;
  alter table public.sale_item_extras force row level security;
  revoke all privileges on table public.sale_item_extras from public,anon,authenticated;
 end if;
 if to_regclass('public.sale_item_extras_id_seq') is not null then
  revoke all privileges on sequence public.sale_item_extras_id_seq from public,anon,authenticated;
 end if;
 -- These table-wide privileges are not required by the app's CRUD operations.
 foreach target in array array['app_users','businesses','expenses','ingredients','product_ingredients','products','sale_item_extras','sale_items','sales','work_shifts'] loop
  if to_regclass('public.'||target) is not null then
   execute format('revoke truncate,references,trigger on table public.%I from public,anon,authenticated',target);
  end if;
 end loop;
end $$;
commit;
-- Verify the table is protected without querying its contents.
select relname,relrowsecurity,relforcerowsecurity from pg_class
where oid=to_regclass('public.sale_item_extras');
select grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='sale_item_extras' and grantee in ('anon','authenticated','PUBLIC');
