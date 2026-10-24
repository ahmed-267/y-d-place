begin;
create table public.leave_requests (
 id uuid primary key default gen_random_uuid(), business_id text not null references public.businesses(id),
 user_id uuid not null references public.app_users(id), from_date date not null, to_date date not null,
 reason text not null check(reason in ('holiday','sick','personal','other')), notes text not null default '',
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references public.app_users(id), reviewed_at timestamptz, created_at timestamptz not null default now(),
 check(to_date>=from_date and to_date-from_date<=89), check(length(notes)<=2000)
);
create index leave_requests_business_status on public.leave_requests(business_id,status,created_at);
alter table public.leave_requests enable row level security;
revoke all on public.leave_requests from public,anon,authenticated;
grant select on public.leave_requests to authenticated;
grant all on public.leave_requests to service_role;
create policy leave_request_read on public.leave_requests for select to authenticated
 using(previsio_role(business_id) is not null and (user_id=auth.uid() or previsio_role(business_id) in ('owner','manager')));
create function public.previsio_request_leave(biz text, request_id uuid, first_day date, last_day date, reason_input text, notes_input text default '') returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.leave_requests;
begin
 if auth.uid() is null or previsio_role(biz) is null or not previsio_active(biz) then raise exception 'Active business membership required'; end if;
 if first_day is null or last_day is null or first_day<current_date or last_day<first_day or last_day-first_day>89 then raise exception 'Choose a date range of 1 to 90 days, starting today or later'; end if;
 perform pg_advisory_xact_lock(hashtextextended('leave:'||biz,0));
 select * into existing from leave_requests where id=request_id;
 if found then
  if existing.business_id=biz and existing.user_id=auth.uid() and existing.from_date=first_day and existing.to_date=last_day and existing.reason=reason_input and existing.notes=coalesce(notes_input,'') then return existing.id; end if;
  raise exception 'Request identifier already used';
 end if;
 if exists(select 1 from leave_requests where business_id=biz and user_id=auth.uid() and status in ('pending','approved') and from_date<=last_day and to_date>=first_day) then raise exception 'These dates overlap an existing request'; end if;
 insert into leave_requests(id,business_id,user_id,from_date,to_date,reason,notes)
 values(request_id,biz,auth.uid(),first_day,last_day,reason_input,coalesce(notes_input,''));
 return request_id;
end $$;
create function public.previsio_review_leave(request_id uuid, decision text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare req public.leave_requests; person public.app_users; day date;
begin
 select * into req from leave_requests where id=request_id;
 if not found or coalesce(previsio_role(req.business_id),'') not in ('owner','manager') or not previsio_active(req.business_id) then raise exception 'Manager or owner required'; end if;
 if req.user_id=auth.uid() then raise exception 'You cannot approve or reject your own request'; end if;
 if decision is null or decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 perform pg_advisory_xact_lock(hashtextextended('leave:'||req.business_id,0));
 select * into req from leave_requests where id=request_id for update;
 if req.status=decision then return; end if;
 if req.status<>'pending' then raise exception 'Request already reviewed'; end if;
 select * into person from app_users where id=req.user_id and business_id=req.business_id;
 if not found then raise exception 'Staff member no longer belongs to this business'; end if;
 if decision='approved' then
  if exists(select 1 from work_shifts where business_id=req.business_id and user_id=person.numeric_id and date between req.from_date and req.to_date) then raise exception 'Existing shift or leave overlaps. Review the staff schedule first'; end if;
  if exists(select 1 from rota_shifts where business_id=req.business_id and "userId"=person.numeric_id and date between req.from_date and req.to_date) then raise exception 'Scheduled rota overlaps. Reschedule it before approval'; end if;
  for day in select generate_series(req.from_date::timestamp,req.to_date::timestamp,interval '1 day')::date loop
   insert into work_shifts(id,business_id,user_id,username,full_name,date,start_time,end_time,break_minutes,total_hours,pay_amount,kind,leave_reason,notes)
   values('LEAVE-'||req.id||'-'||day,req.business_id,person.numeric_id,person.username,person.full_name,day,'','',0,0,0,'leave',req.reason,req.notes);
  end loop;
 end if;
 update leave_requests set status=decision,reviewed_by=auth.uid(),reviewed_at=now() where id=req.id;
end $$;
-- Enforce the approval requirement even through direct table calls or the generic mutation RPC.
create function public.previsio_guard_leave() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('leave:'||coalesce(new.business_id,old.business_id),0));
 if tg_op<>'DELETE' and coalesce(new.kind,'worked')<>'leave' and exists(
  select 1 from work_shifts s where s.business_id=new.business_id and s.user_id=new.user_id and s.date=new.date and s.kind='leave' and s.id<>new.id
 ) then raise exception 'Approved leave exists on this date'; end if;
 if auth.uid() is not null and auth.role()<>'service_role' and coalesce(previsio_role(coalesce(new.business_id,old.business_id)),'') not in ('owner','manager') then
  if (tg_op<>'DELETE' and new.kind='leave') or (tg_op<>'INSERT' and old.kind='leave') then raise exception 'Time off requires a manager-approved request'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger previsio_leave_guard before insert or update or delete on public.work_shifts for each row execute function public.previsio_guard_leave();
revoke all on function public.previsio_request_leave(text,uuid,date,date,text,text),public.previsio_review_leave(uuid,text) from public,anon;
grant execute on function public.previsio_request_leave(text,uuid,date,date,text,text),public.previsio_review_leave(uuid,text) to authenticated;
commit;
