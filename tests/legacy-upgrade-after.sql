create or replace function public.test_assert(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
select test_assert(to_regprocedure('public.create_rls_policy(text)') is null,'legacy procedure removed from public');
select test_assert(to_regprocedure('previsio_legacy_archive.create_rls_policy(text)') is not null,'legacy procedure retained');
select test_assert(not has_function_privilege('anon','previsio_legacy_archive.create_rls_policy(text)','EXECUTE')
 and not has_function_privilege('authenticated','previsio_legacy_archive.create_rls_policy(text)','EXECUTE')
 and not has_function_privilege('service_role','previsio_legacy_archive.create_rls_policy(text)','EXECUTE'),'legacy procedure execute grants revoked');
select test_assert((select count(*)=3 from app_users),'profiles preserved');
select test_assert((select count(*)=2 from businesses),'businesses preserved');
select test_assert((select count(*)=1 from previsio_legacy_archive.sale_item_extras),'unlinked extras archived');
select test_assert(not has_schema_privilege('authenticated','previsio_legacy_archive','USAGE'),'archive private');
select test_assert(not has_table_privilege('anon','previsio_legacy_archive.app_users','SELECT'),'legacy grants revoked');
select test_assert(to_regprocedure('public.old_profile_lookup()') is null,'old insecure RPC removed from API');
select test_assert((select payment_method='Card' and subtotal=6 from sales),'sales converted');
select test_assert((select unit_price=3 and qty=2 from sale_items),'historical unit price recovered');
select test_assert((select ingredient_links='[{"ingredientId":1,"quantityUsed":18,"unit":"g"}]'::jsonb from products),'recipe mapping preserved');
select test_assert((select user_id=3 and total_hours=7.5 from work_shifts),'shift user mapped');
select test_assert((select count(*)=6 from pg_publication_tables where pubname='supabase_realtime'),'Realtime contains only current tables');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claim.role','authenticated',false);
select test_assert((select count(*)=1 from businesses),'tenant isolation after migration');
select test_assert((select count(*)=2 from app_users),'owner sees only own staff');
select test_assert((select email is null and numeric_id=1 from app_users where id=auth.uid()),'new login columns selectable');
update businesses set address='123 Test Street',brand_theme='{"paletteId":"forest"}' where owner_user_id=auth.uid();
select test_assert((select address='123 Test Street' from businesses),'onboarding settings save');
reset role;
-- Reproduce a brand-new confirmed owner completing initial provisioning.
insert into auth.users values('10000000-0000-4000-8000-000000000004');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
insert into businesses(id,owner_user_id,name,owner_name,owner_email,address,discount_policy,brand_theme) values('new-onboarding',auth.uid(),'New cafe','New owner','new@example.test','Street','{}','{}');
insert into app_users(id,business_id,username,full_name,role) values(auth.uid(),'new-onboarding','new-owner','New Owner','owner');
select test_assert((select numeric_id=4 from app_users where id=auth.uid()),'identity sequence and new registration work');
insert into products(id,business_id,name_en,price) values(999,'new-onboarding','New product',4);
select test_assert((select count(*)=1 from products),'new owner can save onboarding menu');
reset role;

-- Existing staff can take a real sale with migrated products and recipe links.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
select previsio_record_sale('20000000-0000-4000-8000-000000000001',
 '{"id":"POST-UPGRADE-SALE","business_id":"20000000-0000-4000-8000-000000000001","subtotal":3,"payment_method":"Card"}',
 '[{"sale_id":"POST-UPGRADE-SALE","product_id":1,"qty":1,"unit_price":3,"line_total":3}]',null);
select test_assert((select qty=482 from ingredients where id=1),'migrated recipe deducts correct stock');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select previsio_reverse_sale('20000000-0000-4000-8000-000000000001','POST-UPGRADE-SALE','refunded','Test');
select test_assert((select qty=500 from ingredients where id=1),'new sale refund restores migrated stock');
reset role;
