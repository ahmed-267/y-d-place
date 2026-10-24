-- OPTIONAL: project-admin-only, time-limited pilot for your own café customer.
-- Run AFTER the owner registers and creates the business in the NEW project.
-- Replace the email below. No Stripe subscription is created or charged.
-- Client roles cannot change these billing fields themselves.
begin;
do $$
declare owner_email_input text := 'REPLACE_WITH_CAFE_OWNER_EMAIL'; target text;
begin
 if owner_email_input='REPLACE_WITH_CAFE_OWNER_EMAIL' then raise exception 'Set the cafe owner email first'; end if;
 if (select count(*) from public.businesses where lower(owner_email)=lower(owner_email_input))<>1 then raise exception 'Expected exactly one business for this owner email'; end if;
 select id into target from public.businesses where lower(owner_email)=lower(owner_email_input);
 if exists(select 1 from public.businesses where id=target and (stripe_subscription_id is not null or plan='pro')) then raise exception 'Existing subscription must be managed through billing'; end if;
 update public.businesses set plan='trialing',subscription_status='trialing',trial_ends_at=now()+interval '14 days' where id=target;
end $$;
commit;
