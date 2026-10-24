begin;
-- Serialize subscription reconciliation across function instances, including replayed/out-of-order webhooks.
create table public.previsio_billing_locks(business_id text primary key, token uuid not null, expires_at timestamptz not null);
alter table public.previsio_billing_locks enable row level security;
create function public.previsio_claim_billing_lock(biz text, lock_token uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare claimed uuid; begin
 insert into previsio_billing_locks as l values(biz,lock_token,now()+interval '2 minutes')
 on conflict(business_id) do update set token=excluded.token,expires_at=excluded.expires_at
 where l.expires_at<now() returning token into claimed;
 return claimed is not null;
end $$;
create function public.previsio_release_billing_lock(biz text, lock_token uuid) returns void
language sql security definer set search_path=public as $$
 delete from previsio_billing_locks where business_id=biz and token=lock_token
$$;
revoke all on function public.previsio_claim_billing_lock(text,uuid), public.previsio_release_billing_lock(text,uuid) from public;
grant execute on function public.previsio_claim_billing_lock(text,uuid), public.previsio_release_billing_lock(text,uuid) to service_role;
commit;
