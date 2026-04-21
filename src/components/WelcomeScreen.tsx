
import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  Building2,
  ChevronDown,
  Check,
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
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';

type WelcomeScreenProps = {
  onLogin: () => void;
  onRegister: () => void;
};

type CommandCard = {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const commandCenterCards: CommandCard[] = [
  {
    title: 'The Cashier & Orders',
    description:
      'Lightning-fast POS. Take orders in seconds and sync them instantly to a digital kitchen board. No more shouting over the grill.',
    icon: ReceiptText,
  },
  {
    title: 'Stock & Products',
    description:
      'Ingredient-level tracking. When you sell a waffle, we deduct the flour, sugar, and toppings automatically. Know exactly what to buy for tomorrow.',
    icon: Package,
  },
  {
    title: 'Sales & Finance',
    description:
      'Your Global Tax Assistant. Automated sales reports and tax logic built for Belgium, the UK, the US, and beyond. See your gross profit in real-time.',
    icon: WalletCards,
  },
  {
    title: 'Staff & Overview',
    description:
      'Manage your fleet. Track shifts, performance, and daily best-sellers from a high-level dashboard designed for busy owners.',
    icon: Users,
  },
];

const features = [
  {
    title: 'AI Menu Scan',
    subtitle: 'The Magic onboarding tool',
    description:
      'Upload your menu and let AI instantly create products, categories, and structure so your team can start selling in minutes.',
    icon: BrainCircuit,
  },
  {
    title: 'Global Payments',
    subtitle: 'Tap-to-Pay + Stripe',
    description:
      'Accept in-person Tap-to-Pay and integrated Stripe payments in one flow built for modern food businesses.',
    icon: CreditCard,
  },
  {
    title: 'Multi-lingual by default',
    subtitle: 'EN, FR, NL, and Flemish',
    description:
      'Serve local teams and global operations with interfaces and onboarding content in your preferred language.',
    icon: Languages,
  },
];

const plans = [
  {
    name: 'Free',
    price: '$0/mo',
    description: 'Perfect for trying PreVisio.',
    features: ['50 orders/mo', 'Basic Inventory', '1 Language'],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$39/mo',
    description: 'Built for fast-growing teams.',
    features: [
      'Everything in the sidebar',
      'Unlimited orders',
      'AI Menu Scan',
      'Ingredient Tracking',
      'Tap-to-Pay',
      'Finance/Tax Suite',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For multi-location operators.',
    features: ['Fleet management', 'Multi-location analytics', '24/7 priority support'],
    highlighted: false,
  },
];

const testimonials = [
  {
    quote:
      'We cut order mistakes by almost half in two weeks. The kitchen sync is insanely fast.',
    author: 'Nora A.',
    role: 'Owner, Brussels Waffle Bar',
  },
  {
    quote:
      'The finance tab finally gives me confidence at tax time. It feels like having an assistant.',
    author: 'James V.',
    role: 'Co-founder, Street Bite London',
  },
  {
    quote:
      'Our team adopted it in one day. The UI is clear, and the AI menu import saved us hours.',
    author: 'Lina K.',
    role: 'Manager, Antwerp Crepes',
  },
];

const faqItems = [
  {
    question: 'Can I start on the free plan and upgrade later?',
    answer: 'Yes. You can upgrade any time without losing products, sales history, or team data.',
  },
  {
    question: 'Does PreVisio support multiple languages in one team?',
    answer: 'Yes. EN, FR, NL, and Flemish are built in so different staff can work comfortably.',
  },
  {
    question: 'How does onboarding work for existing menus?',
    answer: 'Use AI Menu Scan to import your menu quickly, then edit and fine-tune in Products.',
  },
];

const FoodMarquee = () => {
  const emojis = [
    '🧇',
    '🥞',
    '🥐',
    '🥯',
    '🥖',
    '🥨',
    '🧀',
    '🍔',
    '🍟',
    '🍕',
    '🌭',
    '🥪',
    '🌮',
    '🌯',
    '🥗',
    '🥘',
    '🍝',
    '🍜',
    '🍲',
    '🍛',
    '🍣',
    '🍱',
    '🥟',
    '🍤',
    '🍙',
    '🍚',
    '🍘',
    '🍥',
    '🍢',
    '🍡',
    '🍧',
    '🍨',
    '🍦',
    '🥧',
    '🧁',
    '🍰',
    '🎂',
    '🍮',
    '🍭',
    '🍬',
    '🍫',
    '🍿',
    '🍩',
    '🍪',
    '🌰',
    '🥜',
    '🍯',
    '🥛',
    '☕',
    '🍵',
    '🥤',
    '🍶',
    '🍺',
    '🍻',
    '🥂',
    '🍷',
    '🥃',
    '🍸',
    '🍹',
    '🧉',
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

const bakeryCard =
  'rounded-[2rem] border border-bakery-brown/10 bg-white/75 backdrop-blur-md shadow-2xl shadow-bakery-brown/5';

export const WelcomeScreen = ({ onLogin, onRegister }: WelcomeScreenProps) => {
  const [activeCommand, setActiveCommand] = useState(commandCenterCards[0].title);

  const activeCard = useMemo(
    () => commandCenterCards.find((card) => card.title === activeCommand) ?? commandCenterCards[0],
    [activeCommand]
  );

  return (
    <div className="min-h-screen bg-bakery-cream text-bakery-brown selection:bg-bakery-brown selection:text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 -left-12 h-72 w-72 rounded-full bg-bakery-accent/20 blur-3xl" />
        <div className="absolute right-[-10%] top-36 h-96 w-96 rounded-full bg-bakery-caramel/20 blur-3xl" />
        <div className="absolute bottom-[-4rem] left-1/3 h-96 w-96 rounded-full bg-bakery-beige/50 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-bakery-brown/10 bg-bakery-cream/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-bakery-brown rounded-xl flex items-center justify-center text-white shadow-lg shadow-bakery-brown/20">
              <Layout size={20} />
            </div>
            <span className="text-2xl font-black font-serif tracking-tight">PreVisio</span>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-bold text-bakery-brown/70 md:flex">
            <a href="#command-center" className="transition hover:text-bakery-brown hover:-translate-y-0.5">
              Command Center
            </a>
            <a href="#features" className="transition hover:text-bakery-brown hover:-translate-y-0.5">
              Features
            </a>
            <a href="#pricing" className="transition hover:text-bakery-brown hover:-translate-y-0.5">
              Pricing
            </a>
            <a href="#contact" className="transition hover:text-bakery-brown hover:-translate-y-0.5">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="hidden sm:block text-bakery-brown font-bold hover:text-bakery-brown/70 transition-colors"
            >
              Login
            </button>
            <button
              onClick={onRegister}
              className="px-6 py-2.5 bg-bakery-brown text-white rounded-full font-bold hover:bg-bakery-brown/90 transition-all active:scale-95 shadow-lg shadow-bakery-brown/10"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative pt-20 pb-28 px-6 overflow-hidden bg-gradient-to-b from-bakery-cream via-bakery-beige/40 to-bakery-cream">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-16 lg:grid-cols-2">
            <div className="space-y-7 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-bakery-brown text-xs font-bold uppercase tracking-widest border border-bakery-brown/10 shadow-sm">
                <Sparkles size={14} className="text-bakery-accent" />
                Built for modern operators
              </div>

              <div>
                <h1 className="text-5xl md:text-7xl font-black font-serif tracking-tight leading-[0.95] mb-6">
                  Run Smarter. Grow Faster.
                </h1>
                <p className="max-w-xl text-xl text-bakery-brown/65 leading-relaxed">
                  One platform for orders, stock, team, and finance.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onRegister}
                  className="px-10 py-5 bg-bakery-brown text-white rounded-2xl font-bold text-xl shadow-2xl shadow-bakery-brown/20 hover:bg-bakery-brown/90 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Get Started Free
                  <ArrowRight size={20} />
                </button>
                <button
                  onClick={onLogin}
                  className="px-10 py-5 bg-white border-2 border-bakery-brown/10 text-bakery-brown rounded-2xl font-bold text-xl hover:bg-bakery-beige/30 transition-all active:scale-95"
                >
                  Login
                </button>
              </div>
            </div>

            <div className="hidden lg:block animate-fade-in delay-150">
              <div className={`${bakeryCard} relative overflow-hidden p-8 min-h-[430px] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-bakery-brown/10`}>
                <div className="absolute -top-16 -right-12 w-56 h-56 bg-bakery-accent/30 rounded-full blur-3xl" />
                <div className="absolute -bottom-16 -left-10 w-52 h-52 bg-bakery-caramel/25 rounded-full blur-3xl" />
                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black font-serif">PreVisio</h2>
                    <div className="rounded-2xl bg-white/75 p-3 border border-bakery-brown/10">
                      <Building2 size={20} className="text-bakery-brown" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/70 bg-white/70 p-4 backdrop-blur-md shadow-md">
                      <p className="text-xs uppercase font-black tracking-widest text-bakery-brown/40 mb-2">Live Snapshot</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl bg-bakery-cream p-3">
                          <p className="text-[10px] uppercase text-bakery-brown/40 font-bold">Orders</p>
                          <p className="font-black text-xl">24</p>
                        </div>
                        <div className="rounded-xl bg-bakery-cream p-3">
                          <p className="text-[10px] uppercase text-bakery-brown/40 font-bold">Stock</p>
                          <p className="font-black text-xl">98%</p>
                        </div>
                        <div className="rounded-xl bg-bakery-cream p-3">
                          <p className="text-[10px] uppercase text-bakery-brown/40 font-bold">Today</p>
                          <p className="font-black text-xl">€1.2k</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {commandCenterCards.slice(0, 4).map((card) => {
                        const Icon = card.icon;
                        return (
                          <div key={card.title} className="rounded-2xl bg-white/80 border border-bakery-brown/10 p-3">
                            <div className="inline-flex rounded-lg bg-bakery-accent/25 p-2 mb-2">
                              <Icon size={14} />
                            </div>
                            <p className="text-xs font-bold">{card.title}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/4 w-[700px] h-[700px] bg-bakery-accent/10 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[520px] h-[520px] bg-bakery-caramel/10 rounded-full blur-3xl -z-10" />
        </section>

        <FoodMarquee />

        <section id="command-center" className="px-6 py-24 bg-bakery-cream/70">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mb-10 text-center">
              <h2 className="text-4xl md:text-5xl font-black font-serif">
                Every sidebar tab built for owner-level clarity
              </h2>
            </div>
            <div className={`${bakeryCard} mb-7 p-6 transition-all duration-300`}>
              <p className="text-xs uppercase tracking-[0.2em] font-bold text-bakery-brown/45 mb-2">
                Focus Mode
              </p>
              <h3 className="text-2xl font-black font-serif mb-2">{activeCard.title}</h3>
              <p className="text-bakery-brown/70 leading-relaxed">{activeCard.description}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {commandCenterCards.map((card) => {
                const Icon = card.icon;
                const isActive = activeCommand === card.title;
                return (
                  <article
                    key={card.title}
                    onMouseEnter={() => setActiveCommand(card.title)}
                    className={`${bakeryCard} p-7 transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'ring-2 ring-bakery-accent/70 -translate-y-1'
                        : 'hover:-translate-y-1 hover:shadow-2xl hover:shadow-bakery-brown/10'
                    }`}
                  >
                    <div className="mb-5 inline-flex rounded-2xl bg-bakery-accent/25 p-3">
                      <Icon size={20} />
                    </div>
                    <h3 className="mb-3 text-2xl font-bold font-serif">{card.title}</h3>
                    <p className="leading-relaxed text-bakery-brown/70">{card.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="features" className="px-6 py-24 bg-bakery-beige/35">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mb-10 text-center">
              <h2 className="text-4xl md:text-5xl font-black font-serif">Feature highlights</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className={`${bakeryCard} p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-bakery-brown/10`}>
                    <div className="mb-5 inline-flex rounded-2xl bg-bakery-beige p-3">
                      <Icon size={20} />
                    </div>
                    <h3 className="text-xl font-bold font-serif">{feature.title}</h3>
                    <p className="mt-1 font-semibold text-bakery-caramel">{feature.subtitle}</p>
                    <p className="mt-4 text-bakery-brown/70">{feature.description}</p>
                  </article>
                );
              })}
            </div>
            <div className={`${bakeryCard} mt-8 flex flex-wrap items-center gap-4 p-5 text-sm`}>
              <Globe size={18} className="text-bakery-accent" />
              <span className="font-medium">Global-ready operations in:</span>
              <span className="rounded-full bg-bakery-cream px-3 py-1">Belgium</span>
              <span className="rounded-full bg-bakery-cream px-3 py-1">UK</span>
              <span className="rounded-full bg-bakery-cream px-3 py-1">US</span>
              <span className="rounded-full bg-bakery-cream px-3 py-1">and beyond</span>
            </div>
          </div>
        </section>

        <section id="pricing" className="px-6 py-24 bg-bakery-brown text-bakery-cream">
          <div className="mx-auto w-full max-w-7xl">
            <div className="mb-10 text-center">
              <h2 className="text-4xl md:text-5xl font-black font-serif">Simple global pricing</h2>
              <p className="mt-3 text-bakery-cream/70">
                Start free, scale fast, and unlock full control as you grow.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`rounded-[2rem] border p-7 backdrop-blur-sm ${
                    plan.highlighted
                      ? 'border-bakery-accent bg-white text-bakery-brown shadow-2xl shadow-black/20 scale-[1.02]'
                      : 'border-white/15 bg-white/10 text-bakery-cream'
                  } transition-all duration-300 hover:-translate-y-1`}
                >
                  {plan.highlighted && (
                    <p className="mb-4 inline-flex items-center rounded-full bg-bakery-accent/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                      Most Popular
                    </p>
                  )}
                  <h3 className="text-2xl font-bold font-serif">{plan.name}</h3>
                  <p className="mt-2 text-3xl font-bold">{plan.price}</p>
                  <p className={`mt-3 ${plan.highlighted ? 'text-bakery-brown/65' : 'text-bakery-cream/75'}`}>{plan.description}</p>
                  <ul className="mt-5 space-y-3 text-sm">
                    {plan.features.map((item) => (
                      <li key={item} className={`flex items-center gap-2 ${plan.highlighted ? 'text-bakery-brown/85' : 'text-bakery-cream/85'}`}>
                        <Check size={16} className={plan.highlighted ? 'text-bakery-brown' : 'text-bakery-accent'} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={onRegister}
                    className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      plan.highlighted
                        ? 'bg-bakery-brown text-white shadow-lg shadow-bakery-brown/20 hover:bg-bakery-brown/90'
                        : 'border border-white/40 bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    {plan.name === 'Enterprise' ? 'Contact Sales' : 'Start Now'}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="stories" className="px-6 py-24 bg-bakery-cream">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-black font-serif">Customer Stories</h2>
              <p className="mt-3 text-bakery-brown/65">
                Trusted by food businesses that care about speed, clarity, and growth.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {testimonials.map((item) => (
                <article key={item.author} className={`${bakeryCard} p-7 transition-all duration-300 hover:-translate-y-1`}>
                  <Quote size={20} className="text-bakery-caramel mb-4" />
                  <p className="text-bakery-brown/75 leading-relaxed mb-5">"{item.quote}"</p>
                  <p className="font-bold">{item.author}</p>
                  <p className="text-sm text-bakery-brown/60">{item.role}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="px-6 py-24">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-black font-serif">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-4">
              {faqItems.map((item) => (
                <details key={item.question} className={`${bakeryCard} p-6 group`}>
                  <summary className="list-none cursor-pointer flex items-center justify-between font-bold text-lg">
                    {item.question}
                    <ChevronDown size={18} className="text-bakery-brown/55 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-bakery-brown/70 leading-relaxed">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="px-6 pb-24">
          <div className="max-w-7xl mx-auto">
            <div className={`${bakeryCard} p-8 md:p-10`}>
              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <h2 className="text-4xl font-black font-serif mb-3">Contact Us</h2>
                  <p className="text-bakery-brown/70 mb-6">
                    Need help choosing a plan or setting up your operation? Our team is ready.
                  </p>
                  <div className="space-y-3 text-sm">
                    <p className="inline-flex items-center gap-2"><Mail size={16} className="text-bakery-caramel" /> hello@previsio.app</p>
                    <p className="inline-flex items-center gap-2"><Phone size={16} className="text-bakery-caramel" /> +32 2 123 45 67</p>
                    <p className="inline-flex items-center gap-2"><MessageCircle size={16} className="text-bakery-caramel" /> Live chat: Mon-Sat, 08:00-22:00</p>
                  </div>
                </div>
                <form className="grid gap-3">
                  <input className="w-full rounded-xl border border-bakery-beige bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-bakery-caramel/40" placeholder="Your name" />
                  <input type="email" className="w-full rounded-xl border border-bakery-beige bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-bakery-caramel/40" placeholder="Work email" />
                  <textarea className="w-full min-h-[120px] rounded-xl border border-bakery-beige bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-bakery-caramel/40" placeholder="Tell us about your business" />
                  <button type="button" onClick={onRegister} className="mt-1 px-6 py-3 bg-bakery-brown text-white rounded-xl font-bold hover:bg-bakery-brown/90 transition-all inline-flex items-center justify-center gap-2">
                    Talk to Sales
                    <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};
