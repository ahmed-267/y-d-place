-- Recovery snapshots, not authoritative operational records. No dependency on numeric IDs.
create table public.browser_backups (
 id uuid primary key default gen_random_uuid(),
 business_id text not null,
 user_id uuid not null,
 device_id uuid not null,
 payload jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 constraint backup_size check (octet_length(payload::text) <= 1048576)
);
create index browser_backups_lookup on public.browser_backups(business_id,user_id,device_id,created_at desc);
alter table public.browser_backups enable row level security;
revoke all on public.browser_backups from public,anon,authenticated;
grant select on public.browser_backups to authenticated;
create policy backup_read on public.browser_backups for select to authenticated using (
 exists(select 1 from public.app_users u where u.id::text=auth.uid()::text
 and u.business_id::text=browser_backups.business_id
 and (u.id::text=browser_backups.user_id::text or u.role::text='owner'))
);
create function public.previsio_backup_browser(biz text, device uuid, snapshot jsonb)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare saved timestamptz; latest jsonb;
begin
 if auth.uid() is null or not exists(select 1 from app_users where id::text=auth.uid()::text and business_id::text=biz) then
  raise exception 'Business membership required';
 end if;
 if device is null or snapshot is null or jsonb_typeof(snapshot)<>'object' or octet_length(snapshot::text)>1048576
 or snapshot-'version'-'categories'-'staffAvailability'-'taxSettings'-'cashSessions'-'floorPlan'-'wasteLogs'-'customers'-'shiftLogs' <> '{}'::jsonb
 or snapshot->>'version' is distinct from '1' then raise exception 'Invalid recovery snapshot (maximum 1 MiB)'; end if;
 perform pg_advisory_xact_lock(hashtextextended('browser-backup:'||biz,0));
 select payload,created_at into latest,saved from browser_backups where business_id=biz and user_id=auth.uid() and device_id=device order by created_at desc limit 1;
 if latest=snapshot then return saved; end if;
 if saved > clock_timestamp()-interval '30 seconds' then raise exception 'Please retry backup after 30 seconds'; end if;
 if saved is null and (select count(*) from (select distinct user_id,device_id from browser_backups where business_id=biz) d)>=20 then
  raise exception 'Recovery device limit reached; contact the business owner';
 end if;
 insert into browser_backups(business_id,user_id,device_id,payload) values(biz,auth.uid(),device,snapshot) returning created_at into saved;
 delete from browser_backups where id in (select id from browser_backups where business_id=biz and user_id=auth.uid() and device_id=device order by created_at desc offset 3);
 return saved;
end $$;
revoke all on function public.previsio_backup_browser(text,uuid,jsonb) from public,anon;
grant execute on function public.previsio_backup_browser(text,uuid,jsonb) to authenticated;
