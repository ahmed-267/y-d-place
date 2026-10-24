-- Run after database.sql against synthetic fixtures only.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select previsio_backup_browser('A','11111111-1111-1111-1111-111111111111','{"version":1,"customers":[{"name":"Synthetic"}]}');
select previsio_backup_browser('A','11111111-1111-1111-1111-111111111111','{"version":1,"customers":[{"name":"Synthetic"}]}');
select test_assert((select count(*)=1 from browser_backups),'unchanged backup deduplicates');
select test_assert(test_denied($q$select previsio_backup_browser('B','11111111-1111-1111-1111-111111111111','{"version":1}')$q$),'cross business backup denied');
select test_assert(test_denied($q$select previsio_backup_browser('A','11111111-1111-1111-1111-111111111111','{"version":1,"users":[]}')$q$),'unexpected fields denied');
select test_assert(test_denied($q$select previsio_backup_browser('A','11111111-1111-1111-1111-111111111111',jsonb_build_object('version',1,'customers',repeat('x',1048577)))$q$),'oversized snapshots denied');
select test_assert(test_denied($q$insert into browser_backups(business_id,user_id,device_id,payload) values('B',auth.uid(),gen_random_uuid(),'{}')$q$),'direct inserts denied');
select test_assert(test_denied('delete from browser_backups'),'direct deletes denied');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select test_assert((select count(*)=0 from browser_backups),'other member cannot read staff backup');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select test_assert((select count(*)=0 from browser_backups),'other owner cannot read foreign backup');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select test_assert((select count(*)=1 from browser_backups),'owner can recover business backups');
reset role;
-- Simulate elapsed time without sleeping.
do $$ begin
 for i in 1..4 loop
  update browser_backups set created_at=created_at-interval '1 minute';
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  perform previsio_backup_browser('A','11111111-1111-1111-1111-111111111111',jsonb_build_object('version',1,'customers',jsonb_build_array(i)));
 end loop;
end $$;
select test_assert((select count(*)=3 from browser_backups),'retention keeps only three versions');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select test_assert(test_denied($q$select previsio_backup_browser('A','11111111-1111-1111-1111-111111111111','{"version":1}')$q$),'rate limit rejects immediate changed snapshot');
set role anon;
select test_assert(test_denied('select * from browser_backups'),'anonymous backups denied');
select test_assert(test_denied($q$select previsio_backup_browser('A',gen_random_uuid(),'{"version":1}')$q$),'anonymous RPC denied');
reset role;
