import React from 'react';
import { ArrowRight, Home, Layout, MapPinOff } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

type Props = {
  onHome: () => void;
  onLogin?: () => void;
  path?: string;
};

export const NotFoundPage: React.FC<Props> = ({ onHome, onLogin, path }) => {
  const reduced = useReducedMotion();
  const shownPath = path || (typeof window !== 'undefined' ? window.location.pathname : '/');

  return (
    <div className="min-h-screen selection:bg-bakery-caramel selection:text-[#1f1a16] bg-[#0b0d12] text-[#ece8e1]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[#0b0d12]" />
        <div className="absolute inset-0 [background-size:52px_52px] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(212,163,115,0.28),transparent_42%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_70%,rgba(233,213,190,0.12),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_62%,rgba(212,163,115,0.14),transparent_38%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(8,10,15,0.55)_76%,rgba(5,6,10,0.85)_100%)]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0d12]/75 backdrop-blur-md">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6">
          <button type="button" onClick={onHome} className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bakery-caramel text-[#2a241f] shadow-[0_0_25px_rgba(212,163,115,0.35)] transition-transform group-hover:-translate-y-0.5">
              <Layout size={20} />
            </div>
            <span className="mt-1 font-serif text-2xl font-black leading-none tracking-tight">PreVisio</span>
          </button>
          {onLogin && (
            <button
              type="button"
              onClick={onLogin}
              className="h-10 px-4 rounded-xl text-sm font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-7xl flex-col items-center justify-center px-6 py-16 text-center">
        <motion.div
          initial={reduced ? undefined : { opacity: 0, y: 18 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-2xl"
        >
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-bakery-caramel">
            <MapPinOff size={28} />
          </div>

          <p className="mb-4 text-[11px] font-black uppercase tracking-[0.22em] text-bakery-caramel">Error 404</p>
          <h1 className="font-serif text-5xl sm:text-6xl font-black tracking-tight text-[#f0ece4]">
            This table is empty
          </h1>
          <p className="mt-5 text-base sm:text-lg text-[#d6d1c8]/78 leading-relaxed max-w-lg mx-auto">
            We couldn’t find that page. It may have been moved, renamed, or never plated.
          </p>

          <p className="mt-6 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-mono text-white/45">
            <span className="shrink-0 text-white/25">path</span>
            <span className="truncate">{shownPath}</span>
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onHome}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-bakery-caramel px-7 text-sm font-black text-[#2a241f] shadow-[0_12px_40px_rgba(212,163,115,0.35)] transition-transform hover:-translate-y-0.5"
            >
              <Home size={16} />
              Back to home
              <ArrowRight size={16} />
            </button>
            {onLogin && (
              <button
                type="button"
                onClick={onLogin}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-7 text-sm font-bold text-[#f0ece4] transition-colors hover:bg-white/[0.08]"
              >
                Go to login
              </button>
            )}
          </div>
        </motion.div>

        <motion.div
          aria-hidden
          initial={reduced ? undefined : { opacity: 0 }}
          animate={reduced ? undefined : { opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.7 }}
          className="mt-16 flex gap-6 text-4xl opacity-50"
        >
          {['🧇', '☕', '🥐', '🍰'].map((emoji, i) => (
            <span
              key={emoji}
              className="inline-block animate-float"
              style={{ animationDelay: `${i * 0.35}s` }}
            >
              {emoji}
            </span>
          ))}
        </motion.div>
      </main>
    </div>
  );
};
