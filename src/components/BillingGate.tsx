import React, { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { useApp } from '../AppContext';
import { hasActiveSubscription, subscriptionLabelKey } from '../utils/subscription';
import { supabase } from './supabaseClient';

const startCheckout = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) throw new Error(body.error || 'Checkout failed');
  return body.url || null;
};

const openPortal = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  const res = await fetch('/api/billing/portal', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) throw new Error(body.error || 'Portal failed');
  return body.url || null;
};

export const BillingGate: React.FC = () => {
  const { businessSettings, user, t, logout, addToast, isDemoMode } = useApp();
  const [busy, setBusy] = useState(false);
  const isOwner = user?.role === 'owner';
  const active = hasActiveSubscription(businessSettings);
  if (isDemoMode || active) return null;

  const planKey = subscriptionLabelKey(businessSettings?.plan);
  const neverStarted = !businessSettings?.plan || businessSettings.plan === 'none';

  const goCheckout = async () => {
    setBusy(true);
    try {
      const url = await startCheckout();
      if (url) window.location.href = url;
      else addToast(t('billingCheckoutMissing'), 'error');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('billingCheckoutFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const goPortal = async () => {
    setBusy(true);
    try {
      const url = await openPortal();
      if (url) window.location.href = url;
      else addToast(t('billingPortalMissing'), 'error');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('billingPortalFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F3ED] text-[#5d4037]">
      <div className="max-w-md w-full rounded-[2rem] border border-[#faedcd] bg-white p-8 sm:p-10 shadow-xl space-y-5 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-bakery-caramel/20 text-bakery-caramel flex items-center justify-center">
          <CreditCard size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black font-serif">{t('billingGateTitle')}</h1>
          <p className="mt-2 text-sm opacity-70">{t('billingGateBody')}</p>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-bakery-brown/40">
          {t(planKey)}
          {businessSettings?.name ? ` · ${businessSettings.name}` : ''}
        </p>

        {isOwner ? (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={goCheckout}
              className="w-full rounded-2xl bg-bakery-caramel text-[#2a241f] font-black py-3.5 text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {neverStarted ? t('billingStartTrial') : t('billingResume')}
            </button>
            {!neverStarted && (
              <button
                type="button"
                disabled={busy}
                onClick={goPortal}
                className="w-full rounded-2xl border border-bakery-beige font-bold py-3 text-sm disabled:opacity-50"
              >
                {t('billingManage')}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm font-semibold text-bakery-brown/70">{t('billingAskOwner')}</p>
        )}

        <button type="button" onClick={logout} className="text-xs font-bold uppercase tracking-wider opacity-50 hover:opacity-80">
          {t('logout')}
        </button>
      </div>
    </div>
  );
};

export { startCheckout, openPortal };
