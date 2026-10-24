import React, { useEffect, useState } from 'react';
import { Check, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { useApp } from '../AppContext';
import { hasActiveSubscription, subscriptionLabelKey } from '../utils/subscription';
import { supabase } from './supabaseClient';
import { mapBusinessRow } from '../utils/dbMappers';

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

const PRO_FEATURES = [
  'Till, orders, and kitchen board',
  'Menu, stock, and team scheduling',
  'Finance, expenses, and online pre-orders',
];

export const BillingGate: React.FC = () => {
  const { businessSettings, user, t, logout, addToast, isDemoMode, setBusinessSettings } = useApp();
  const [busy, setBusy] = useState(false);
  const [activating, setActivating] = useState(false);
  const isOwner = user?.role === 'owner';
  const active = hasActiveSubscription(businessSettings);
  if (isDemoMode || active) return null;

  const planKey = subscriptionLabelKey(businessSettings?.plan);
  const neverStarted = !businessSettings?.plan || businessSettings.plan === 'none';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get('billing');
    if (!billing || !businessSettings?.id) return;

    const refreshPlan = async () => {
      const { data } = await supabase.from('businesses').select('*').eq('id', businessSettings.id).maybeSingle();
      if (data) setBusinessSettings(mapBusinessRow(data as Record<string, unknown>));
      return data ? hasActiveSubscription(mapBusinessRow(data as Record<string, unknown>)) : false;
    };

    if (billing === 'cancel') {
      addToast(t('billingCancelToast'), 'info');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    if (billing !== 'success') return;

    setActivating(true);
    let attempts = 0;
    const maxAttempts = 20;
    const tick = async () => {
      attempts += 1;
      const ok = await refreshPlan();
      if (ok) {
        addToast(t('billingSuccessToast'), 'success');
        setActivating(false);
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }
      if (attempts >= maxAttempts) {
        addToast(t('billingActivatingSlow'), 'info');
        setActivating(false);
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }
      window.setTimeout(tick, 1500);
    };
    void tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Stripe return handler
  }, [businessSettings?.id]);

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
      <div className="max-w-lg w-full rounded-[2rem] border border-[#faedcd] bg-white p-8 sm:p-10 shadow-xl space-y-6">
        <div className="text-center space-y-3">
          <img src="/branding/previsio-logo.svg" alt="PreVisio" className="h-8 mx-auto w-auto" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-bakery-brown/45">{t('billingPaymentStep')}</p>
          <h1 className="text-2xl sm:text-3xl font-black font-serif">{t('billingGateTitle')}</h1>
          <p className="text-sm opacity-70 leading-relaxed">{t('billingGateBody')}</p>
        </div>

        <div className="rounded-2xl border border-bakery-beige/80 bg-[#FDF8F0] p-5 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-bakery-brown/45">PreVisio Pro</p>
              <p className="text-3xl font-black font-serif text-bakery-brown">{t('billingProPriceLabel')}</p>
            </div>
            <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
              {t('billingTrialBadge')}
            </p>
          </div>
          <ul className="space-y-2 text-sm text-bakery-brown/75">
            {PRO_FEATURES.map(line => (
              <li key={line} className="flex items-start gap-2">
                <Check size={16} className="text-bakery-caramel shrink-0 mt-0.5" strokeWidth={3} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center text-xs font-bold uppercase tracking-widest text-bakery-brown/40">
          {t(planKey)}
          {businessSettings?.name ? ` · ${businessSettings.name}` : ''}
        </p>

        {activating ? (
          <div className="rounded-2xl border border-bakery-beige bg-bakery-cream/40 px-4 py-5 text-center space-y-2">
            <Loader2 size={22} className="animate-spin mx-auto text-bakery-caramel" />
            <p className="text-sm font-semibold">{t('billingActivating')}</p>
          </div>
        ) : isOwner ? (
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={goCheckout}
              className="w-full rounded-2xl bg-bakery-caramel text-[#2a241f] font-black py-3.5 text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
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
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-bakery-brown/45">
              <ShieldCheck size={14} />
              {t('billingStripeSecure')}
            </p>
          </div>
        ) : (
          <p className="text-sm font-semibold text-bakery-brown/70 text-center">{t('billingAskOwner')}</p>
        )}

        <button type="button" onClick={logout} className="block mx-auto text-xs font-bold uppercase tracking-wider opacity-50 hover:opacity-80">
          {t('logout')}
        </button>
      </div>
    </div>
  );
};

export { startCheckout, openPortal };
