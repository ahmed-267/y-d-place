
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../AppContext';
import { LogOut, Menu, X, Layout } from 'lucide-react';
import { OverviewTab } from './OverviewTab';
import { CashierTab } from './CashierTab';
import { OrdersTab } from './OrdersTab';
import { SalesTab } from './SalesTab';
import { StockTab } from './StockTab';
import { ProductsTab } from './ProductsTab';
import { StaffTab } from './StaffTab';
import { MyShiftsTab } from './MyShiftsTab';
import { FinanceTab } from './FinanceTab';
import { SettingsTab } from './SettingsTab';
import { Language, Role } from '../types';

export const Dashboard = () => {
  const { user, t, logout, lang, setLang, businessSettings, orders } = useApp();
  const [activeTab, setActiveTab] = useState('cashier');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const activeOrderCount = useMemo(() => {
    return orders.filter(o => o.status === 'Preparing' || o.status === 'Ready').length;
  }, [orders]);

  const tabs = useMemo(() => {
    if (!user) return [];
    return [
      { id: 'overview', label: t('overview'), roles: ['owner'] },
      { id: 'cashier', label: t('cashier'), roles: ['owner', 'manager', 'staff'] },
      { id: 'orders', label: t('orders'), roles: ['owner', 'manager', 'staff'], badge: activeOrderCount > 0 ? activeOrderCount : undefined },
      { id: 'sales', label: t('sales'), roles: ['owner'] },
      { id: 'stock', label: t('stock'), roles: ['owner', 'manager', 'staff'] },
      { id: 'products', label: t('products'), roles: ['owner', 'manager', 'staff'] },
      { id: 'staff', label: t('staff'), roles: ['owner', 'manager'] },
      { id: 'myshifts', label: t('myShifts'), roles: ['staff'] },
      { id: 'finance', label: t('finance'), roles: ['owner'] },
      { id: 'settings', label: t('settings'), roles: ['owner'] }
    ].filter(tab => tab.roles.includes(user.role));
  }, [user, t, activeOrderCount]);

  useEffect(() => {
    if (user && tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [user, tabs, activeTab]);

  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  if (!user) return null;

  const RoleBadge = ({ role }: { role: Role }) => {
    const colors = { 
      owner: 'bg-amber-100 text-amber-700', 
      manager: 'bg-blue-100 text-blue-700', 
      staff: 'bg-slate-100 text-slate-700' 
    };
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${colors[role]}`}>
        {t(role === 'staff' ? 'staffRole' : role)}
      </span>
    );
  };

  const mainLanguages: Language[] = ['en', 'fr', 'nl'];
  const otherLanguages: { code: Language, label: string }[] = [
    { code: 'fl', label: t('langFlemish') },
    { code: 'es', label: t('langSpanish') },
    { code: 'it', label: t('langItalian') },
    { code: 'de', label: t('langGerman') },
    { code: 'ar', label: t('langArabic') },
    { code: 'pt', label: t('langPortuguese') },
    { code: 'tr', label: t('langTurkish') },
    { code: 'pl', label: t('langPolish') },
    { code: 'ro', label: t('langRomanian') },
    { code: 'zh', label: t('langChinese') },
    { code: 'ja', label: t('langJapanese') }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-bakery-cream max-w-full overflow-x-hidden">
      <nav className="bg-white border-b border-bakery-beige px-4 sm:px-6 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center h-16 sm:h-20">
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-bakery-brown rounded-lg flex items-center justify-center text-white shrink-0">
                <Layout size={18} />
              </div>
              <h1 className="text-lg sm:text-xl font-black font-serif hidden sm:block truncate max-w-[120px] md:max-w-none">
                {businessSettings?.name || 'PreVisio'}
              </h1>
            </div>
            <div className="hidden md:flex gap-1 overflow-x-auto scrollbar-hide py-2">
              {tabs.map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                    activeTab === tab.id 
                      ? 'bg-bakery-beige text-bakery-brown shadow-sm' 
                      : 'text-bakery-brown/60 hover:text-bakery-brown hover:bg-bakery-beige/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {tab.label}
                    {typeof tab.badge === 'number' && tab.badge > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                        {tab.badge}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden lg:flex bg-bakery-beige/50 rounded-full p-1 relative">
              {mainLanguages.map(l => (
                <button 
                  key={l} 
                  onClick={() => setLang(l)} 
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                    lang === l ? 'bg-bakery-brown text-white shadow-sm' : 'text-bakery-brown hover:bg-bakery-brown/10'
                  }`}
                >
                  {t(`langShort_${l}`)}
                </button>
              ))}
              <div className="relative">
                <button 
                  onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                    !mainLanguages.includes(lang) ? 'bg-bakery-brown text-white shadow-sm' : 'text-bakery-brown hover:bg-bakery-brown/10'
                  }`}
                >
                  {!mainLanguages.includes(lang) ? t(`langShort_${lang}`) : '+'}
                </button>
                
                {isLangDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-[100] bg-bakery-brown/20 backdrop-blur-md animate-fade-in" onClick={() => setIsLangDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-bakery-beige rounded-xl shadow-xl z-[101] overflow-hidden animate-fade-in">
                      <div className="max-h-64 overflow-y-auto p-1">
                        {otherLanguages.map(l => (
                          <button 
                            key={l.code}
                            onClick={() => { setLang(l.code); setIsLangDropdownOpen(false); }}
                            className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-bakery-beige/50 transition-colors flex justify-between items-center ${
                              lang === l.code ? 'text-bakery-brown bg-bakery-beige/30' : 'text-bakery-brown/60'
                            }`}
                          >
                            <span>{l.label}</span>
                            <span className="uppercase text-[10px] opacity-40">{l.code}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 sm:border-l sm:border-bakery-beige sm:pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-none mb-1">@{user.username}</p>
                <RoleBadge role={user.role} />
              </div>
              <button 
                onClick={logout} 
                className="p-2 rounded-full bg-bakery-beige text-bakery-brown hover:bg-rose-100 hover:text-rose-600 transition-all active:scale-90"
                title={t('logout')}
              >
                <LogOut size={18} className="sm:w-5 sm:h-5" />
              </button>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className="md:hidden p-2 text-bakery-brown active:scale-90 transition-transform"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            <div className="absolute inset-0 bg-bakery-brown/40 backdrop-blur-xl animate-fade-in" onClick={() => setIsMenuOpen(false)} />
            <div className="absolute right-4 top-20 left-4 bg-white rounded-3xl shadow-2xl p-6 animate-fade-in flex flex-col gap-2 border border-bakery-beige max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-bakery-beige">
                <h3 className="text-xl font-bold font-serif text-bakery-brown">{t('menu')}</h3>
                <button onClick={() => setIsMenuOpen(false)} className="text-bakery-brown/40">
                  <X size={24} />
                </button>
              </div>
              {tabs.map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => { setActiveTab(tab.id); setIsMenuOpen(false); }} 
                  className={`p-4 rounded-xl font-bold text-left transition-all ${
                    activeTab === tab.id ? 'bg-bakery-beige text-bakery-brown' : 'text-bakery-brown/60 hover:bg-bakery-beige/30'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>{tab.label}</span>
                    {typeof tab.badge === 'number' && tab.badge > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                        {tab.badge}
                      </span>
                    )}
                  </span>
                </button>
              ))}
              <div className="flex flex-wrap justify-center gap-2 p-4 bg-bakery-beige/20 rounded-xl mt-2">
                {mainLanguages.map(l => (
                  <button 
                    key={l} 
                    onClick={() => { setLang(l); setIsMenuOpen(false); }} 
                    className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${
                      lang === l ? 'bg-bakery-brown text-white' : 'text-bakery-brown'
                    }`}
                  >
                    {t(`langShort_${l}`)}
                  </button>
                ))}
                <div className="w-full h-px bg-bakery-beige/30 my-2" />
                <div className="flex flex-wrap justify-center gap-1">
                  {otherLanguages.map(l => (
                    <button 
                      key={l.code} 
                      onClick={() => { setLang(l.code); setIsMenuOpen(false); }} 
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                        lang === l.code ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60 bg-white/50'
                      }`}
                    >
                      {t(`langShort_${l.code}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-bakery-beige flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-bakery-brown text-white flex items-center justify-center font-bold">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-none mb-1">@{user.username}</p>
                    <RoleBadge role={user.role} />
                  </div>
                </div>
                <button 
                  onClick={logout}
                  className="p-3 bg-rose-50 text-rose-600 rounded-xl font-bold text-sm flex items-center gap-2"
                >
                  <LogOut size={18} />
                  {t('logout')}
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1 p-4 sm:p-6 max-w-[1600px] mx-auto w-full overflow-x-hidden">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'cashier' && <CashierTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'sales' && <SalesTab />}
        {activeTab === 'stock' && <StockTab />}
        {activeTab === 'products' && <ProductsTab />}
        {activeTab === 'staff' && <StaffTab />}
        {activeTab === 'myshifts' && <MyShiftsTab />}
        {activeTab === 'finance' && <FinanceTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
};
