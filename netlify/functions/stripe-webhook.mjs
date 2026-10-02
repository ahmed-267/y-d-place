import {
  getStripe,
  createServiceSupabase,
  applySubscriptionToBusiness,
  resolveBusinessIdFromSubscription,
  planFromStripeStatus,
} from './_billing.mjs';
import { json } from './_shared.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return json(503, { error: 'Stripe webhook not configured' });
  }

  const admin = createServiceSupabase();
  if (!admin) return json(503, { error: 'Supabase service role not configured' });

  const signature =
    event.headers['stripe-signature'] || event.headers['Stripe-Signature'] || '';
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return json(400, { error: err instanceof Error ? err.message : 'Invalid signature' });
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const businessId = session.client_reference_id || session.metadata?.business_id;
        if (businessId && session.subscription) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subId);
          await applySubscriptionToBusiness(admin, businessId, subscription);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        const businessId = await resolveBusinessIdFromSubscription(admin, subscription);
        if (businessId) {
          await applySubscriptionToBusiness(admin, businessId, subscription);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          const businessId = await resolveBusinessIdFromSubscription(admin, subscription);
          if (businessId) {
            await applySubscriptionToBusiness(admin, businessId, {
              ...subscription,
              status: subscription.status === 'active' ? 'past_due' : subscription.status,
            });
            await admin
              .from('businesses')
              .update({
                plan: planFromStripeStatus(subscription.status) === 'pro' ? 'past_due' : planFromStripeStatus(subscription.status),
                subscription_status: subscription.status,
              })
              .eq('id', businessId);
          }
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = stripeEvent.data.object;
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          const businessId = await resolveBusinessIdFromSubscription(admin, subscription);
          if (businessId) await applySubscriptionToBusiness(admin, businessId, subscription);
        }
        break;
      }
      default:
        break;
    }
    return json(200, { received: true });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Webhook handler failed' });
  }
};
