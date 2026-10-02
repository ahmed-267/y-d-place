-- PreVisio Stripe subscription fields on businesses
alter table if exists public.businesses
  add column if not exists plan text default 'none',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_ends_at timestamptz,
  add column if not exists subscription_status text;

comment on column public.businesses.plan is 'trialing | pro | canceled | past_due | none';
comment on column public.businesses.subscription_status is 'Raw Stripe subscription.status';
