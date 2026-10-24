-- Reviewed bridge for the original UUID schema only. Included in upgrade-legacy.sql.
-- Run with the app stopped, as the database owner. The outer transaction is atomic.
set local lock_timeout = '10s';
set local statement_timeout = '120s';
select pg_advisory_xact_lock(hashtextextended('previsio-legacy-upgrade',0));
do $$ declare unexpected text; t text; begin
 if to_regnamespace('previsio_legacy_archive') is not null then
  raise exception 'Upgrade refused: archive already exists. This upgrade runs once.';
 end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='id' and data_type='uuid')
 or exists(select 1 from information_schema.columns where table_schema='public' and table_name='app_users' and column_name='numeric_id') then
  raise exception 'Upgrade refused: database is not the original UUID schema.';
 end if;
 select string_agg(c.relname,', ') into unexpected from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p','v','m','f')
 and c.relname <> all(array['businesses','app_users','products','ingredients','product_ingredients','sales','sale_items','sale_item_extras','expenses','work_shifts']);
 if unexpected is not null then raise exception 'Upgrade refused: additional tables/views need review: %',unexpected; end if;
 foreach t in array array['businesses','app_users','products','ingredients','product_ingredients','sales','sale_items','sale_item_extras','expenses','work_shifts'] loop
  if to_regclass('public.'||t) is null then raise exception 'Upgrade refused: expected table % is missing',t; end if;
  execute format('lock table public.%I in access exclusive mode',t);
 end loop;
 if exists(select 1 from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not g.tgisinternal) then
  raise exception 'Upgrade refused: custom triggers require review.';
 end if;
 if exists(select 1 from pg_trigger g join pg_proc p on p.oid=g.tgfoid join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and not g.tgisinternal) then
  raise exception 'Upgrade refused: an external trigger uses an application function and requires review.';
 end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind<>'f'
 and not (p.prokind='p' and p.oid=to_regprocedure('public.create_rls_policy(text)')
          and pg_get_userbyid(p.proowner)='postgres' and not p.prosecdef
          and p.prolang=(select oid from pg_language where lanname='plpgsql'))
 and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')) then
  raise exception 'Upgrade refused: additional public procedures/aggregates need review.';
 end if;
 if exists(select 1 from pg_constraint k join pg_class target on target.oid=k.confrelid join pg_namespace tn on tn.oid=target.relnamespace
  join pg_class source on source.oid=k.conrelid join pg_namespace sn on sn.oid=source.relnamespace
  where k.contype='f' and tn.nspname='public' and sn.nspname<>'public') then
  raise exception 'Upgrade refused: external foreign keys reference application tables and need review.';
 end if;
 if exists(select 1 from public.app_users u left join auth.users a on a.id=u.id where a.id is null)
 or exists(select 1 from public.businesses b left join auth.users a on a.id=b.owner_user_id where a.id is null) then
  raise exception 'Upgrade refused: an existing profile/owner is missing from Auth. No data changed.';
 end if;
 if exists(select 1 from public.product_ingredients r join public.products p on p.id=r.product_id join public.ingredients i on i.id=r.ingredient_id where r.business_id<>p.business_id or r.business_id<>i.business_id or r.quantity_used<=0) then
  raise exception 'Upgrade refused: inconsistent recipe ownership/quantity.';
 end if;
 if exists(select 1 from public.sale_items i join public.sales s on s.id=i.sale_id join public.products p on p.id=i.product_id where p.business_id<>s.business_id) then
  raise exception 'Upgrade refused: cross-business sale product reference.';
 end if;
 if exists(select 1 from public.work_shifts s join public.app_users u on u.id=s.user_id where s.business_id<>u.business_id) then
  raise exception 'Upgrade refused: cross-business shift reference.';
 end if;
end $$;
create schema previsio_legacy_archive;
revoke all on schema previsio_legacy_archive from public,anon,authenticated,service_role;
-- Retain original tables, constraints, UUIDs and records. Remove their API grants
-- and publication entries before moving them out of the public API schema.
do $$ declare r record; t text; begin
 for r in select pubname,tablename from pg_publication_tables where schemaname='public' loop
  execute format('alter publication %I drop table public.%I',r.pubname,r.tablename);
 end loop;
 foreach t in array array['businesses','app_users','products','ingredients','product_ingredients','sales','sale_items','sale_item_extras','expenses','work_shifts'] loop
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('alter table public.%I set schema previsio_legacy_archive',t);
 end loop;
 -- Preserve the reported legacy policy procedure without ever calling its body.
 if exists(select 1 from pg_proc where oid=to_regprocedure('public.create_rls_policy(text)') and prokind='p') then
  revoke all on procedure public.create_rls_policy(text) from public,anon,authenticated,service_role;
  alter procedure public.create_rls_policy(text) set schema previsio_legacy_archive;
 end if;
 -- Old user-defined RPCs/policy helpers must not remain publicly callable.
 -- Extension-owned routines are left untouched.
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind='f' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
  execute format('alter function %s set schema previsio_legacy_archive',r.signature);
 end loop;
end $$;
revoke all on all sequences in schema previsio_legacy_archive from public,anon,authenticated,service_role;
