import React from 'react';
import { Layout } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useApp } from '../AppContext';

type AuthShellProps = {
  onBackHome: () => void;
  children: React.ReactNode;
};

export const AuthShell = ({ onBackHome, children }: AuthShellProps) => {
  const { t } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-bakery-cream via-[#f7f3ed] to-bakery-beige/60 text-bakery-brown">
      <header className="shrink-0 px-4 sm:px-6 lg:px-10 py-4 sm:py-5 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 text-sm font-medium text-bakery-brown/50 hover:text-bakery-brown transition-colors"
        >
          <span aria-hidden="true">←</span>
          {t('backToHome')}
        </button>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="w-9 h-9 rounded-xl shadow-sm shadow-bakery-brown/20" />
            <div className="leading-tight hidden sm:block">
              <p className="text-sm font-bold tracking-tight text-bakery-brown font-serif">PreVisio</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-bakery-brown/40">
                {t('restaurantOs')}
              </p>
            </div>
          </div>

          <LanguageSwitcher align="right" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[420px] rounded-2xl border border-bakery-beige bg-white p-6 sm:p-8 shadow-2xl shadow-bakery-brown/10">
          {children}
        </div>
      </main>
    </div>
  );
};

export const authFieldClassName =
  'w-full rounded-xl border border-bakery-beige bg-white px-3.5 py-3 text-sm text-bakery-brown placeholder:text-bakery-brown/35 outline-none transition-shadow focus:border-bakery-caramel focus:ring-4 focus:ring-bakery-caramel/20';

export const authPrimaryButtonClassName =
  'w-full inline-flex items-center justify-center gap-2 rounded-xl bg-bakery-brown px-4 py-3 text-sm font-bold text-white shadow-lg shadow-bakery-brown/15 transition-all hover:bg-[#3e2723] active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none';
