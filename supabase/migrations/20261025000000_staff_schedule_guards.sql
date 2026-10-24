-- Staff can read their shifts and request leave; managers maintain shift records.
drop policy if exists shift_self_write on public.work_shifts;

-- Serialize scheduling with leave requests/reviews and reject inclusive date overlaps.
create or replace function public.previsio_guard_rota_leave() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('leave:'||new.business_id,0));
 if exists(select 1 from public.work_shifts s where s.business_id=new.business_id
   and s.user_id=new."userId" and s.date=new.date and s.kind='leave')
 or exists(select 1 from public.leave_requests r join public.app_users u on u.id=r.user_id
   where r.business_id=new.business_id and u.business_id=new.business_id and u.numeric_id=new."userId"
   and r.status in ('pending','approved') and new.date between r.from_date and r.to_date) then
  raise exception 'Cannot schedule a shift during pending or approved time off';
 end if;
 return new;
end $$;
drop trigger if exists previsio_rota_leave_guard on public.rota_shifts;
create trigger previsio_rota_leave_guard before insert or update on public.rota_shifts
 for each row execute function public.previsio_guard_rota_leave();
revoke all on function public.previsio_guard_rota_leave() from public,anon,authenticated;
notify pgrst,'reload schema';
