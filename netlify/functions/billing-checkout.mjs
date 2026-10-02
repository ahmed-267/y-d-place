import {
  getStripe,
  getAppUrl,
  TRIAL_DAYS,
  requireOwner,
  ensureStripeCustomer,
  createServiceSupabase,
  applySubscriptionToBusiness,
  resolveBusinessIdFromSubscription,
  planFromStripeStatus,
} from './_billing.mjs';
import { json, parseBody } from './_shared.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_PRO;
  if (!stripe || !priceId) {
    return json(503, { error: 'Stripe is not configured (STRIPE_SECRET_KEY / STRIPE_PRICE_PRO)' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const auth = await requireOwner(jwt);
  if (auth.error) return json(auth.status || 401, { error: auth.error });

  try {
    const customerId = await ensureStripeCustomer(
      stripe,
      auth.business,
      auth.user.email || auth.business.owner_email
    );

    const appUrl = getAppUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: auth.business.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          business_id: auth.business.id,
          owner_user_id: auth.user.id,
        },
      },
      metadata: {
        business_id: auth.business.id,
        owner_user_id: auth.user.id,
      },
      success_url: `${appUrl}/?billing=success`,
      cancel_url: `${appUrl}/?billing=cancel`,
      allow_promotion_codes: true,
    });

    return json(200, { url: session.url });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Checkout failed' });
  }
};
