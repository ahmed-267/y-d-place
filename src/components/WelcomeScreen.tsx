
import React from 'react';
import { useApp } from '../AppContext';
import { Layout, Globe, Shield, Zap, ChevronRight, BarChart3, Users, Package, CreditCard, ShoppingCart } from 'lucide-react';

const DashboardMockup = () => (
  <div className="relative w-full max-w-2xl mx-auto lg:mx-0 perspective-1000">
    <div className="bg-white rounded-[2rem] shadow-2xl border border-bakery-brown/10 overflow-hidden animate-float transform-gpu rotate-y-[-12deg] rotate-x-[8deg] scale-105">
      {/* Top Bar */}
      <div className="h-12 bg-bakery-brown/5 border-b border-bakery-brown/5 flex items-center px-6 gap-4">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/40" />
        </div>
        <div className="h-5 w-32 bg-bakery-brown/10 rounded-full" />
      </div>
      
      <div className="flex h-[400px]">
        {/* Sidebar */}
        <div className="w-16 border-r border-bakery-brown/5 flex flex-col items-center py-6 gap-6 bg-bakery-cream/30">
          <div className="w-8 h-8 bg-bakery-brown rounded-lg" />
          <div className="w-8 h-8 bg-bakery-brown/10 rounded-lg" />
          <div className="w-8 h-8 bg-bakery-brown/10 rounded-lg" />
          <div className="w-8 h-8 bg-bakery-brown/10 rounded-lg" />
        </div>
        
        {/* Main Content */}
        <div className="flex-1 p-8 bg-white">
          <div className="flex justify-between items-end mb-8">
            <div className="space-y-2">
              <div className="h-4 w-24 bg-bakery-brown/10 rounded-full" />
              <div className="h-8 w-48 bg-bakery-brown/20 rounded-full" />
            </div>
            <div className="h-10 w-10 bg-bakery-accent/30 rounded-full" />
          </div>
          
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="p-6 bg-bakery-beige/20 rounded-3xl border border-bakery-beige/50">
              <div className="h-3 w-16 bg-bakery-brown/10 rounded-full mb-3" />
              <div className="h-6 w-24 bg-bakery-brown/30 rounded-full" />
            </div>
            <div className="p-6 bg-bakery-accent/10 rounded-3xl border border-bakery-accent/30">
              <div className="h-3 w-16 bg-bakery-brown/10 rounded-full mb-3" />
              <div className="h-6 w-24 bg-bakery-brown/30 rounded-full" />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="h-12 w-full bg-bakery-cream rounded-2xl border border-bakery-brown/5" />
            <div className="h-12 w-full bg-bakery-cream rounded-2xl border border-bakery-brown/5" />
            <div className="h-12 w-full bg-bakery-cream rounded-2xl border border-bakery-brown/5" />
          </div>
        </div>
      </div>
    </div>
    
    {/* Decorative Elements */}
    <div className="absolute -top-6 -right-6 w-24 h-24 bg-bakery-accent/40 rounded-full blur-3xl" />
    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-bakery-caramel/30 rounded-full blur-3xl" />
  </div>
);

const FoodMarquee = () => {
  const emojis = [
    '🧇', '🥞', '🥐', '🥯', '🥖', '🥨', '🧀', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥗', '🥘', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '☕', '🍵', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉'
  ];
  
  return (
    <div className="w-full overflow-hidden bg-bakery-brown/5 py-8 border-y border-bakery-brown/5">
      <div className="flex animate-marquee whitespace-nowrap">
        <div className="flex gap-12 px-6">
          {emojis.map((emoji, i) => (
            <span key={i} className="text-4xl filter grayscale-[0.2] hover:grayscale-0 transition-all cursor-default scale-110">
              {emoji}
            </span>
          ))}
        </div>
        <div className="flex gap-12 px-6">
          {emojis.map((emoji, i) => (
            <span key={`dup-${i}`} className="text-4xl filter grayscale-[0.2] hover:grayscale-0 transition-all cursor-default scale-110">
              {emoji}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export const WelcomeScreen = ({ onLogin, onRegister }: { onLogin: () => void, onRegister: () => void }) => {
  const { t } = useApp();
  
  return (
    <div className="min-h-screen flex flex-col bg-bakery-cream selection:bg-bakery-brown selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bakery-cream/80 backdrop-blur-md border-b border-bakery-brown/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-bakery-brown rounded-xl flex items-center justify-center text-white shadow-lg shadow-bakery-brown/20">
              <Layout size={22} />
            </div>
            <h1 className="text-2xl font-black font-serif tracking-tight text-bakery-brown">Y&D Place</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onLogin}
              className="hidden sm:block text-bakery-brown font-bold hover:text-bakery-brown/70 transition-colors"
            >
              {t('loginBtn')}
            </button>
            <button 
              onClick={onRegister}
              className="px-6 py-2.5 bg-bakery-brown text-white rounded-full font-bold hover:bg-bakery-brown/90 transition-all active:scale-95 shadow-lg shadow-bakery-brown/10"
            >
              {t('getStarted')}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative pt-20 pb-32 px-6 overflow-hidden">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
            <div className="text-left animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-bakery-brown text-xs font-bold uppercase tracking-widest mb-8 border border-bakery-brown/10 shadow-sm">
                <span className="flex gap-1">
                  🇺🇸 🇬🇧 🇫🇷 🇩🇪 🇯🇵 🇦🇪 🇸🇦 🇧🇪 🇨🇦 🇦🇺 🇮🇹 🇪🇸
                </span>
                <span className="ml-2 opacity-60">{t('trustedByCountries')}</span>
              </div>
              
              <h2 className="text-6xl md:text-8xl font-black font-serif text-bakery-brown mb-8 leading-[0.9] tracking-tight">
                {t('welcomeTitle')}
              </h2>
              
              <p className="text-xl md:text-2xl text-bakery-brown/60 mb-12 max-w-xl leading-relaxed">
                {t('welcomeSubtitle')}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={onRegister}
                  className="px-10 py-5 bg-bakery-brown text-white rounded-2xl font-bold text-xl shadow-2xl shadow-bakery-brown/20 hover:bg-bakery-brown/90 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {t('register')}
                  <ChevronRight size={20} />
                </button>
                <button 
                  onClick={onLogin}
                  className="px-10 py-5 bg-white border-2 border-bakery-brown/10 text-bakery-brown rounded-2xl font-bold text-xl hover:bg-bakery-beige/30 transition-all active:scale-95"
                >
                  {t('loginToAccount')}
                </button>
              </div>
            </div>
            
            <div className="hidden lg:block animate-fade-in delay-200">
              <DashboardMockup />
            </div>
          </div>
          
          {/* Background shapes */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[800px] h-[800px] bg-bakery-accent/10 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[600px] h-[600px] bg-bakery-caramel/5 rounded-full blur-3xl -z-10" />
        </section>

        {/* Marquee Strip */}
        <FoodMarquee />

        {/* Features Grid */}
        <section className="py-32 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-black font-serif text-bakery-brown mb-6">{t('builtForModernKitchen')}</h2>
              <p className="text-bakery-brown/60 text-lg max-w-2xl mx-auto">
                {t('builtForModernKitchenSub')}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="group p-10 bg-bakery-cream rounded-[2.5rem] border border-bakery-brown/5 transition-all hover:shadow-2xl hover:shadow-bakery-brown/5 hover:-translate-y-2">
                <div className="w-16 h-16 bg-bakery-accent/30 rounded-3xl flex items-center justify-center text-bakery-brown mb-8 group-hover:scale-110 transition-transform">
                  <BarChart3 size={32} />
                </div>
                <h3 className="text-2xl font-bold font-serif text-bakery-brown mb-4">{t('featureAnalytics')}</h3>
                <p className="text-bakery-brown/60 leading-relaxed">
                  {t('featureAnalyticsSub')}
                </p>
              </div>
              
              <div className="group p-10 bg-bakery-cream rounded-[2.5rem] border border-bakery-brown/5 transition-all hover:shadow-2xl hover:shadow-bakery-brown/5 hover:-translate-y-2">
                <div className="w-16 h-16 bg-bakery-caramel/20 rounded-3xl flex items-center justify-center text-bakery-brown mb-8 group-hover:scale-110 transition-transform">
                  <Package size={32} />
                </div>
                <h3 className="text-2xl font-bold font-serif text-bakery-brown mb-4">{t('featureInventory')}</h3>
                <p className="text-bakery-brown/60 leading-relaxed">
                  {t('featureInventorySub')}
                </p>
              </div>
              
              <div className="group p-10 bg-bakery-cream rounded-[2.5rem] border border-bakery-brown/5 transition-all hover:shadow-2xl hover:shadow-bakery-brown/5 hover:-translate-y-2">
                <div className="w-16 h-16 bg-bakery-beige rounded-3xl flex items-center justify-center text-bakery-brown mb-8 group-hover:scale-110 transition-transform">
                  <Users size={32} />
                </div>
                <h3 className="text-2xl font-bold font-serif text-bakery-brown mb-4">{t('featureTeam')}</h3>
                <p className="text-bakery-brown/60 leading-relaxed">
                  {t('featureTeamSub')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Global Section */}
        <section className="py-32 px-6 bg-bakery-brown text-bakery-cream overflow-hidden relative">
          <div className="max-w-7xl mx-auto flex flex-col items-center text-center relative z-10">
            <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-10 backdrop-blur-md">
              <Globe size={40} className="text-bakery-accent" />
            </div>
            <h2 className="text-5xl md:text-7xl font-black font-serif mb-8 max-w-4xl leading-tight">
              {t('readyToScale')}
            </h2>
            <p className="text-xl text-bakery-cream/60 mb-12 max-w-2xl">
              {t('readyToScaleSub')}
            </p>
            <button 
              onClick={onRegister}
              className="px-12 py-6 bg-bakery-accent text-bakery-brown rounded-2xl font-bold text-2xl hover:bg-bakery-accent/90 transition-all active:scale-95 shadow-2xl shadow-black/20"
            >
              {t('startFreeTrial')}
            </button>
          </div>
          
          {/* Decorative background */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-bakery-accent rounded-full blur-[120px]" />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-16 px-6 bg-white border-t border-bakery-brown/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-bakery-brown rounded-lg flex items-center justify-center text-white">
              <Layout size={18} />
            </div>
            <span className="text-xl font-black font-serif text-bakery-brown">Y&D Place</span>
          </div>
          
          <div className="flex gap-8 text-sm font-bold text-bakery-brown/40 uppercase tracking-widest">
            <a href="#" className="hover:text-bakery-brown transition-colors">{t('privacy')}</a>
            <a href="#" className="hover:text-bakery-brown transition-colors">{t('terms')}</a>
            <a href="#" className="hover:text-bakery-brown transition-colors">{t('contact')}</a>
          </div>
          
          <p className="text-bakery-brown/40 text-xs font-bold uppercase tracking-widest">
            &copy; {new Date().getFullYear()} {t('platformName')}.
          </p>
        </div>
      </footer>
    </div>
  );
};
