import { BusinessSettings } from '../types';

export type SubscriptionPlan = 'trialing' | 'pro' | 'canceled' | 'past_due' | 'none';

export const normalizePlan = (raw?: string | null): SubscriptionPlan => {
  if (raw === 'trialing' || raw === 'pro' || raw === 'canceled' || raw === 'past_due') return raw;
  return 'none';
};

/** Map Stripe subscription.status → our plan mirror. */
export const planFromStripeStatus = (status?: string | null): SubscriptionPlan => {
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
    case 'incomplete':
    case 'paused':
      return 'none';
    default:
      return 'none';
  }
};

/**
 * Active access: trialing or pro.
 * Demo businesses (ydplace) always pass.
 */
export const hasActiveSubscription = (
  business: Pick<BusinessSettings, 'id' | 'plan' | 'trialEndsAt'> | null | undefined
): boolean => {
  if (!business) return false;
  if (business.id === 'ydplace') return true;
  const plan = normalizePlan(business.plan);
  if (plan === 'pro') return true;
  if (plan === 'trialing') {
    if (!business.trialEndsAt) return true;
    return business.trialEndsAt > Date.now();
  }
  return false;
};

export const subscriptionLabelKey = (plan?: string | null): string => {
  const p = normalizePlan(plan);
  if (p === 'trialing') return 'billingPlanTrialing';
  if (p === 'pro') return 'billingPlanPro';
  if (p === 'past_due') return 'billingPlanPastDue';
  if (p === 'canceled') return 'billingPlanCanceled';
  return 'billingPlanNone';
};
