import { AppearanceToggle } from './AppearanceToggle';
import { usePendingLeaveCount } from '../hooks/usePendingLeaveCount';
import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useApp } from '../AppContext';
import { LogOut, Menu, X, Layout, Lock, LayoutDashboard, ShoppingCart, ClipboardList, BarChart3, Package, UtensilsCrossed, Users, Wallet, Settings, CalendarDays, Tag, Grid3X3, Contact } from 'lucide-react';
const OverviewTab = lazy(() => import('./OverviewTab').then(m => ({ default: m.OverviewTab })));
const CashierTab = lazy(() => import('./CashierTab').then(m => ({ default: m.CashierTab })));
const TablesTab = lazy(() => import('./TablesTab').then(m => ({ default: m.TablesTab })));
const OrdersTab = lazy(() => import('./OrdersTab').then(m => ({ default: m.OrdersTab })));
const SalesTab = lazy(() => import('./SalesTab').then(m => ({ default: m.SalesTab })));
const StockTab = lazy(() => import('./StockTab').then(m => ({ default: m.StockTab })));
const ProductsTab = lazy(() => import('./ProductsTab').then(m => ({ default: m.ProductsTab })));
const StaffTab = lazy(() => import('./StaffTab').then(m => ({ default: m.StaffTab })));
const MyShiftsTab = lazy(() => import('./MyShiftsTab').then(m => ({ default: m.MyShiftsTab })));
const FinanceTab = lazy(() => import('./FinanceTab').then(m => ({ default: m.FinanceTab })));
const SettingsTab = lazy(() => import('./SettingsTab').then(m => ({ default: m.SettingsTab })));
const CustomersTab = lazy(() => import('./CustomersTab').then(m => ({ default: m.CustomersTab })));
import { OnboardingWizard } from './OnboardingWizard';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ProductTour } from './ProductTour';
import { Role, normalizeEnabledModules } from '../types';
import { hasOwnerAccess } from '../utils/roles';
import { hasActiveSubscription } from '../utils/subscription';
import { BillingGate } from './BillingGate';
import { supabase } from './supabaseClient';
import { mapBusinessRow } from '../utils/dbMappers';

const TAB_ICONS: Record<string, React.ReactNode> = {
  overview: <LayoutDashboard size={18} />,
  cashier: <ShoppingCart size={18} />,
  tables: <Grid3X3 size={18} />,
  orders: <ClipboardList size={18} />,
  sales: <BarChart3 size={18} />,
  stock: <Package size={18} />,
  products: <UtensilsCrossed size={18} />,
  customers: <Contact size={18} />,
  staff: <Users size={18} />,
  myshifts: <CalendarDays size={18} />,
  finance: <Wallet size={18} />,
  settings: <Settings size={18} />,
};

const NAV_GROUPS: { id: string; labelKey: string; tabIds: string[] }[] = [
  { id: 'ops', labelKey: 'navOperations', tabIds: ['overview', 'cashier', 'tables', 'orders', 'sales', 'stock'] },
  { id: 'manage', labelKey: 'navManage', tabIds: ['products', 'customers', 'staff', 'myshifts', 'finance'] },
  { id: 'account', labelKey: 'navAccount', tabIds: ['settings'] },
];

const MODULE_TAB_MAP: Record<string, keyof ReturnType<typeof normalizeEnabledModules> | 'always'> = {
  overview: 'always',
  cashier: 'always',
  products: 'always',
  customers: 'customers',
  settings: 'always',
  tables: 'tables',
  orders: 'orders',
  sales: 'sales',
  stock: 'stock',
  staff: 'staff',
  myshifts: 'staff',
  finance: 'finance',
};

export const Dashboard = () => {
  const pendingLeaveCount = usePendingLeaveCount();
  const {
    user,
    t,
    logout,
    businessSettings,
    orders,
    products,
    isOnboarding,
    isBusinessSetupCompleted,
    activeTab,
    setActiveTab,
    startOnboarding,
    completeOnboarding,
    rota,
    isDemoMode,
    cloudLoadError,
    switchDemoRole,
    setBusinessSettings,
    addToast,
  } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [navTrail, setNavTrail] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get('billing');
    if (!billing || !businessSettings?.id || businessSettings.id === 'ydplace') return;

    const refresh = async () => {
      const { data } = await supabase.from('businesses').select('*').eq('id', businessSettings.id).maybeSingle();
      if (data) setBusinessSettings(mapBusinessRow(data as Record<string, unknown>));
      if (billing === 'success') addToast(t('billingSuccessToast'), 'success');
      if (billing === 'cancel') addToast(t('billingCancelToast'), 'info');
      window.history.replaceState(null, '', window.location.pathname);
    };
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on return from Stripe
  }, []);

  useEffect(() => {
    if (!activeTab) return;
    setNavTrail(prev => {
      const existing = prev.indexOf(activeTab);
      if (existing >= 0) return prev.slice(0, existing + 1);
      const next = [...prev, activeTab];
      return next.length > 8 ? next.slice(-8) : next;
    });
  }, [activeTab]);

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const scheduledToday = useMemo(
    () => (user ? rota.filter(r => r.username === user.username && r.date === todayKey) : []),
    [rota, user, todayKey]
  );

  const goToTrailItem = (tabId: string) => {
    setActiveTab(tabId);
    setNavTrail(prev => {
      const idx = prev.indexOf(tabId);
      return idx >= 0 ? prev.slice(0, idx + 1) : [...prev, tabId];
    });
    setIsSidebarOpen(false);
  };

  const activeOrderCount = useMemo(() => {
    return orders.filter(o => o.status === 'Preparing' || o.status === 'Ready').length;
  }, [orders]);

  type TabItem = {
    id: string;
    label: string;
    roles: Role[];
    badge?: number;
    locked?: boolean;
  };

  const roleTabs = useMemo(() => {
    if (!user) return [];
    const modules = normalizeEnabledModules(businessSettings?.enabledModules);
    return [
      { id: 'overview', label: t('overview'), roles: ['owner', 'manager'] },
      { id: 'cashier', label: t('cashier'), roles: ['owner', 'manager', 'staff'] },
      { id: 'tables', label: t('tablesTab'), roles: ['owner', 'manager', 'staff'] },
      {
        id: 'orders',
        label: t('orders'),
        roles: ['owner', 'manager', 'staff'],
        badge: activeOrderCount > 0 ? activeOrderCount : undefined,
      },
      { id: 'sales', label: t('sales'), roles: ['owner', 'manager'] },
      { id: 'stock', label: t('stock'), roles: ['owner', 'manager', 'staff'] },
      { id: 'products', label: t('products'), roles: ['owner', 'manager', 'staff'] },
      { id: 'customers', label: t('customersTab'), roles: ['owner', 'manager'] },
      { id: 'staff', label: t('staff'), roles: ['owner', 'manager'], badge: pendingLeaveCount || undefined },
      { id: 'myshifts', label: t('myShifts'), roles: ['staff'] },
      { id: 'finance', label: t('finance'), roles: ['owner', 'manager'] },
      { id: 'settings', label: t('settings'), roles: ['owner', 'manager'] },
    ]
      .filter(tab => tab.roles.includes(user.role))
      .filter(tab => {
        const flag = MODULE_TAB_MAP[tab.id];
        if (!flag || flag === 'always') return true;
        return modules[flag];
      }) as TabItem[];
  }, [user, t, activeOrderCount, pendingLeaveCount, businessSettings?.enabledModules]);

  const gateEligible = hasOwnerAccess(user?.role) && businessSettings?.id !== 'ydplace';
  const setupCompleted = isBusinessSetupCompleted;
  const sellReady = setupCompleted || products.length >= 1;
  const setupGateActive = !!gateEligible && !sellReady;
  const financeLocked = !!gateEligible && !setupCompleted;
  const allowedTabIds = useMemo(() => {
    if (setupGateActive) return new Set(['overview', 'settings', 'products']);
    if (financeLocked) {
      return new Set(roleTabs.filter(tab => tab.id !== 'finance').map(tab => tab.id));
    }
    return null;
  }, [setupGateActive, financeLocked, roleTabs]);
  const tabs = useMemo(() => {
    if (!allowedTabIds) return roleTabs;
    return roleTabs.map(tab => ({
      ...tab,
      locked: !allowedTabIds.has(tab.id),
    }));
  }, [roleTabs, allowedTabIds]);

  const groupedTabs = useMemo(() => {
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.tabIds
        .map(id => tabs.find(tab => tab.id === id))
        .filter((tab): tab is TabItem => !!tab),
    })).filter(group => group.items.length > 0);
  }, [tabs]);

  useEffect(() => {
    if (user && tabs.length > 0 && !tabs.find(tab => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [user, tabs, activeTab, setActiveTab]);

  useEffect(() => {
    if (setupGateActive && !['overview', 'settings', 'products'].includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [setupGateActive, activeTab, setActiveTab]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'staff' && activeTab === 'overview') setActiveTab('cashier');
  }, [user?.id]);

  if (!user) return null;

  if (!isDemoMode && businessSettings && !hasActiveSubscription(businessSettings)) {
    return <BillingGate />;
  }

  const setupLocked = isOnboarding && hasOwnerAccess(user.role) && !isBusinessSetupCompleted;
  if (setupLocked) {
    return (
      <div className="h-screen max-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--app-canvas-bg)' }}>
        <header className="shrink-0 border-b border-bakery-beige px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img src="/favicon.svg" alt="" className="h-[18px] w-[18px] rounded-md shrink-0" />
            <p className="font-serif font-black text-bakery-brown truncate">{businessSettings?.name || 'PreVisio'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AppearanceToggle />
              <LanguageSwitcher compact align="right" />
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-bakery-brown/60 hover:text-bakery-brown hover:bg-bakery-beige/70"
            >
              <LogOut size={14} />
              {t('logout')}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-[1400px] mx-auto w-full">
            <Suspense fallback={<p role="status">Loading…</p>}>
            <OnboardingWizard />
            </Suspense>
          </div>
        </main>
      </div>
    );
  }

  if (!isDemoMode && cloudLoadError) {
    return <main className="max-w-xl mx-auto p-8 space-y-4">
      <h1 className="text-xl font-bold">Business data could not be loaded</h1>
      <p role="alert">{cloudLoadError}</p>
      <p>Editing is paused to avoid working with incomplete records. Check the connection and reload.</p>
      <button className="underline mr-4" onClick={() => window.location.reload()}>Reload</button>
      <button className="underline" onClick={logout}>Sign out</button>
    </main>;
  }

  const storeName = businessSettings?.name || 'PreVisio';
  const activeTabMeta = tabs.find(tab => tab.id === activeTab);
  const breadcrumbLabel = activeTabMeta?.label || t(activeTab) || activeTab;

  const selectTab = (tabId: string, locked?: boolean) => {
    if (locked) return;
    setActiveTab(tabId);
    setIsSidebarOpen(false);
  };

  const SidebarNav = () => (
    <div className="flex flex-col h-full" style={{ color: 'var(--app-sidebar-fg)' }}>
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-sidebar-accent)', color: 'var(--app-sidebar-accent-fg)' }}>
            <Tag size={18} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--app-sidebar-muted)' }}>PreVisio</p>
            <h1 className="text-base font-black font-serif truncate leading-tight">{storeName}</h1>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5 scrollbar-hide">
        {groupedTabs.map(group => (
          <div key={group.id}>
            <p className="px-3 mb-1.5 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--app-sidebar-muted)' }}>
              {t(group.labelKey)}
            </p>
            <div className="space-y-0.5">
              {group.items.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => selectTab(tab.id, tab.locked)}
                    disabled={tab.locked}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-bold transition-all ${
                      isActive
                        ? 'shadow-sm'
                        : tab.locked
                          ? 'cursor-not-allowed opacity-40'
                          : 'hover:bg-white/15 hover:translate-x-0.5'
                    }`}
                    style={
                      isActive
                        ? {
                            background: 'color-mix(in srgb, var(--app-sidebar-fg) 14%, transparent)',
                            color: 'var(--app-sidebar-fg)',
                          }
                        : { color: tab.locked ? 'var(--app-sidebar-muted)' : 'var(--app-sidebar-muted)' }
                    }
                  >
                    <span className="shrink-0" style={{ color: isActive ? 'var(--app-sidebar-accent)' : 'var(--app-sidebar-muted)' }}>
                      {TAB_ICONS[tab.id] || <Layout size={18} />}
                    </span>
                    <span className="flex-1 truncate" style={isActive ? undefined : { color: 'color-mix(in srgb, var(--app-sidebar-fg) 70%, transparent)' }}>
                      {tab.label}
                    </span>
                    {tab.locked && <Lock size={12} className="opacity-60" />}
                    {typeof tab.badge === 'number' && tab.badge > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 pb-5 pt-4 space-y-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-sidebar-fg) 12%, transparent)' }}>
        {isDemoMode && (
          <div className="space-y-2 px-1 pb-1">
            <p className="text-[10px] font-black uppercase tracking-wider px-1" style={{ color: 'var(--app-sidebar-muted)' }}>
              {t('demoRoleSwitcher')}
            </p>
            <div className="grid grid-cols-3 gap-1 rounded-xl p-1" style={{ background: 'color-mix(in srgb, var(--app-sidebar-fg) 8%, transparent)' }}>
              {([
                { role: 'owner' as const, label: t('owner') },
                { role: 'manager' as const, label: t('manager') },
                { role: 'staff' as const, label: t('staffRole') },
              ]).map(opt => {
                const active = user.role === opt.role;
                return (
                  <button
                    key={opt.role}
                    type="button"
                    onClick={() => switchDemoRole(opt.role)}
                    className="rounded-lg px-1.5 py-2 text-[10px] font-black uppercase tracking-wide transition-colors"
                    style={
                      active
                        ? { background: 'var(--app-sidebar-chip)', color: 'var(--app-sidebar-accent)' }
                        : { color: 'var(--app-sidebar-muted)' }
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div
          className="flex items-center gap-3 rounded-xl px-3 py-3"
          style={{ background: 'color-mix(in srgb, var(--app-sidebar-fg) 6%, transparent)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
            style={{ background: 'var(--app-sidebar-chip)', color: 'var(--app-sidebar-accent)' }}
          >
            {(user.fullName || user.username).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate leading-none mb-1">
              {user.fullName || user.username}
            </p>
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--app-sidebar-muted)' }}>
              {t(user.role === 'staff' ? 'staffRole' : user.role)}
            </p>
            {scheduledToday[0] && (
              <p className="text-[9px] mt-0.5 truncate" style={{ color: 'var(--app-sidebar-muted)' }}>
                {t('scheduledToday')}
                {scheduledToday[0].startTime && scheduledToday[0].endTime
                  ? ` ${scheduledToday[0].startTime}–${scheduledToday[0].endTime}`
                  : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-lg hover:text-rose-300 hover:bg-black/10 transition-colors shrink-0"
            style={{ color: 'var(--app-sidebar-muted)' }}
            title={t('logout')}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen max-h-screen flex overflow-hidden" style={{ background: 'var(--app-canvas-bg)' }}>
      <aside
        className="hidden md:flex w-[248px] shrink-0 flex-col h-full border-r border-black/20"
        style={{ background: 'var(--app-sidebar-bg)', color: 'var(--app-sidebar-fg)' }}
      >
        <SidebarNav />
      </aside>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsSidebarOpen(false)}
          />
          <aside
            className="absolute left-0 top-0 bottom-0 w-[min(248px,86vw)] shadow-2xl animate-fade-in flex flex-col"
            style={{ background: 'var(--app-sidebar-bg)', color: 'var(--app-sidebar-fg)' }}
          >
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="absolute top-4 right-3 p-2 z-10 opacity-50 hover:opacity-100"
              style={{ color: 'var(--app-sidebar-fg)' }}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            <SidebarNav />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="shrink-0 backdrop-blur-md border-b border-bakery-beige px-4 sm:px-6 lg:px-8" style={{ background: 'color-mix(in srgb, var(--app-canvas-bg) 95%, transparent)' }}>
          <div className="h-12 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 -ml-1 rounded-lg text-bakery-brown hover:bg-bakery-beige/70 transition-colors"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
              <nav className="flex items-center gap-1.5 text-sm min-w-0 overflow-x-auto scrollbar-hide" aria-label={t('breadcrumb') || 'Breadcrumb'}>
                <button
                  type="button"
                  onClick={() => goToTrailItem(user.role === 'staff' ? 'cashier' : 'overview')}
                  className="text-bakery-brown/40 font-medium hover:text-bakery-brown transition-colors shrink-0"
                >
                  {t('home') || 'Home'}
                </button>
                {(navTrail.length ? navTrail : [activeTab]).map((tabId, index, arr) => {
                  const label = tabs.find(tab => tab.id === tabId)?.label || t(tabId) || tabId;
                  const isLast = index === arr.length - 1;
                  return (
                    <React.Fragment key={`${tabId}-${index}`}>
                      <span className="text-bakery-brown/25 shrink-0">/</span>
                      {isLast ? (
                        <span className="font-bold text-bakery-brown truncate">{label}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => goToTrailItem(tabId)}
                          className="font-medium text-bakery-brown/50 hover:text-bakery-brown truncate transition-colors"
                        >
                          {label}
                        </button>
                      )}
                    </React.Fragment>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <AppearanceToggle />
              <LanguageSwitcher compact align="right" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 lg:px-8 lg:py-5 w-full">
          <div className="max-w-[1400px] mx-auto w-full">
            <Suspense fallback={<p role="status">Loading…</p>}>
            {isOnboarding && hasOwnerAccess(user.role) && activeTab === 'overview' ? (
              <OnboardingWizard />
            ) : (
              <>
                {activeTab === 'overview' && (
                  <OverviewTab
                    setupRequired={setupGateActive}
                    setupCompleted={setupCompleted}
                    onStartSetup={startOnboarding}
                    onCompleteOnboarding={completeOnboarding}
                  />
                )}
                {activeTab === 'cashier' && <CashierTab />}
                {activeTab === 'tables' && <TablesTab />}
                {activeTab === 'orders' && <OrdersTab />}
                {activeTab === 'sales' && <SalesTab />}
                {activeTab === 'stock' && <StockTab />}
                {activeTab === 'products' && <ProductsTab />}
                {activeTab === 'customers' && <CustomersTab />}
                {activeTab === 'staff' && <StaffTab />}
                {activeTab === 'myshifts' && <MyShiftsTab />}
                {activeTab === 'finance' && <FinanceTab />}
                {activeTab === 'settings' && <SettingsTab />}
              </>
            )}
            </Suspense>
          </div>
        </main>
      </div>

      <ProductTour visibleTabIds={tabs.filter(tab => !tab.locked).map(tab => tab.id)} />
    </div>
  );
};
