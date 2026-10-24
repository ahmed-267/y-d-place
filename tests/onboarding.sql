-- Run after the standard test_assert helper has been installed.
create or replace function public.test_denied(statement text) returns boolean language plpgsql as $$ begin execute statement; return false; exception when others then return true; end $$;
insert into auth.users(id) values('90000000-0000-4000-8000-000000000001'),('90000000-0000-4000-8000-000000000002'),('90000000-0000-4000-8000-000000000003');
insert into app_users(id,username,role) values('90000000-0000-4000-8000-000000000002','unfinished','staff');
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',false);
select previsio_provision_business('{"name":"Atomic cafe","city":"London","owner_name":"Atomic owner","plan":"pro","role":"owner"}');
select previsio_provision_business('{"name":"Updated cafe","city":"London","owner_name":"Atomic owner"}');
select test_assert((select count(*)=1 from businesses where owner_user_id=auth.uid()),'onboarding retry creates one business');
select test_assert((select name='Updated cafe' and plan='none' from businesses where owner_user_id=auth.uid()),'retry saves settings without billing escalation');
select test_assert((select numeric_id>0 and role='owner' and business_id is not null from app_users where id=auth.uid()),'profile and business committed together');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',false);
select previsio_provision_business('{"name":"Recovered cafe","city":"London","owner_name":"Recovered owner"}');
select test_assert((select role='owner' and business_id is not null from app_users where id=auth.uid()),'unfinished self profile recovered');
reset role;
-- Fail after business creation: there must be no partial business left behind.
create function test_fail_profile() returns trigger language plpgsql as $$ begin if new.id='90000000-0000-4000-8000-000000000003' then raise exception 'Synthetic write failure'; end if; return new; end $$;
create trigger test_fail_profile before insert on app_users for each row execute function test_fail_profile();
set role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',false);
select test_assert(test_denied($q$select previsio_provision_business('{"name":"Must roll back","city":"London"}')$q$),'profile error propagates');
select test_assert((select count(*)=0 from businesses where owner_user_id=auth.uid()),'failed profile rolls business back');
reset role;
drop trigger test_fail_profile on app_users;
drop function test_fail_profile();
-- Membership cannot be reassigned by calling the owner-onboarding RPC.
insert into app_users(id,business_id,username,role) select '90000000-0000-4000-8000-000000000003',id,'member','staff' from businesses where owner_user_id='90000000-0000-4000-8000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',false);
select test_assert(test_denied($q$select previsio_provision_business('{"name":"Hijack","city":"London"}')$q$),'staff cannot create ownership through onboarding');
reset role;
set role anon;
select test_assert(test_denied($q$select previsio_provision_business('{"name":"Anonymous","city":"London"}')$q$),'anonymous provisioning denied');
reset role;
