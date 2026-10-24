import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const TRIAL_DAYS = 14;

export const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { timeout: 20000, maxNetworkRetries: 1 });
};

export const getAppUrl = () =>
  (process.env.APP_URL || process.env.URL || process.env.VITE_OPENROUTER_SITE_URL || 'http://localhost:3000').replace(
    /\/$/,
    ''
  );

export const planFromStripeStatus = (status) => {
  switch (status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'pro';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'none';
  }
};

export const createServiceSupabase = () => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service);
};

export const requireOwner = async (jwt) => {
  if (!jwt) return { error: 'Sign in required', status: 401 };
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service || !jwt) return { error: 'Misconfigured auth', status: 503 };

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser(jwt);
  if (authErr || !authData.user) return { error: 'Invalid session', status: 401 };

  const admin = createClient(url, service);
  const { data: caller } = await admin
    .from('app_users')
    .select('business_id, role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (!caller || caller.role !== 'owner' || !caller.business_id) {
    return { error: 'Only the business owner can manage billing', status: 403 };
  }

  const { data: business } = await admin
    .from('businesses')
    .select('id, name, owner_email, stripe_customer_id, stripe_subscription_id, plan')
    .eq('id', caller.business_id)
    .maybeSingle();

  if (!business) return { error: 'Business not found', status: 404 };

  return { user: authData.user, business, admin };
};

export const ensureStripeCustomer = async (stripe, business, ownerEmail) => {
  if (business.stripe_customer_id) {
    return business.stripe_customer_id;
  }
  const customer = await stripe.customers.create({
    email: ownerEmail || business.owner_email || undefined,
    name: business.name || undefined,
    metadata: { business_id: business.id },
  }, { idempotencyKey: `previsio-customer-${business.id}` });
  const admin = createServiceSupabase();
  if (admin) {
    const { error } = await admin.from('businesses').update({ stripe_customer_id: customer.id }).eq('id', business.id);
    if (error) throw new Error('Could not save billing customer');
  }
  return customer.id;
};

export const applySubscriptionToBusiness = async (admin, businessId, subscription) => {
  const status = subscription.status;
  const plan = planFromStripeStatus(status);
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;
  const period = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
  const periodEnd = period
    ? new Date(period * 1000).toISOString()
    : null;

  const { error } = await admin
    .from('businesses')
    .update({
      plan,
      subscription_status: status,
      stripe_subscription_id: subscription.id,
      stripe_customer_id:
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
      trial_ends_at: trialEnd,
      current_period_ends_at: periodEnd,
    })
    .eq('id', businessId);
  if (error) throw new Error('Subscription update failed; retry required');
};

export const resolveBusinessIdFromSubscription = async (admin, subscription) => {
  const metaBiz = subscription.metadata?.business_id;
  if (metaBiz) return metaBiz;
  if (subscription.customer) {
    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const { data, error } = await admin
      .from('businesses')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (error) throw new Error('Business lookup failed; retry required');
    return data?.id || null;
  }
  return null;
};

export const withBillingLock = async (admin, businessId, action) => {
  const lockToken = randomUUID();
  const { data: acquired, error } = await admin.rpc('previsio_claim_billing_lock', { biz: businessId, lock_token: lockToken });
  if (error || !acquired) throw new Error('Billing reconciliation busy; retry required');
  try {
    return await action();
  } finally {
    await admin.rpc('previsio_release_billing_lock', { biz: businessId, lock_token: lockToken });
  }
};

export const reconcileSubscription = async (admin, stripe, businessId, subscriptionId) =>
  withBillingLock(admin, businessId, async () => {
    // Fetch AFTER acquiring the shared lease, so old webhook payloads cannot overwrite newer status.
    const current = await stripe.subscriptions.retrieve(subscriptionId);
    await applySubscriptionToBusiness(admin, businessId, current);
  });
