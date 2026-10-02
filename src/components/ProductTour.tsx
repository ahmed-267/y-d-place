import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { ArrowRight, X } from 'lucide-react';
import {
  TOUR_START_EVENT,
  markTourDone,
  hasPendingTour,
  clearPendingTour,
} from '../utils/productTour';

type TourStep = {
  tabId: string;
  titleKey: string;
  bodyKey: string;
};

const ALL_STEPS: TourStep[] = [
  { tabId: 'overview', titleKey: 'tourOverviewTitle', bodyKey: 'tourOverviewBody' },
  { tabId: 'cashier', titleKey: 'tourCashierTitle', bodyKey: 'tourCashierBody' },
  { tabId: 'tables', titleKey: 'tourTablesTitle', bodyKey: 'tourTablesBody' },
  { tabId: 'orders', titleKey: 'tourOrdersTitle', bodyKey: 'tourOrdersBody' },
  { tabId: 'sales', titleKey: 'tourSalesTitle', bodyKey: 'tourSalesBody' },
  { tabId: 'stock', titleKey: 'tourStockTitle', bodyKey: 'tourStockBody' },
  { tabId: 'products', titleKey: 'tourProductsTitle', bodyKey: 'tourProductsBody' },
  { tabId: 'customers', titleKey: 'tourCustomersTitle', bodyKey: 'tourCustomersBody' },
  { tabId: 'staff', titleKey: 'tourStaffTitle', bodyKey: 'tourStaffBody' },
  { tabId: 'finance', titleKey: 'tourFinanceTitle', bodyKey: 'tourFinanceBody' },
  { tabId: 'settings', titleKey: 'tourSettingsTitle', bodyKey: 'tourSettingsBody' },
];

type Props = {
  visibleTabIds: string[];
};

export const ProductTour: React.FC<Props> = ({ visibleTabIds }) => {
  const { setActiveTab, t, user, isOnboarding, isBusinessSetupCompleted } = useApp();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const steps = useMemo(
    () => ALL_STEPS.filter(s => visibleTabIds.includes(s.tabId)),
    [visibleTabIds]
  );

  useEffect(() => {
    const onStart = () => {
      clearPendingTour();
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, []);

  // Auto-start only right after registration/setup in this session — not on later logins.
  // Keep the pending flag until open so App remount (onboarding → dashboard) cannot drop it.
  useEffect(() => {
    if (!user || user.role !== 'owner') return;
    if (isOnboarding) return;
    if (!isBusinessSetupCompleted) return;
    if (!hasPendingTour()) return;
    const timer = window.setTimeout(() => {
      if (!hasPendingTour()) return;
      clearPendingTour();
      setIndex(0);
      setOpen(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [user, isOnboarding, isBusinessSetupCompleted]);

  useEffect(() => {
    if (!open || !steps.length) return;
    const step = steps[Math.min(index, steps.length - 1)];
    if (step) setActiveTab(step.tabId);
  }, [open, index, steps, setActiveTab]);

  if (!open || !steps.length) return null;

  const step = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;

  const finish = () => {
    markTourDone();
    setOpen(false);
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    setIndex(i => i + 1);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-8 pointer-events-none">
      <div className="absolute inset-0 bg-bakery-brown/45 backdrop-blur-[2px] pointer-events-auto" onClick={finish} />
      <div
        className="relative pointer-events-auto w-full max-w-md rounded-3xl bg-white border border-bakery-beige shadow-2xl p-5 sm:p-6 space-y-4 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-tour-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-bakery-caramel mb-1">
              {t('productTour')} · {index + 1}/{steps.length}
            </p>
            <h2 id="product-tour-title" className="text-xl font-black font-serif text-bakery-brown">
              {t(step.titleKey)}
            </h2>
          </div>
          <button
            type="button"
            onClick={finish}
            className="p-2 rounded-xl text-bakery-brown/40 hover:text-bakery-brown hover:bg-bakery-beige/60 transition-colors"
            aria-label={t('skipTour')}
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-bakery-brown/70 leading-relaxed">{t(step.bodyKey)}</p>
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={finish}
            className="h-10 px-4 rounded-xl text-xs font-bold text-bakery-brown/50 hover:text-bakery-brown hover:bg-bakery-beige/50 transition-colors"
          >
            {t('skipTour')}
          </button>
          <button
            type="button"
            onClick={next}
            className="btn-primary h-10 px-5 rounded-xl text-sm inline-flex items-center gap-2"
          >
            {isLast ? t('finishTour') : t('nextTourStep')}
            {!isLast && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};
