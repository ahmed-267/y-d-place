
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../AppContext';
import { LogOut, Menu, X } from 'lucide-react';
import { OverviewTab } from './OverviewTab';
import { CashierTab } from './CashierTab';
import { SalesTab } from './SalesTab';
import { StockTab } from './StockTab';
import { ProductsTab } from './ProductsTab';
import { StaffTab } from './StaffTab';
import { MyShiftsTab } from './MyShiftsTab';
import { FinanceTab } from './FinanceTab';
import { Language, Role } from '../types';

export const Dashboard = () => {
  const { user, t, logout, lang, setLang } = useApp();
  const [activeTab, setActiveTab] = useState('cashier');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const tabs = useMemo(() => {
    if (!user) return [];
    return [
      { id: 'overview', label: t('overview'), roles: ['owner'] },
      { id: 'cashier', label: t('cashier'), roles: ['owner', 'manager', 'staff'] },
      { id: 'sales', label: t('sales'), roles: ['owner'] },
      { id: 'stock', label: t('stock'), roles: ['owner', 'manager', 'staff'] },
      { id: 'products', label: t('products'), roles: ['owner', 'manager', 'staff'] },
      { id: 'staff', label: t('staff'), roles: ['owner', 'manager'] },
      { id: 'myshifts', label: t('myShifts'), roles: ['staff'] },
      { id: 'finance', label: t('finance'), roles: ['owner'] }
    ].filter(tab => tab.roles.includes(user.role));
  }, [user, t]);

  useEffect(() => {
    if (user && tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [user, tabs, activeTab]);

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

  return (
    <div className="min-h-screen flex flex-col bg-bakery-cream">
      <nav className="bg-white border-b border-bakery-beige px-6 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center h-20">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧇</span>
              <h1 className="text-xl font-black font-serif hidden md:block">Keok's Place</h1>
            </div>
            <div className="hidden md:flex gap-1">
              {tabs.map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                    activeTab === tab.id 
                      ? 'bg-bakery-beige text-bakery-brown shadow-sm' 
                      : 'text-bakery-brown/60 hover:text-bakery-brown hover:bg-bakery-beige/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex bg-bakery-beige/50 rounded-full p-1">
              {(['en', 'fr', 'nl', 'fl'] as Language[]).map(l => (
                <button 
                  key={l} 
                  onClick={() => setLang(l)} 
                  className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                    lang === l ? 'bg-bakery-brown text-white shadow-sm' : 'text-bakery-brown hover:bg-bakery-brown/10'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 border-l border-bakery-beige pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-none mb-1">@{user.username}</p>
                <RoleBadge role={user.role} />
              </div>
              <button 
                onClick={logout} 
                className="p-2 rounded-full bg-bakery-beige text-bakery-brown hover:bg-rose-100 hover:text-rose-600 transition-all active:scale-90"
                title={t('logout')}
              >
                <LogOut size={20} />
              </button>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className="md:hidden p-2 text-bakery-brown"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-2 animate-fade-in border-t border-bakery-beige pt-4">
            {tabs.map(tab => (
              <button 
                key={tab.id} 
                onClick={() => { setActiveTab(tab.id); setIsMenuOpen(false); }} 
                className={`p-4 rounded-xl font-bold text-left transition-all ${
                  activeTab === tab.id ? 'bg-bakery-beige text-bakery-brown' : 'text-bakery-brown/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="flex justify-center gap-4 p-4 bg-bakery-beige/20 rounded-xl mt-2">
              {(['en', 'fr', 'nl', 'fl'] as Language[]).map(l => (
                <button 
                  key={l} 
                  onClick={() => { setLang(l); setIsMenuOpen(false); }} 
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${
                    lang === l ? 'bg-bakery-brown text-white' : 'text-bakery-brown'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'cashier' && <CashierTab />}
        {activeTab === 'sales' && <SalesTab />}
        {activeTab === 'stock' && <StockTab />}
        {activeTab === 'products' && <ProductsTab />}
        {activeTab === 'staff' && <StaffTab />}
        {activeTab === 'myshifts' && <MyShiftsTab />}
        {activeTab === 'finance' && <FinanceTab />}
      </main>
    </div>
  );
};
