
import React from 'react';
import { useApp } from '../AppContext';
import { Language } from '../types';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BrainCircuit,
  CreditCard,
  Globe2,
  LayoutGrid,
  Package,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

const featureCards = [
  {
    title: 'Paper to Digital in Seconds.',
    description: 'AI scan reads your menu, creates items, and predicts ingredients automatically.',
    icon: BrainCircuit,
    span: 'md:col-span-2',
  },
  {
    title: 'Zero-Lag Ordering.',
    description: 'Cashier orders sync instantly to the kitchen board for fast service.',
    icon: ReceiptText,
    span: '',
  },
  {
    title: 'Ingredient-Level Intelligence.',
    description: 'Sell one waffle, and flour + chocolate are deducted from raw stock in real time.',
    icon: Package,
    span: '',
  },
  {
    title: 'Global Tax Compliance.',
    description: 'Built-in tax and social logic for Belgium, UK, and US operations.',
    icon: ShieldCheck,
    span: 'md:col-span-2',
  },
  {
    title: 'Team Accountability.',
    description: 'Track shifts, review performance, and manage team operations from one dashboard.',
    icon: Users,
    span: '',
  },
  {
    title: 'Tap-to-Pay Everywhere.',
    description: 'Turn your phone into a card reader with no extra hardware required.',
    icon: CreditCard,
    span: '',
  },
];

const plans = [
  {
    name: 'Free',
    price: '$0/mo',
    detail: 'Perfect for hobbyists.',
    points: ['Basic Stock', '1 User', '50 orders/mo'],
  },
  {
    name: 'Professional',
    price: '$39/mo',
    detail: 'Built for growth.',
    points: ['AI Scanning', 'Unlimited Orders', 'Global Taxes', 'Tap-to-Pay'],
    highlighted: true,
  },
  {
    name: 'Fleet',
    price: '$99/mo',
    detail: 'For multi-truck owners.',
    points: ['Advanced analytics', 'Multi-truck syncing', 'Priority support'],
  },
];

export const LandingPage = ({ onLoginClick }: { onLoginClick: () => void }) => {
  const { lang, setLang, t } = useApp();

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2A241F] overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(191,152,108,0.08)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-[#D4A373]/20 blur-3xl" />
        <div className="absolute -bottom-28 right-[-5rem] h-96 w-96 rounded-full bg-[#E9D5BE]/40 blur-3xl" />
      </div>

      <nav className="sticky top-0 z-40 border-b border-white/60 bg-[#FDFBF7]/75 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-20 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#2A241F] text-white flex items-center justify-center">
              <LayoutGrid size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">PreVisio</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex bg-white/70 rounded-full p-1 border border-white/60">
              {(['en', 'fr', 'nl', 'fl'] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    lang === l ? 'bg-[#2A241F] text-white' : 'text-[#2A241F]/65'
                  }`}
                >
                  {t(`langShort_${l}`)}
                </button>
              ))}
            </div>
            <button
              onClick={onLoginClick}
              className="px-4 py-2 rounded-xl bg-[#2A241F] text-white text-sm font-semibold"
            >
              {t('login')}
            </button>
          </div>
        </div>
      </nav>

      <main>
        <section className="px-6 pt-20 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5 }}
            className="max-w-5xl mx-auto text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#8A653E] backdrop-blur-md">
              <Sparkles size={14} />
              One app, total control
            </span>
            <h2 className="mt-6 text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[0.98]">
              The Operating System for Global Street Food.
            </h2>
            <p className="mt-6 max-w-3xl mx-auto text-base sm:text-xl text-[#2A241F]/70 leading-relaxed">
              From AI menu scanning to ingredient-level stock tracking. Manage your truck, staff, and taxes in one secure platform.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={onLoginClick}
                className="px-8 py-4 rounded-2xl bg-[#2A241F] text-white font-bold text-base shadow-xl shadow-[#2A241F]/20 inline-flex items-center justify-center gap-2"
              >
                Start Your 14-Day Free Trial
                <ArrowRight size={18} />
              </button>
              <a
                href="#pricing"
                className="px-8 py-4 rounded-2xl border border-[#2A241F]/15 bg-white/70 backdrop-blur-sm font-bold text-base"
              >
                View Global Pricing
              </a>
            </div>
          </motion.div>
        </section>

        <section className="px-6 py-16">
          <div className="max-w-7xl mx-auto">
            <motion.h3
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45 }}
              className="text-3xl sm:text-4xl font-black text-center mb-10"
            >
              Product Command Center
            </motion.h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-fr">
              {featureCards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <motion.article
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={{ duration: 0.4, delay: idx * 0.04 }}
                    className={`${card.span} rounded-3xl border border-white/70 bg-white/65 backdrop-blur-xl p-6 shadow-[0_18px_60px_rgba(30,30,30,0.08)]`}
                  >
                    <div className="h-11 w-11 rounded-xl bg-[#D4A373]/25 text-[#2A241F] flex items-center justify-center mb-5">
                      <Icon size={20} />
                    </div>
                    <h4 className="text-xl font-black mb-2">{card.title}</h4>
                    <p className="text-[#2A241F]/70 leading-relaxed">{card.description}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-6 py-20 bg-gradient-to-b from-[#f7efe6] to-[#fdfbf7]">
          <div className="max-w-7xl mx-auto">
            <motion.h3
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45 }}
              className="text-3xl sm:text-4xl font-black text-center mb-10"
            >
              Global Pricing
            </motion.h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan, idx) => (
                <motion.article
                  key={plan.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  className={`rounded-3xl p-7 border backdrop-blur-xl ${
                    plan.highlighted
                      ? 'bg-[#2A241F] text-white border-[#2A241F] shadow-2xl shadow-[#2A241F]/20'
                      : 'bg-white/70 border-white/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-2xl font-black">{plan.name}</h4>
                    {plan.highlighted && (
                      <span className="text-[10px] uppercase tracking-widest font-black px-3 py-1 rounded-full bg-white/15">
                        Most Popular
                      </span>
                    )}
                  </div>
                  <p className="text-3xl font-black mb-1">{plan.price}</p>
                  <p className={`${plan.highlighted ? 'text-white/75' : 'text-[#2A241F]/65'} mb-5`}>{plan.detail}</p>
                  <ul className="space-y-2 text-sm">
                    {plan.points.map((point) => (
                      <li key={point} className="inline-flex items-center gap-2">
                        <Globe2 size={14} className={plan.highlighted ? 'text-[#EBC08F]' : 'text-[#8A653E]'} />
                        {point}
                      </li>
                    ))}
                  </ul>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45 }}
            className="max-w-7xl mx-auto rounded-[2rem] border border-white/70 bg-white/70 backdrop-blur-xl p-10 sm:p-14 text-center shadow-[0_24px_70px_rgba(30,30,30,0.10)]"
          >
            <h3 className="text-4xl sm:text-6xl font-black tracking-tight mb-5">Ready to go digital?</h3>
            <button
              onClick={onLoginClick}
              className="px-8 py-4 rounded-2xl bg-[#2A241F] text-white font-bold text-base inline-flex items-center gap-2"
            >
              Get Started
              <ArrowRight size={18} />
            </button>
          </motion.div>
        </section>
      </main>
    </div>
  );
};
