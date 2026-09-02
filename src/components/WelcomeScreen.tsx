import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Globe,
  Languages,
  Layout,
  Mail,
  MessageCircle,
  Package,
  Phone,
  Quote,
  ReceiptText,
  ScanLine,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

type WelcomeScreenProps = {
  onLogin: () => void;
  onRegister: () => void;
};

type Theme = { isDark: boolean };

const Shot = ({
  isDark,
  src,
  alt,
  label,
  className = '',
  priority = false,
  framed = true,
}: Theme & {
  src: string;
  alt: string;
  label?: string;
  className?: string;
  priority?: boolean;
  framed?: boolean;
}) => (
  <figure
    className={`overflow-hidden ${
      framed
        ? `rounded-[1.5rem] border ${
            isDark
              ? 'border-white/12 bg-[#151820] shadow-[0_30px_80px_rgba(0,0,0,0.45)]'
              : 'border-black/[0.08] bg-white shadow-[0_30px_70px_rgba(60,45,35,0.16)]'
          }`
        : ''
    } ${className}`}
  >
    {framed && label && (
      <div
        className={`flex items-center gap-1.5 border-b px-4 py-2.5 ${
          isDark ? 'border-white/10 bg-white/[0.03]' : 'border-black/[0.06] bg-[#faf7f2]'
        }`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${isDark ? 'bg-white/15' : 'bg-black/10'}`} />
        <span className={`h-2.5 w-2.5 rounded-full ${isDark ? 'bg-white/15' : 'bg-black/10'}`} />
        <span className={`h-2.5 w-2.5 rounded-full ${isDark ? 'bg-white/15' : 'bg-black/10'}`} />
        <figcaption className={`ml-3 text-[10px] font-black uppercase tracking-[0.18em] ${isDark ? 'text-white/35' : 'text-black/30'}`}>
          {label}
        </figcaption>
      </div>
    )}
    <img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" className="block w-full" />
  </figure>
);

const workspaces = [
  {
    title: 'Cashier',
    tagline: 'Sell in seconds',
    description: 'Tap items, add extras, take cash or card — the ticket leaves for the kitchen instantly.',
    icon: ReceiptText,
    shot: '/screenshots/cashier.jpg',
    label: 'Cashier · live cart',
  },
  {
    title: 'Kitchen board',
    tagline: 'Nothing gets lost',
    description: 'Every order moves through Preparing, Ready, and Completed so the line always knows what is next.',
    icon: ClipboardList,
    shot: '/screenshots/orders.jpg',
    label: 'Orders · kitchen board',
  },
  {
    title: 'Stock',
    tagline: 'Never run dry',
    description: 'Prepped batches and raw ingredients deduct themselves as you sell, with low-stock flags.',
    icon: Package,
    shot: '/screenshots/stock.jpg',
    label: 'Stock · prepped & ingredients',
  },
  {
    title: 'Staff',
    tagline: 'Cover every shift',
    description: 'Roles, hourly rates, and login access for the whole team, with rota and timesheets alongside.',
    icon: Users,
    shot: '/screenshots/staff-team.jpg',
    label: 'Staff · team',
  },
  {
    title: 'Finance',
    tagline: 'Know your margin',
    description: 'Revenue minus expenses and tax, projected for the month, the year, and all time.',
    icon: WalletCards,
    shot: '/screenshots/finance-profit.jpg',
    label: 'Finance · profit overview',
  },
];

const showcases = [
  {
    eyebrow: 'Sales history',
    title: 'Every order, searchable',
    description: 'Filter by day, week, or range. Expand any ticket to see items, extras, payment method, and who served it.',
    points: ['Card and cash split', 'Cashier attribution', 'CSV export'],
    shot: '/screenshots/sales.jpg',
    label: 'Sales · history',
    tone: 'plain' as const,
  },
  {
    eyebrow: 'Menu',
    title: 'Your catalogue, linked to stock',
    description: 'Each dish links to the ingredients it consumes, so selling it updates inventory without a second thought.',
    points: ['Scan a printed menu with AI', 'Categories and prices', 'Activate or pause items'],
    shot: '/screenshots/menu.jpg',
    label: 'Menu · products',
    tone: 'panel' as const,
  },
  {
    eyebrow: 'Expenses',
    title: 'Receipts filed as you go',
    description: 'Photograph a supplier receipt and PreVisio reads the amount, date, and category into your books.',
    points: ['Recurring costs tracked', 'Category breakdown', 'Attached receipt images'],
    shot: '/screenshots/finance.jpg',
    label: 'Finance · expenses',
    tone: 'bleed' as const,
  },
  {
    eyebrow: 'Timesheets',
    title: 'Hours that add themselves up',
    description: 'Shifts logged during service become the timesheet, so payroll is a read rather than a rebuild.',
    points: ['Per-person totals', 'Filter by date range', 'Rota planning built in'],
    shot: '/screenshots/staff-timesheets.jpg',
    label: 'Staff · timesheets',
    tone: 'stack' as const,
  },
];

const steps = [
  { step: '01', title: 'Scan your menu', description: 'One photo creates your products, prices, and categories.', icon: BrainCircuit },
  { step: '02', title: 'Open the till', description: 'Your team sells from day one — no training week needed.', icon: ReceiptText },
  { step: '03', title: 'Watch the numbers', description: 'Stock, staff hours, and profit update as you trade.', icon: WalletCards },
];

const features = [
  { title: 'AI menu scan', description: 'Turn a printed menu into a live catalogue in minutes.', icon: BrainCircuit, wide: true },
  { title: 'Receipt to expense', description: 'Photograph a supplier receipt and file it automatically.', icon: ScanLine, wide: false },
  { title: 'Tap-to-Pay & Stripe', description: 'Take card and contactless payments in the same flow.', icon: CreditCard, wide: false },
  { title: 'Reports & exports', description: 'Daily sales, best-sellers, and VAT-ready summaries.', icon: ClipboardList, wide: false },
  { title: 'Four languages', description: 'EN, FR, NL, and Flemish for mixed-language teams.', icon: Languages, wide: false },
  { title: 'Roles that fit', description: 'Owners see everything; staff see only their tools.', icon: Users, wide: true },
];

const stats = [
  { value: '30s', label: 'Average order time' },
  { value: '4', label: 'Languages built in' },
  { value: '1 photo', label: 'To import a menu' },
  { value: '0', label: 'Spreadsheets needed' },
];

const plans = [
  {
    name: 'Free',
    price: '$0/mo',
    description: 'Try PreVisio on a live floor.',
    features: ['50 orders / month', 'Basic inventory', 'Single language'],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$39/mo',
    description: 'Everything a busy kitchen needs.',
    features: ['Unlimited orders', 'AI menu scan', 'Ingredient tracking', 'Finance & tax suite'],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For multi-location operators.',
    features: ['Fleet analytics', 'Priority support', 'Guided onboarding'],
    highlighted: false,
  },
];

const testimonials = [
  { quote: 'Order mistakes dropped by half in two weeks. The kitchen sync is instant.', author: 'Nora A.', role: 'Owner · Brussels Waffle Bar' },
  { quote: 'Finance finally makes sense at tax time. It feels like having an assistant.', author: 'James V.', role: 'Co-founder · Street Bite London' },
  { quote: 'The team picked it up in a single shift, and the menu import saved us hours.', author: 'Lina K.', role: 'Manager · Antwerp Crepes' },
];

const faqItems = [
  { question: 'Can I start free and upgrade later?', answer: 'Yes. Products, sales history, and team data all carry over when you upgrade.' },
  { question: 'Does it work for mixed-language teams?', answer: 'EN, FR, NL, and Flemish are built in, and each person can pick their own.' },
  { question: 'How long does setup take?', answer: 'Most kitchens are selling the same day — scan the menu, add staff, open the till.' },
  { question: 'Do I need new hardware?', answer: 'No. PreVisio runs in the browser on the tablet, laptop, or phone you already use.' },
];

const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children,
  delay = 0,
  className = '',
}) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? undefined : { opacity: 0, y: 26 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

const FoodMarquee = ({ isDark }: Theme) => {
  const emojis = ['🧇', '🥞', '🥐', '🍰', '☕', '🥗', '🍔', '🍕', '🍜', '🧁', '🥖', '🍩', '🥤', '🍫', '🥨', '🍵'];
  return (
    <div className={`w-full overflow-hidden border-y py-8 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-black/10 bg-black/[0.02]'}`}>
      <div className="flex animate-marquee whitespace-nowrap">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-12 px-6">
            {emojis.map((emoji, i) => (
              <span key={`${copy}-${i}`} className="text-4xl opacity-70 transition-opacity hover:opacity-100">
                {emoji}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const WelcomeScreen = ({ onLogin, onRegister }: WelcomeScreenProps) => {
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const reduced = useReducedMotion();

  const glassCard = isDark
    ? 'rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-[0_18px_50px_rgba(1,8,20,0.35)]'
    : 'rounded-[2rem] border border-black/10 bg-white/75 backdrop-blur-md shadow-[0_18px_50px_rgba(30,30,30,0.12)]';
  const heading = isDark ? 'text-[#f0ece4]' : 'text-[#201c18]';
  const body = isDark ? 'text-[#d6d1c8]/78' : 'text-[#3f3933]/78';
  const muted = isDark ? 'text-white/50' : 'text-black/45';

  const active = useMemo(() => workspaces[activeTab], [activeTab]);

  return (
    <div className={`min-h-screen selection:bg-bakery-caramel selection:text-[#1f1a16] ${isDark ? 'bg-[#0b0d12] text-[#ece8e1]' : 'bg-[#f7f3ed] text-[#2a241f]'}`}>
      {/* Original base color + soft radial gradient blends (not a recolor) */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className={`absolute inset-0 ${isDark ? 'bg-[#0b0d12]' : 'bg-[#f7f3ed]'}`} />
        <div className={`absolute inset-0 [background-size:52px_52px] ${isDark ? '[background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]' : '[background-image:linear-gradient(rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.06)_1px,transparent_1px)]'}`} />
        <div className={`absolute inset-0 ${isDark ? 'bg-[radial-gradient(circle_at_50%_18%,rgba(212,163,115,0.28),transparent_42%)]' : 'bg-[radial-gradient(circle_at_50%_18%,rgba(212,163,115,0.18),transparent_42%)]'}`} />
        <div className={`absolute inset-0 ${isDark ? 'bg-[radial-gradient(circle_at_12%_70%,rgba(233,213,190,0.12),transparent_40%)]' : 'bg-[radial-gradient(circle_at_12%_70%,rgba(233,213,190,0.28),transparent_40%)]'}`} />
        <div className={`absolute inset-0 ${isDark ? 'bg-[radial-gradient(circle_at_88%_62%,rgba(212,163,115,0.14),transparent_38%)]' : 'bg-[radial-gradient(circle_at_88%_62%,rgba(212,163,115,0.12),transparent_38%)]'}`} />
        <div className={`absolute inset-0 ${isDark ? 'bg-[radial-gradient(circle_at_center,transparent_0%,rgba(8,10,15,0.55)_76%,rgba(5,6,10,0.85)_100%)]' : 'bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.2)_70%,rgba(248,243,235,0.85)_100%)]'}`} />
      </div>

      <header className={`sticky top-0 z-50 backdrop-blur-md ${isDark ? 'border-b border-white/10 bg-[#0b0d12]/75' : 'border-b border-black/10 bg-[#f7f3ed]/80'}`}>
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bakery-caramel text-[#2a241f] shadow-[0_0_25px_rgba(212,163,115,0.35)]">
              <Layout size={20} />
            </div>
            <span className="mt-1 font-serif text-2xl font-black leading-none tracking-tight">PreVisio</span>
          </div>

          <nav className={`absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 text-sm font-bold md:flex ${isDark ? 'text-white/70' : 'text-black/60'}`}>
            {[
              { href: '#product', label: 'Product' },
              { href: '#tour', label: 'Tour' },
              { href: '#features', label: 'Features' },
              { href: '#pricing', label: 'Pricing' },
              { href: '#contact', label: 'Contact' },
            ].map((item) => (
              <a key={item.href} href={item.href} className={`transition hover:-translate-y-0.5 ${isDark ? 'hover:text-white' : 'hover:text-black'}`}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button type="button" onClick={onLogin} className={`hidden font-bold transition-colors sm:block ${isDark ? 'text-white/75 hover:text-white' : 'text-black/65 hover:text-black'}`}>
              Login
            </button>
            <button
              type="button"
              onClick={onRegister}
              className="rounded-2xl bg-bakery-caramel px-6 py-2.5 font-bold text-[#2a241f] shadow-[0_10px_28px_rgba(212,163,115,0.35)] transition-all hover:bg-[#c6925f] active:scale-95"
            >
              Get Started
            </button>
            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              role="switch"
              aria-checked={isDark}
              aria-label="Toggle dark mode"
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${isDark ? 'bg-bakery-caramel/70' : 'bg-bakery-brown/25'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-9' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* 1. HERO — centered brand + layered screenshots */}
        <section className="relative px-6 pt-20 pb-16">
          <div className="mx-auto w-full max-w-6xl text-center">
            <motion.div
              initial={reduced ? undefined : { opacity: 0, y: 26 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-7"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-bakery-caramel/40 bg-bakery-caramel/15 px-4 py-2 text-xs font-bold uppercase tracking-widest text-bakery-caramel">
                <Sparkles size={14} />
                Built for food businesses
              </div>
              <h1 className={`mx-auto max-w-3xl font-serif text-5xl font-black leading-[0.95] tracking-tight md:text-7xl ${heading}`}>
                Run smarter. Grow faster.
              </h1>
              <p className={`mx-auto max-w-xl text-xl leading-relaxed ${body}`}>
                Orders, stock, staff, and finance in one calm workspace — for cafés, bakeries, and quick service.
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <motion.button
                  type="button"
                  onClick={onRegister}
                  whileHover={reduced ? undefined : { scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-bakery-caramel px-9 py-4 text-lg font-bold text-[#2a241f] shadow-[0_14px_34px_rgba(212,163,115,0.42)] transition-colors hover:bg-[#c6925f]"
                >
                  Get started free
                  <ArrowRight size={20} />
                </motion.button>
                <button
                  type="button"
                  onClick={onLogin}
                  className={`rounded-2xl border-2 px-9 py-4 text-lg font-bold transition-all active:scale-95 ${isDark ? 'border-white/15 bg-white/[0.03] hover:bg-white/[0.07]' : 'border-black/10 bg-white/70 hover:bg-white'}`}
                >
                  Login
                </button>
              </div>
              <div className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold ${muted}`}>
                <span className="inline-flex items-center gap-2"><Check size={15} className="text-bakery-caramel" /> No card required</span>
                <span className="inline-flex items-center gap-2"><Check size={15} className="text-bakery-caramel" /> Live in a day</span>
                <span className="inline-flex items-center gap-2"><Check size={15} className="text-bakery-caramel" /> Works on any tablet</span>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={reduced ? undefined : { opacity: 0, y: 44, scale: 0.97 }}
            animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.85, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto mt-16 w-full max-w-6xl"
          >
            <Shot isDark={isDark} src="/screenshots/overview.jpg" alt="PreVisio business overview" label="Overview · revenue at a glance" priority />
            <motion.div
              initial={reduced ? undefined : { opacity: 0, y: 30 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="absolute -bottom-20 -right-8 hidden w-[36%] lg:block xl:-right-20"
            >
              <Shot isDark={isDark} src="/screenshots/orders.jpg" alt="Kitchen board" label="Kitchen board" />
            </motion.div>
          </motion.div>
        </section>

        <div className="mt-24">
          <FoodMarquee isDark={isDark} />
        </div>

        {/* 2. STATS — full-width caramel gradient ribbon */}
        <section className="relative overflow-hidden px-6 py-16">
          <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-r from-bakery-caramel/20 via-transparent to-bakery-caramel/10' : 'bg-gradient-to-r from-bakery-caramel/25 via-white/40 to-bakery-beige/50'}`} />
          <div className="relative mx-auto grid w-full max-w-7xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.07}>
                <div className="text-center">
                  <p className="font-serif text-5xl font-black text-bakery-caramel">{stat.value}</p>
                  <p className={`mt-2 text-xs font-bold uppercase tracking-[0.2em] ${muted}`}>{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 3. PRODUCT — vertical left rail + sticky screenshot */}
        <section id="product" className="px-6 py-24">
          <div className="mx-auto w-full max-w-7xl">
            <Reveal className="mb-12 max-w-2xl">
              <h2 className={`font-serif text-4xl font-black md:text-5xl ${heading}`}>Everything the floor needs</h2>
              <p className={`mt-4 text-lg ${body}`}>Five connected workspaces. Click through the real screens.</p>
            </Reveal>

            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <Reveal className="space-y-2">
                {workspaces.map((workspace, i) => {
                  const Icon = workspace.icon;
                  const isActive = activeTab === i;
                  return (
                    <button
                      key={workspace.title}
                      type="button"
                      onClick={() => setActiveTab(i)}
                      onMouseEnter={() => setActiveTab(i)}
                      className={`flex w-full gap-4 border-l-2 px-5 py-4 text-left transition-all ${
                        isActive
                          ? 'border-bakery-caramel bg-bakery-caramel/10'
                          : `border-transparent ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-black/[0.03]'}`
                      }`}
                    >
                      <Icon size={18} className={isActive ? 'text-bakery-caramel' : muted} />
                      <span>
                        <span className={`block font-serif text-xl font-bold ${isActive ? heading : muted}`}>{workspace.title}</span>
                        <span className={`mt-1 block text-sm ${body}`}>{workspace.description}</span>
                      </span>
                    </button>
                  );
                })}
              </Reveal>

              <motion.div
                key={active.title}
                initial={reduced ? undefined : { opacity: 0, y: 16 }}
                animate={reduced ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="lg:sticky lg:top-28"
              >
                <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-bakery-caramel">{active.tagline}</p>
                <Shot isDark={isDark} src={active.shot} alt={active.title} label={active.label} />
              </motion.div>
            </div>
          </div>
        </section>

        {/* 4. TOUR — each block a different composition */}
        <section id="tour" className="px-6 py-24">
          <div className="mx-auto w-full max-w-7xl space-y-28">
            <Reveal className="max-w-2xl">
              <h2 className={`font-serif text-4xl font-black md:text-5xl ${heading}`}>A closer look</h2>
              <p className={`mt-4 text-lg ${body}`}>Real screens from a working bakery — each section laid out differently on purpose.</p>
            </Reveal>

            {showcases.map((item, i) => {
              if (item.tone === 'plain') {
                return (
                  <Reveal key={item.title}>
                    <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-bakery-caramel">{item.eyebrow}</p>
                        <h3 className={`mt-3 font-serif text-3xl font-bold ${heading}`}>{item.title}</h3>
                        <p className={`mt-4 text-lg leading-relaxed ${body}`}>{item.description}</p>
                        <ul className="mt-6 space-y-3">
                          {item.points.map((point) => (
                            <li key={point} className="flex items-center gap-3 font-semibold">
                              <Check size={16} className="text-bakery-caramel" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Shot isDark={isDark} src={item.shot} alt={item.title} label={item.label} />
                    </div>
                  </Reveal>
                );
              }

              if (item.tone === 'panel') {
                return (
                  <Reveal key={item.title}>
                    <div className={`${glassCard} overflow-hidden p-0`}>
                      <div className="grid lg:grid-cols-2">
                        <Shot isDark={isDark} src={item.shot} alt={item.title} framed={false} />
                        <div className="flex flex-col justify-center p-8 md:p-12">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-bakery-caramel">{item.eyebrow}</p>
                          <h3 className={`mt-3 font-serif text-3xl font-bold ${heading}`}>{item.title}</h3>
                          <p className={`mt-4 leading-relaxed ${body}`}>{item.description}</p>
                          <div className="mt-6 flex flex-wrap gap-2">
                            {item.points.map((point) => (
                              <span key={point} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${isDark ? 'bg-white/10' : 'bg-black/[0.06]'}`}>
                                {point}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              }

              if (item.tone === 'bleed') {
                return (
                  <Reveal key={item.title}>
                    <div className={`relative overflow-hidden rounded-[2rem] ${isDark ? 'bg-[#151820]' : 'bg-[#efe8dc]'}`}>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(212,163,115,0.25),transparent_50%)]" />
                      <div className="relative grid items-end gap-8 p-6 md:p-10 lg:grid-cols-[1fr_1.2fr]">
                        <div className="pb-4">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-bakery-caramel">{item.eyebrow}</p>
                          <h3 className={`mt-3 font-serif text-4xl font-bold ${heading}`}>{item.title}</h3>
                          <p className={`mt-4 max-w-md leading-relaxed ${body}`}>{item.description}</p>
                          <ul className="mt-6 space-y-2">
                            {item.points.map((point) => (
                              <li key={point} className={`text-sm font-bold ${muted}`}>— {point}</li>
                            ))}
                          </ul>
                        </div>
                        <Shot isDark={isDark} src={item.shot} alt={item.title} label={item.label} className="rotate-[-1.5deg] scale-[1.02]" />
                      </div>
                    </div>
                  </Reveal>
                );
              }

              return (
                <Reveal key={item.title}>
                  <div className={`grid gap-6 lg:grid-cols-[1.1fr_0.9fr] ${i % 2 ? '' : ''}`}>
                    <Shot isDark={isDark} src={item.shot} alt={item.title} label={item.label} />
                    <div className={`${glassCard} flex flex-col justify-between p-8`}>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-bakery-caramel">{item.eyebrow}</p>
                        <h3 className={`mt-3 font-serif text-3xl font-bold ${heading}`}>{item.title}</h3>
                        <p className={`mt-4 leading-relaxed ${body}`}>{item.description}</p>
                      </div>
                      <ol className="mt-8 space-y-4">
                        {item.points.map((point, idx) => (
                          <li key={point} className="flex items-start gap-4">
                            <span className="font-serif text-2xl font-black text-bakery-caramel/70">0{idx + 1}</span>
                            <span className="pt-1 font-semibold">{point}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* 5. STEPS — horizontal timeline, not cards */}
        <section className={`px-6 py-24 ${isDark ? 'bg-white/[0.02]' : 'bg-black/[0.02]'}`}>
          <div className="mx-auto w-full max-w-7xl">
            <Reveal className="mb-16 text-center">
              <h2 className={`font-serif text-4xl font-black md:text-5xl ${heading}`}>Live in three steps</h2>
              <p className={`mt-4 text-lg ${body}`}>No consultants, no migration project.</p>
            </Reveal>
            <div className="relative grid gap-10 md:grid-cols-3">
              <div className={`absolute left-[16%] right-[16%] top-8 hidden h-px md:block ${isDark ? 'bg-white/15' : 'bg-black/15'}`} />
              {steps.map((item, i) => {
                const Icon = item.icon;
                return (
                  <Reveal key={item.step} delay={i * 0.1} className="relative text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-bakery-caramel bg-[#0b0d12] text-bakery-caramel shadow-[0_0_30px_rgba(212,163,115,0.25)]">
                      <Icon size={22} />
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-bakery-caramel">{item.step}</p>
                    <h3 className={`mt-3 font-serif text-2xl font-bold ${heading}`}>{item.title}</h3>
                    <p className={`mt-3 leading-relaxed ${body}`}>{item.description}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* 6. FEATURES — asymmetric bento */}
        <section id="features" className="px-6 py-24">
          <div className="mx-auto w-full max-w-7xl">
            <Reveal className="mb-12 max-w-xl">
              <h2 className={`font-serif text-4xl font-black md:text-5xl ${heading}`}>The details that save hours</h2>
            </Reveal>
            <div className="grid gap-4 md:grid-cols-6">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <Reveal key={feature.title} delay={(i % 3) * 0.06} className={feature.wide ? 'md:col-span-3' : 'md:col-span-2'}>
                    <div className={`${glassCard} h-full p-7 transition-all duration-300 hover:-translate-y-1 ${feature.wide ? 'md:flex md:items-center md:gap-6' : ''}`}>
                      <span className="mb-5 inline-flex shrink-0 rounded-2xl bg-bakery-caramel/20 p-3 text-[#c6925f] md:mb-0">
                        <Icon size={22} />
                      </span>
                      <div className={feature.wide ? '' : 'mt-5'}>
                        <h3 className={`font-serif text-xl font-bold ${heading}`}>{feature.title}</h3>
                        <p className={`mt-2 leading-relaxed ${body}`}>{feature.description}</p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
            <Reveal delay={0.1}>
              <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
                <Globe size={18} className="text-[#c6925f]" />
                <span className="font-bold">Trading in</span>
                {['Belgium', 'UK', 'US', 'and beyond'].map((place) => (
                  <span key={place} className="rounded-full border border-bakery-caramel/40 px-3.5 py-1.5 font-semibold text-bakery-caramel">
                    {place}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* 7. PRICING — stacked on mobile, magazine on desktop */}
        <section id="pricing" className="px-6 py-24">
          <div className="mx-auto w-full max-w-7xl">
            <Reveal className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className={`font-serif text-4xl font-black md:text-5xl ${heading}`}>Simple pricing</h2>
                <p className={`mt-4 max-w-md text-lg ${body}`}>Start free, upgrade when the queue gets longer.</p>
              </div>
              <p className={`text-sm font-bold ${muted}`}>No contracts · Cancel anytime</p>
            </Reveal>
            <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
              {plans.map((plan, i) => (
                <Reveal key={plan.name} delay={i * 0.08}>
                  <article
                    className={`flex h-full flex-col p-8 transition-all duration-300 hover:-translate-y-1 ${
                      plan.highlighted
                        ? 'rounded-[2rem] bg-bakery-caramel text-[#2a241f] shadow-[0_20px_50px_rgba(212,163,115,0.35)] lg:-translate-y-3'
                        : `${glassCard}`
                    }`}
                  >
                    {plan.highlighted && (
                      <p className="mb-4 text-[11px] font-black uppercase tracking-widest opacity-70">Most popular</p>
                    )}
                    <h3 className="font-serif text-2xl font-bold">{plan.name}</h3>
                    <p className="mt-2 font-serif text-5xl font-black">{plan.price}</p>
                    <p className={`mt-3 ${plan.highlighted ? 'text-[#061222]/70' : body}`}>{plan.description}</p>
                    <ul className="mt-6 flex-1 space-y-3 text-sm">
                      {plan.features.map((item) => (
                        <li key={item} className="flex items-center gap-2 font-semibold">
                          <Check size={16} className={plan.highlighted ? 'text-[#6f4f2f]' : 'text-[#c6925f]'} />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={onRegister}
                      className={`mt-7 w-full rounded-xl px-4 py-3.5 text-sm font-bold transition ${
                        plan.highlighted
                          ? 'bg-[#2a1c14] text-[#f4efe6] hover:bg-[#3d281c]'
                          : isDark
                            ? 'border border-white/25 bg-white/10 hover:bg-white/20'
                            : 'border border-black/15 bg-white hover:bg-[#f3eee7]'
                      }`}
                    >
                      {plan.name === 'Enterprise' ? 'Contact sales' : 'Start now'}
                    </button>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 8. STORIES — oversized quote typography */}
        <section className="px-6 py-24">
          <div className="mx-auto w-full max-w-5xl">
            <Reveal className="mb-14 text-center">
              <h2 className={`font-serif text-4xl font-black md:text-5xl ${heading}`}>Loved on busy mornings</h2>
            </Reveal>
            <div className="space-y-16">
              {testimonials.map((item, i) => (
                <Reveal key={item.author} delay={i * 0.08}>
                  <blockquote className={`${i % 2 === 1 ? 'md:ml-auto md:text-right' : ''} max-w-3xl`}>
                    <Quote size={28} className={`mb-5 text-bakery-caramel ${i % 2 === 1 ? 'md:ml-auto' : ''}`} />
                    <p className={`font-serif text-2xl font-bold leading-snug md:text-3xl ${heading}`}>“{item.quote}”</p>
                    <footer className={`mt-5 text-sm font-bold ${muted}`}>
                      {item.author} · {item.role}
                    </footer>
                  </blockquote>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 9. FAQ — compact accordion strip */}
        <section className={`px-6 py-24 ${isDark ? 'border-y border-white/10' : 'border-y border-black/10'}`}>
          <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[0.7fr_1.3fr]">
            <Reveal>
              <h2 className={`font-serif text-4xl font-black md:text-5xl ${heading}`}>Questions, answered</h2>
              <p className={`mt-4 ${body}`}>Still unsure? Jump to contact — we usually reply the same day.</p>
            </Reveal>
            <div className="space-y-3">
              {faqItems.map((item, i) => (
                <Reveal key={item.question} delay={i * 0.05}>
                  <details className={`group border-b py-4 ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                      {item.question}
                      <ChevronDown size={18} className={`shrink-0 transition-transform group-open:rotate-180 ${muted}`} />
                    </summary>
                    <p className={`mt-3 leading-relaxed ${body}`}>{item.answer}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* 10. CTA — solid caramel band */}
        <section className="px-6 py-20">
          <Reveal className="mx-auto w-full max-w-7xl">
            <div className="relative overflow-hidden rounded-[2rem] bg-bakery-caramel px-8 py-14 text-center text-[#2a241f] md:px-16">
              <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
              <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-[#2a1c14]/15 blur-3xl" />
              <h2 className="relative font-serif text-4xl font-black md:text-5xl">Open tomorrow with PreVisio</h2>
              <p className="relative mx-auto mt-4 max-w-xl text-lg opacity-80">
                Scan your menu tonight and take your first order in the morning.
              </p>
              <motion.button
                type="button"
                onClick={onRegister}
                whileHover={reduced ? undefined : { scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="relative mt-8 inline-flex items-center gap-2 rounded-2xl bg-[#2a1c14] px-10 py-4 text-lg font-bold text-[#f4efe6]"
              >
                Get started free
                <ArrowRight size={20} />
              </motion.button>
            </div>
          </Reveal>
        </section>

        {/* 11. CONTACT — split pane */}
        <section id="contact" className="px-6 pb-24">
          <Reveal className="mx-auto w-full max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 lg:grid lg:grid-cols-2">
            <div className={`p-8 md:p-12 ${isDark ? 'bg-white/[0.03]' : 'bg-white/80'}`}>
              <h2 className={`mb-3 font-serif text-4xl font-black ${heading}`}>Talk to us</h2>
              <p className={`mb-8 ${body}`}>Choosing a plan or moving from another till? We help you get live.</p>
              <div className="space-y-4 text-sm font-semibold">
                <p className="inline-flex items-center gap-3"><Mail size={16} className="text-[#c6925f]" /> hello@previsio.app</p>
                <p className="inline-flex items-center gap-3"><Phone size={16} className="text-[#c6925f]" /> +32 2 123 45 67</p>
                <p className="inline-flex items-center gap-3"><MessageCircle size={16} className="text-[#c6925f]" /> Live chat · Mon–Sat, 08:00–22:00</p>
              </div>
            </div>
            <form className={`grid gap-3 p-8 md:p-12 ${isDark ? 'bg-[#151820]' : 'bg-[#efe8dc]'}`} onSubmit={(e) => e.preventDefault()}>
              <input className={`w-full rounded-xl px-4 py-3 outline-none transition focus:ring-2 focus:ring-bakery-caramel/40 ${isDark ? 'border border-white/15 bg-white/[0.04]' : 'border border-black/10 bg-white'}`} placeholder="Your name" />
              <input type="email" className={`w-full rounded-xl px-4 py-3 outline-none transition focus:ring-2 focus:ring-bakery-caramel/40 ${isDark ? 'border border-white/15 bg-white/[0.04]' : 'border border-black/10 bg-white'}`} placeholder="Work email" />
              <textarea className={`min-h-[120px] w-full rounded-xl px-4 py-3 outline-none transition focus:ring-2 focus:ring-bakery-caramel/40 ${isDark ? 'border border-white/15 bg-white/[0.04]' : 'border border-black/10 bg-white'}`} placeholder="Tell us about your business" />
              <button type="button" onClick={onRegister} className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-bakery-caramel px-6 py-3 font-bold text-[#2a241f] transition-colors hover:bg-[#c6925f]">
                Talk to sales
                <ArrowRight size={16} />
              </button>
            </form>
          </Reveal>
        </section>
      </main>
    </div>
  );
};
