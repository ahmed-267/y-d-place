import {
  getStripe,
  createServiceSupabase,
  reconcileSubscription,
  resolveBusinessIdFromSubscription,
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
          await reconcileSubscription(admin, stripe, businessId, subscription.id);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const eventSubscription = stripeEvent.data.object;
        const subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
        const businessId = await resolveBusinessIdFromSubscription(admin, subscription);
        if (businessId) {
          await reconcileSubscription(admin, stripe, businessId, subscription.id);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        const subscriptionRef = invoice.parent?.subscription_details?.subscription || invoice.subscription;
        const subId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          const businessId = await resolveBusinessIdFromSubscription(admin, subscription);
          if (businessId) {
            await reconcileSubscription(admin, stripe, businessId, subscription.id);
          }
        }
        break;
      }
      case 'invoice.paid': {
        const invoice = stripeEvent.data.object;
        const subscriptionRef = invoice.parent?.subscription_details?.subscription || invoice.subscription;
        const subId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id;
        if (subId) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          const businessId = await resolveBusinessIdFromSubscription(admin, subscription);
          if (businessId) await reconcileSubscription(admin, stripe, businessId, subscription.id);
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
