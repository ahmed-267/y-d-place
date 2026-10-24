import { getStripe, getAppUrl, requireOwner, ensureStripeCustomer } from './_billing.mjs';
import { json } from './_shared.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const stripe = getStripe();
  if (!stripe) return json(503, { error: 'Stripe is not configured' });

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const auth = await requireOwner(jwt);
  if (auth.error) return json(auth.status || 401, { error: auth.error });

  if (!auth.business.stripe_customer_id && !auth.business.stripe_subscription_id) {
    return json(400, { error: 'No billing customer yet. Start a trial first.' });
  }

  try {
    const customerId = await ensureStripeCustomer(
      stripe,
      auth.business,
      auth.user.email || auth.business.owner_email
    );
    const appUrl = getAppUrl(event);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/?billing=portal`,
    });
    return json(200, { url: session.url });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Portal failed' });
  }
};
