\set ON_ERROR_STOP on
-- Fail-fast assertions, executed against a disposable database only.
create function public.test_assert(ok boolean, label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function public.test_denied(statement text) returns boolean language plpgsql as $$ begin execute statement; return false; exception when others then return true; end $$;
insert into auth.users(id) select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,5) i;
insert into businesses(id,owner_user_id,name,plan,setup_completed,enabled_modules) values
 ('A','00000000-0000-0000-0000-000000000001','A','pro',true,'{"onlineOrders":true}'),
 ('B','00000000-0000-0000-0000-000000000002','B','pro',true,'{"onlineOrders":true}');
insert into app_users(id,business_id,username,full_name,role) values
 ('00000000-0000-0000-0000-000000000001','A','owner-a','Owner A','owner'),
 ('00000000-0000-0000-0000-000000000002','B','owner-b','Owner B','owner'),
 ('00000000-0000-0000-0000-000000000003','A','staff-a','Staff A','staff'),
 ('00000000-0000-0000-0000-000000000004','A','manager-a','Manager A','manager');
insert into ingredients values(1,'A','Beans','g',10,1),(2,'B','Beans','g',10,1);
insert into products(id,business_id,name_en,price,ingredient_links) values(1,'A','Coffee',5,'[{"ingredientId":1,"quantityUsed":1}]'),(2,'B','Coffee',5,'[]');
set role anon;
select test_assert(test_denied('select * from businesses'),'anonymous business privacy');
select test_assert(test_denied('select * from products'),'anonymous product privacy');
reset role;
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select test_assert((select count(*)=1 from businesses),'cross-tenant reads');
select test_assert(test_denied($q$update app_users set role='owner' where username='staff-a'$q$),'self promotion');
select test_assert(test_denied($q$update app_users set business_id='B' where username='staff-a'$q$),'membership reassignment');
select test_assert(test_denied($q$update products set price=1 where id=1$q$),'staff price changes');
update products set active=false where id=1;
select test_assert((select not active from products where id=1),'staff availability toggle');
update products set active=true where id=1;
update app_users set full_name='Updated Staff' where username='staff-a';
select test_assert((select full_name='Updated Staff' from app_users where username='staff-a'),'profile editing');
select test_assert(test_denied($q$select previsio_mutate('ingredients','B','[{"row":{"id":2,"business_id":"B","qty":0},"expected":0}]')$q$),'cross-tenant write');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select test_assert(test_denied($q$update businesses set plan='trialing',trial_ends_at=now()+interval '100 years' where id='A'$q$),'billing manipulation');
select test_assert(test_denied($q$update businesses set owner_user_id='00000000-0000-0000-0000-000000000003' where id='A'$q$),'ownership manipulation');
select previsio_mutate('ingredients','A','[{"row":{"id":1,"business_id":"A","qty":12},"expected":0}]');
select test_assert((select qty=12 and revision=1 from ingredients where id=1),'explicit cloud update');
select test_assert(test_denied($q$select previsio_mutate('ingredients','A','[{"row":{"id":1,"business_id":"A","qty":0},"expected":0}]')$q$),'stale writes rejected');
select previsio_mutate('products','A','[{"row":{"id":3,"business_id":"A","name_en":"Tea","price":2},"expected":null}]');
select test_assert((select price=2 from products where id=3),'new product inserted');
select previsio_mutate('products','A','[{"row":{"id":3,"business_id":"A"},"expected":0,"delete":true}]');
select test_assert((select count(*)=0 from products where id=3),'delete persisted');
select previsio_record_sale('A','{"id":"S1","business_id":"A","subtotal":5,"payment_method":"Cash"}','[{"sale_id":"S1","product_id":1,"qty":1,"unit_price":5,"line_total":5,"name_en":"Coffee"}]','{"id":"O1","business_id":"A","type":"WalkIn","items":[],"subtotal":5}');
select test_assert((select qty=11 from ingredients where id=1),'sale consumes stock');
select test_assert((select count(*)=1 from sale_items where sale_id='S1'),'sale lines committed');
select test_assert((select status='Completed' and sale_id='S1' from orders where id='O1'),'order completed atomically');
select previsio_record_sale('A','{"id":"S1","business_id":"A","subtotal":5,"payment_method":"Cash"}','[{"sale_id":"S1","product_id":1,"qty":1,"unit_price":5,"line_total":5,"name_en":"Coffee"}]','{"id":"O1","business_id":"A","type":"WalkIn","items":[],"subtotal":5}');
select test_assert(test_denied($q$select previsio_record_sale('A','{"id":"S1","business_id":"A","subtotal":10,"payment_method":"Cash"}','[{"sale_id":"S1","product_id":1,"qty":2,"unit_price":5,"line_total":10}]',null)$q$),'reused checkout identifier rejects changed content');
select test_assert((select qty=11 from ingredients where id=1),'sale retry idempotent');
select test_assert(test_denied($q$select previsio_record_sale('A','{"id":"FAIL","business_id":"A","subtotal":100}','[{"sale_id":"FAIL","product_id":1,"qty":20,"unit_price":5,"line_total":100}]',null)$q$),'insufficient stock rejects sale');
select test_assert((select count(*)=0 from sales where id='FAIL') and (select qty=11 from ingredients where id=1),'failed transaction rolls back');
select test_assert(test_denied($q$select previsio_record_sale('A','{"id":"BAD-TIP","business_id":"A","subtotal":5,"tip_amount":"NaN","payment_method":"Cash"}','[{"sale_id":"BAD-TIP","product_id":1,"qty":1,"unit_price":5,"line_total":5}]',null)$q$),'invalid monetary strings rejected');
select test_assert(test_denied($q$select previsio_record_sale('A','{"id":"PRICE","business_id":"A","subtotal":1}','[{"sale_id":"PRICE","product_id":1,"qty":1,"unit_price":1,"line_total":1}]',null)$q$),'server price validation');
select previsio_reverse_sale('A','S1','refunded','test');
select previsio_reverse_sale('A','S1','refunded','test');
select test_assert((select qty=12 from ingredients where id=1),'refund restores stock exactly once');
select test_assert((select status='refunded' from sales where id='S1'),'refund persisted');
select previsio_reverse_sale('A','S1','voided','reopen','Ready');
select test_assert((select status='Ready' and sale_id is null from orders where id='O1') and (select qty=12 from ingredients where id=1),'reopening resets order without restoring stock twice');
-- Staff can log their own shifts, but cannot use another employee's identity.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select test_assert(test_denied($q$select previsio_mutate('work_shifts','A','[{"row":{"id":"SHIFT-TEST","business_id":"A","user_id":3,"date":"2026-10-18","total_hours":1},"expected":null}]')$q$),'staff cannot log their own shifts');
select test_assert(test_denied($q$select previsio_mutate('work_shifts','A','[{"row":{"id":"SHIFT-OTHER","business_id":"A","user_id":1,"username":"owner-a"},"expected":null}]')$q$),'staff cannot log another employee shift');
select test_assert(test_denied($q$select previsio_reverse_sale('B','S1','refunded','test')$q$),'reverse sale cannot cross tenants');
select test_assert(test_denied($q$select previsio_record_sale('A','{"id":"DISCOUNT","business_id":"A","subtotal":10,"discount_amount":6,"payment_method":"Cash"}','[{"sale_id":"DISCOUNT","product_id":1,"qty":2,"unit_price":5,"line_total":10}]',null)$q$),'staff discount requires real manager approval');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select previsio_approve_discount('A','DISCOUNT-ORDER',6) as approval_token \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select previsio_record_sale('A',jsonb_build_object('id','DISCOUNT','business_id','A','subtotal',10,'discount_amount',6,'payment_method','Cash','approval_token',:'approval_token'),
 '[{"sale_id":"DISCOUNT","product_id":1,"qty":2,"unit_price":5,"line_total":10}]','{"id":"DISCOUNT-ORDER","business_id":"A","items":[],"subtotal":10}');
select test_assert((select discount_amount=6 from sales where id='DISCOUNT'),'approved discount saved');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select previsio_reverse_sale('A','DISCOUNT','voided','test');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select previsio_amend_sale('A','S1','Card',5,false);
select test_assert((select payment_method='Card' from sales where id='S1'),'payment correction works');
select test_assert(test_denied($q$select previsio_amend_sale('A','S1','Card',100,false)$q$),'historical totals cannot diverge from items');
select previsio_amend_sale('A','S1',null,null,true);
select test_assert((select archived_at is not null from sales where id='S1'),'removed sale retains audit record');
-- New user onboarding may create their own business, but cannot join somebody else's.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
select test_assert(test_denied($q$insert into app_users(id,business_id,username,role) values('00000000-0000-0000-0000-000000000005','A','attacker','owner')$q$),'malicious initial membership');
insert into businesses(id,owner_user_id,name,plan) values('C','00000000-0000-0000-0000-000000000005','New Business','pro');
select test_assert((select plan='none' from businesses where id='C'),'onboarding cannot grant Pro');
insert into app_users(id,business_id,username,role) values('00000000-0000-0000-0000-000000000005','C','new-owner','owner');
select test_assert((select previsio_role('C')='owner'),'owner onboarding works');
reset role;
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claim.role','service_role',false);
set role service_role;
select test_assert(previsio_rate_limit('test',2,60),'first request allowed');
select test_assert(previsio_rate_limit('test',2,60),'second request allowed');
select test_assert(not previsio_rate_limit('test',2,60),'shared rate limit enforced');
select test_assert(previsio_claim_billing_lock('A','10000000-0000-0000-0000-000000000001'),'billing lease acquired');
select test_assert(not previsio_claim_billing_lock('A','10000000-0000-0000-0000-000000000002'),'parallel billing reconciliation blocked');
select previsio_release_billing_lock('A','10000000-0000-0000-0000-000000000001');
select test_assert(previsio_claim_billing_lock('A','10000000-0000-0000-0000-000000000002'),'billing lease released');
reset role;
select 'ALL DATABASE ASSERTIONS PASSED' as result;
