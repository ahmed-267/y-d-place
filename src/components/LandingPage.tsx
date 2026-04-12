
import React from 'react';
import { useApp } from '../AppContext';
import { Language } from '../types';

export const LandingPage = ({ onLoginClick }: { onLoginClick: () => void }) => {
  const { t, lang, setLang } = useApp();
  
  return (
    <div className="min-h-screen flex flex-col bg-bakery-cream">
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🧇</span>
          <h1 className="text-2xl font-black font-serif tracking-tight">Y&D Place</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-bakery-beige rounded-full p-1">
            {(['en', 'fr', 'nl', 'fl'] as Language[]).map(l => (
              <button 
                key={l} 
                onClick={() => setLang(l)} 
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-all ${
                  lang === l ? 'bg-bakery-brown text-white shadow-sm' : 'text-bakery-brown hover:bg-bakery-brown/10'
                }`}
              >
                {t(`langShort_${l}`)}
              </button>
            ))}
          </div>
          <button onClick={onLoginClick} className="btn-primary text-sm">{t('login')} →</button>
        </div>
      </nav>
      
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 max-w-7xl mx-auto w-full">
        <div className="max-w-3xl animate-fade-in">
          <span className="inline-block px-4 py-1 bg-bakery-accent rounded-full text-xs font-bold uppercase tracking-widest mb-6">
            {t('brusselsLocation')}
          </span>
          <h2 className="text-6xl md:text-8xl font-black font-serif mb-6 leading-tight">
            {t('welcome')}
          </h2>
          <p className="text-xl md:text-2xl text-bakery-brown/70 mb-12 max-w-2xl mx-auto">
            {t('tagline')}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {[
              { emoji: "🧇", label: t('waffles') },
              { emoji: "🥞", label: t('crepes') },
              { emoji: "☕", label: t('hotChoc') }
            ].map(item => (
              <div key={item.label} className="card-bakery p-8 flex flex-col items-center group hover:scale-105 transition-transform cursor-default">
                <span className="text-5xl mb-4 group-hover:animate-bounce">{item.emoji}</span>
                <h3 className="text-xl font-bold font-serif">{item.label}</h3>
              </div>
            ))}
          </div>
          <p className="italic text-bakery-brown/50 font-medium">{t('intro')}</p>
        </div>
      </main>
    </div>
  );
};
