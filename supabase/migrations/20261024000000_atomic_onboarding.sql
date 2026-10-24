begin;
create or replace function public.previsio_guard_fields() returns trigger
language plpgsql set search_path=public as $$
begin
 if auth.role()='service_role' or auth.uid() is null then return new; end if;
 if tg_table_name='businesses' then
  if tg_op='INSERT' then
   new.plan := 'none'; new.subscription_status := null; new.trial_ends_at := null;
   new.stripe_customer_id := null; new.stripe_subscription_id := null; new.current_period_ends_at := null;
  elsif (to_jsonb(new)-array['name','owner_name','owner_email','owner_phone','venue_type','country','city','address','opening_hours','currency_code','currency_symbol','language','enabled_modules','discount_policy','brand_theme','categories','setup_completed'])
   is distinct from (to_jsonb(old)-array['name','owner_name','owner_email','owner_phone','venue_type','country','city','address','opening_hours','currency_code','currency_symbol','language','enabled_modules','discount_policy','brand_theme','categories','setup_completed']) then
    raise exception 'Protected business fields cannot be changed';
  end if;
 elsif tg_table_name='app_users' then
  -- Recover an unfinished self-profile only into a business actually owned by
  -- this Auth user. Existing memberships and numeric identity remain immutable.
  if old.business_id is null and new.business_id is not null
   and new.id=auth.uid() and old.id=new.id and new.role='owner'
   and new.numeric_id is not distinct from old.numeric_id
   and exists(select 1 from businesses b where b.id::text=new.business_id::text and b.owner_user_id=auth.uid())
   and (to_jsonb(new)-array['business_id','role','full_name','username','revision'])
       is not distinct from (to_jsonb(old)-array['business_id','role','full_name','username','revision']) then
   return new;
  end if;
  if new.role not in ('owner','manager','staff') then raise exception 'Invalid role'; end if;
  if new.id is distinct from old.id or new.business_id is distinct from old.business_id then raise exception 'Identity and membership are immutable'; end if;
  if previsio_role(old.business_id::text)<>'owner' or old.id::text=auth.uid()::text then
   if (to_jsonb(new)-array['full_name','username','revision']) is distinct from (to_jsonb(old)-array['full_name','username','revision']) then raise exception 'Only personal profile fields may be changed'; end if;
  elsif new.role='owner' or old.role='owner' then raise exception 'Ownership cannot be changed here';
  end if;
 elsif tg_table_name='products' and previsio_role(old.business_id::text)='staff' then
  if (to_jsonb(new)-array['active','revision']) is distinct from (to_jsonb(old)-array['active','revision']) then raise exception 'Staff can only toggle menu availability'; end if;
 end if;
 return new;
end $$;

-- One transaction for business + owner profile. Safe to retry after a lost response.
create or replace function public.previsio_provision_business(settings jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare caller uuid:=auth.uid(); b public.businesses; p public.app_users; account jsonb;
begin
 if caller is null then raise exception 'Sign in before setting up a business'; end if;
 if jsonb_typeof(settings) is distinct from 'object' or length(trim(coalesce(settings->>'name','')))=0 or length(trim(coalesce(settings->>'city','')))=0 then
  raise exception 'Business name and city are required';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('onboarding:'||caller::text,0));
 select to_jsonb(u) into account from auth.users u where u.id=caller;
 if account is null then raise exception 'Authenticated account not found'; end if;
 select * into p from public.app_users where id=caller for update;
 select * into b from public.businesses where owner_user_id=caller for update;
 if p.business_id is not null and (b.id is null or p.business_id<>b.id or p.role<>'owner') then
  raise exception 'Your account already belongs to a business. Ask its owner to manage your membership.';
 end if;
 if b.id is null then
  insert into public.businesses(owner_user_id,name) values(caller,trim(settings->>'name')) returning * into b;
 end if;
 update public.businesses set
  name=trim(settings->>'name'),owner_name=settings->>'owner_name',owner_email=account->>'email',
  owner_phone=coalesce(settings->>'owner_phone',''),venue_type=settings->>'venue_type',
  country=settings->>'country',city=trim(settings->>'city'),address=coalesce(settings->>'address',''),
  opening_hours=coalesce(settings->>'opening_hours',''),currency_code=coalesce(settings->>'currency_code','EUR'),
  currency_symbol=coalesce(settings->>'currency_symbol','€'),language=coalesce(settings->>'language','en'),
  enabled_modules=coalesce(settings->'enabled_modules',enabled_modules),
  discount_policy=coalesce(settings->'discount_policy',discount_policy),brand_theme=coalesce(settings->'brand_theme',brand_theme)
 where id=b.id returning * into b;
 if p.id is null then
  insert into public.app_users(id,business_id,username,full_name,role,email)
  values(caller,b.id,coalesce(nullif(account->'raw_user_meta_data'->>'username',''),account->>'email',caller::text),
   coalesce(nullif(account->'raw_user_meta_data'->>'full_name',''),settings->>'owner_name','Owner'),'owner',account->>'email') returning * into p;
 elsif p.business_id is null then
  update public.app_users set business_id=b.id,role='owner' where id=caller returning * into p;
 end if;
 return jsonb_build_object('business',to_jsonb(b),'numeric_id',p.numeric_id,'username',p.username,'full_name',p.full_name);
end $$;
revoke all on function public.previsio_provision_business(jsonb) from public,anon;
grant execute on function public.previsio_provision_business(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
