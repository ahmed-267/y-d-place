import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import {
  Layout,
  Plus,
  Trash2,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
  Boxes,
  ClipboardList,
  BarChart3,
  Users,
  Wallet,
} from 'lucide-react';
import { IngredientLink, Product, PreparedStockLink, normalizeEnabledModules, EnabledModules, Language } from '../types';
import { getAIAssistance, scanMenu, ScanMenuResult, compressImage } from '../utils/aiHelper';
import { CitySelect } from './CitySelect';
import { Modal } from './Modal';
import { ScanProgressModal } from './ScanProgressModal';
import { APP_LANGUAGE_OPTIONS } from '../utils/languages';
import { requestProductTour } from '../utils/productTour';

const ONBOARDING_STEP_KEY = 'previsio_onboarding_step';

export const OnboardingWizard = () => {
  const {
    businessSettings,
    user,
    provisionBusinessProfile,
    categories = [],
    setCategories,
    products = [],
    setProducts,
    ingredients = [],
    setIngredients,
    preparedStock = [],
    setPreparedStock,
    completeOnboarding,
    saveBusinessSettings,
    t,
    lang,
    setLang,
    tp,
    tc,
    formatPrice,
    addToast,
    setActiveTab,
  } = useApp();

  const venueLabel = (v: string) => {
    const keyMap: Record<string, string> = {
      Restaurant: 'venueRestaurant',
      'Food Truck': 'venueFoodTruck',
      Café: 'venueCafe',
      Bar: 'venueBar',
      Bakery: 'venueBakery',
      'Fast Food': 'venueFastFood',
      Other: 'venueOther',
    };
    return t(keyMap[v] || v);
  };

  const totalSteps = 4;
  const [step, setStep] = useState(() => {
    try {
      const stored = sessionStorage.getItem(ONBOARDING_STEP_KEY);
      const n = stored ? parseInt(stored, 10) : NaN;
      if (n >= 1 && n <= 4) return n;
    } catch {
      /* ignore */
    }
    return businessSettings?.id && businessSettings?.city ? 2 : 1;
  });

  const [modules, setModules] = useState(() =>
    normalizeEnabledModules(businessSettings?.enabledModules)
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(ONBOARDING_STEP_KEY, String(step));
    } catch {
      /* ignore */
    }
  }, [step]);

  const [isProvisioning, setIsProvisioning] = useState(false);
  const [businessConfig, setBusinessConfig] = useState({
    name: businessSettings?.name || '',
    venueType: businessSettings?.venueType || 'Restaurant',
    country: businessSettings?.country || 'GB',
    city: businessSettings?.city || '',
    currencyCode: businessSettings?.currencyCode || 'GBP',
    currencySymbol: businessSettings?.currencySymbol || '£',
    language: (businessSettings?.language || lang || 'en') as Language,
  });

  // Keep local business language in sync with the header switcher (and vice versa).
  useEffect(() => {
    setBusinessConfig(prev => (prev.language === lang ? prev : { ...prev, language: lang as Language }));
  }, [lang]);

  const currencyOptions = [
    { code: 'EUR', symbol: '€', label: 'EUR (€)' },
    { code: 'USD', symbol: '$', label: 'USD ($)' },
    { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  ];
  const countryOptions = [
    { code: 'GB', label: 'United Kingdom' },
    { code: 'FR', label: 'France' },
    { code: 'DE', label: 'Germany' },
    { code: 'BE', label: 'Belgium' },
    { code: 'ES', label: 'Spain' },
  ];
  const venueOptions = ['Restaurant', 'Café', 'Bar', 'Food Truck'];
  const languageOptions = APP_LANGUAGE_OPTIONS.map(o => ({
    value: o.code,
    label: `${o.flag} ${t(o.labelKey) || o.nativeLabel}`,
  }));

  const [newCategory, setNewCategory] = useState('');
  const addCategory = () => {
    if (newCategory && !categories.includes(newCategory)) {
      setCategories([...categories, newCategory]);
      setNewCategory('');
    }
  };

  const [productForm, setProductForm] = useState({
    name: '',
    category: categories[0] || 'General',
    price: '',
    emoji: '📦',
    translations: {} as Record<string, string>,
    ingredientNames: [] as string[],
    preppedNames: [] as string[],
  });
  const [isAIProcessing, setIsAIProcessing] = useState(false);

  const addProduct = () => {
    if (productForm.name && productForm.price) {
      const currentIngredients = [...ingredients];
      const currentPrepared = [...preparedStock];

      const ingredientLinks: IngredientLink[] = productForm.ingredientNames
        .map(name => name.trim())
        .filter(Boolean)
        .map(name => {
          let ing = currentIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
          if (!ing) {
            ing = {
              id: Date.now() + Math.random(),
              name,
              unit: 'g',
              qty: 20,
              lowThreshold: 2,
            };
            currentIngredients.push(ing);
          }
          return { ingredientId: ing.id, quantityUsed: 1, unit: ing.unit };
        });

      const preppedLinks: PreparedStockLink[] = productForm.preppedNames
        .map(name => name.trim())
        .filter(Boolean)
        .map(name => {
          let ps = currentPrepared.find(p => p.name.toLowerCase() === name.toLowerCase());
          if (!ps) {
            ps = {
              id: Date.now() + Math.random(),
              name,
              portions: 20,
              lowThreshold: 5,
            };
            currentPrepared.push(ps);
          }
          return { preparedStockId: ps.id, portionsPerSale: 1 };
        });

      const newProduct: Product = {
        id: Date.now(),
        nameEN: productForm.name,
        translations: productForm.translations,
        category: productForm.category || 'General',
        price: parseFloat(productForm.price),
        emoji: productForm.emoji,
        active: true,
        transKey: '',
        ingredientLinks,
        preparedStockLinks: preppedLinks,
      };
      if (!categories.includes(newProduct.category)) {
        setCategories([...categories, newProduct.category]);
      }
      setIngredients(currentIngredients);
      setPreparedStock(currentPrepared);
      setProducts([...products, newProduct]);
      setProductForm({
        name: '',
        category: categories[0] || newProduct.category || 'General',
        price: '',
        emoji: '📦',
        translations: {},
        ingredientNames: [],
        preppedNames: [],
      });
    }
  };

  const handleProductNameChange = async (name: string) => {
    setProductForm(prev => ({ ...prev, name }));
    if (name.length > 2) {
      setIsAIProcessing(true);
      const result = await getAIAssistance(name);
      if (result) {
        setProductForm(prev => {
          if (prev.name === name) {
            return { ...prev, emoji: result.emoji, translations: result.translations };
          }
          return prev;
        });
      }
      setIsAIProcessing(false);
    }
  };

  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<
    'uploading' | 'analyzing' | 'extracting' | 'finishing' | 'error' | 'success' | 'timeout'
  >('uploading');
  const [scanThumbnail, setScanThumbnail] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<ScanMenuResult | null>(null);
  const [expandedScanItem, setExpandedScanItem] = useState<number | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scanStatus === 'success') {
      const id = setTimeout(() => setIsScanning(false), 800);
      return () => clearTimeout(id);
    }
  }, [scanStatus]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setSelectedFile(reader.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startScan = async () => {
    if (!selectedFile) return;
    setIsScanning(true);
    setScanStatus('uploading');
    setScanThumbnail(selectedFile);
    let stageTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const compressed = await compressImage(selectedFile, 768, 0.62);
      setScanStatus('analyzing');
      stageTimer = setTimeout(() => setScanStatus('extracting'), 1500);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => {
        controller.abort();
        setScanStatus('timeout');
      }, 45000);
      const result = await scanMenu(compressed, controller.signal);
      clearTimeout(timeoutId);
      if (stageTimer) clearTimeout(stageTimer);
      if (result && result.products.length > 0) {
        setScanStatus('finishing');
        setScanResults(result);
        setSelectedFile(null);
        setScanStatus('success');
      } else {
        setScanStatus('error');
        addToast(t('scanMenuNoItems'), 'error');
      }
    } catch {
      if (stageTimer) clearTimeout(stageTimer);
      setScanStatus('error');
      addToast(t('scanMenuFailed'), 'error');
    } finally {
      abortControllerRef.current = null;
    }
  };

  const cancelScan = () => {
    abortControllerRef.current?.abort();
    setIsScanning(false);
    setScanStatus('uploading');
    setSelectedFile(null);
  };

  const saveScannedProducts = () => {
    if (!scanResults) return;
    const currentIngredients = [...ingredients];
    const currentPreparedStock = [...preparedStock];
    const newProducts: Product[] = scanResults.products.map(p => {
      const preppedLinks = (p.preparedStockNeeds || []).map(needName => {
        let prepped = currentPreparedStock.find(ps => ps.name.toLowerCase() === needName.toLowerCase());
        if (!prepped) {
          prepped = { id: Date.now() + Math.random(), name: needName, portions: 20, lowThreshold: 5 };
          currentPreparedStock.push(prepped);
        }
        return { preparedStockId: prepped.id, portionsPerSale: 1 };
      });
      const links: IngredientLink[] = p.ingredientLinks.map(link => {
        let ingredient = currentIngredients.find(i => i.name.toLowerCase() === link.ingredientName.toLowerCase());
        if (!ingredient) {
          ingredient = {
            id: Date.now() + Math.random(),
            name: link.ingredientName,
            unit: link.unit,
            qty: 50,
            lowThreshold: 2,
          };
          currentIngredients.push(ingredient);
        }
        return { ingredientId: ingredient.id, quantityUsed: link.quantityUsed, unit: link.unit };
      });
      return {
        id: Date.now() + Math.random(),
        nameEN: p.name,
        translations: p.translations,
        category: p.category,
        price: p.price,
        emoji: p.emoji,
        active: true,
        transKey: `p${Date.now()}_${Math.random()}`,
        ingredientLinks: links,
        preparedStockLinks: preppedLinks,
      };
    });
    const newCategories = [...new Set([...categories, ...scanResults.products.map(p => p.category)])];
    setCategories(newCategories);
    setIngredients(currentIngredients);
    setPreparedStock(currentPreparedStock);
    setProducts([...products, ...newProducts]);
    setScanResults(null);
    addToast(t('menuItemsAdded').replace('{count}', String(newProducts.length)), 'success');
  };

  const handleCountryChange = (country: string) => {
    setBusinessConfig(prev => ({ ...prev, country, city: '' }));
  };

  const handleCurrencyChange = (value: string) => {
    const selected = currencyOptions.find(c => c.code === value);
    if (!selected) return;
    setBusinessConfig(prev => ({ ...prev, currencyCode: selected.code, currencySymbol: selected.symbol }));
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const handleBusinessConfigContinue = async () => {
    if (!businessConfig.name.trim() || !businessConfig.city.trim()) {
      addToast('Business name and city are required.', 'error');
      return;
    }
    if (!user) {
      addToast('Missing account session. Please sign in again.', 'error');
      return;
    }
    const settingsPayload = {
      name: businessConfig.name.trim(),
      ownerName: user.fullName || 'Owner',
      ownerEmail: user.email || `${user.username}@local.previsio`,
      ownerPhone: businessSettings?.ownerPhone || '',
      venueType: businessConfig.venueType,
      country: businessConfig.country,
      city: businessConfig.city.trim(),
      currencyCode: businessConfig.currencyCode,
      currencySymbol: businessConfig.currencySymbol,
      language: businessConfig.language,
      openingHours: businessSettings?.openingHours || '',
      address: businessSettings?.address || '',
    };
    setIsProvisioning(true);
    const { error } = await provisionBusinessProfile(settingsPayload);
    setIsProvisioning(false);
    if (error) {
      addToast(
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Could not save business profile.',
        'error'
      );
      return;
    }
    nextStep();
  };

  const canCompleteSetup = products.length >= 1;

  const finishSetup = async (goCashier: boolean) => {
    if (!canCompleteSetup) {
      addToast(t('addOneMenuItem') || 'Add at least one menu item first.', 'error');
      return;
    }
    try {
      sessionStorage.removeItem(ONBOARDING_STEP_KEY);
    } catch {
      /* ignore */
    }
    if (businessSettings) {
      await saveBusinessSettings({
        ...businessSettings,
        enabledModules: normalizeEnabledModules(modules),
      });
    }
    await completeOnboarding();
    setActiveTab(goCashier ? 'cashier' : 'overview');
    // Ensure tour starts after either exit path (pending flag + event survive Dashboard remount).
    window.setTimeout(() => requestProductTour(), 750);
  };

  const toggleModule = (key: keyof EnabledModules) => {
    setModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const menuContinue = () => {
    if (!canCompleteSetup) {
      addToast(t('addOneMenuItem') || 'Add at least one menu item to continue.', 'error');
      return;
    }
    nextStep();
  };

  const moduleOptions: {
    key: keyof EnabledModules;
    icon: React.ReactNode;
    title: string;
    hint: string;
  }[] = [
    { key: 'orders', icon: <ClipboardList size={18} />, title: t('moduleOrders'), hint: t('moduleOrdersHint') },
    { key: 'sales', icon: <BarChart3 size={18} />, title: t('moduleSales'), hint: t('moduleSalesHint') },
    { key: 'stock', icon: <Boxes size={18} />, title: t('moduleStock'), hint: t('moduleStockHint') },
    { key: 'staff', icon: <Users size={18} />, title: t('moduleStaff'), hint: t('moduleStaffHint') },
    { key: 'finance', icon: <Wallet size={18} />, title: t('moduleFinance'), hint: t('moduleFinanceHint') },
    { key: 'tables', icon: <Layout size={18} />, title: t('moduleTables'), hint: t('moduleTablesHint') },
    { key: 'customers', icon: <Users size={18} />, title: t('moduleCustomers'), hint: t('moduleCustomersHint') },
    { key: 'tips', icon: <Wallet size={18} />, title: t('moduleTips'), hint: t('moduleTipsHint') },
    { key: 'onlineOrders', icon: <ClipboardList size={18} />, title: t('moduleOnlineOrders'), hint: t('moduleOnlineOrdersHint') },
    { key: 'parkTickets', icon: <ClipboardList size={18} />, title: t('moduleParkTickets'), hint: t('moduleParkTicketsHint') },
  ];

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-2 sm:p-4">
      <div className="max-w-2xl w-full bg-white rounded-[2rem] shadow-2xl shadow-bakery-brown/10 p-4 sm:p-8 md:p-10 animate-fade-in relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-bakery-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col h-full min-h-0">
          <div className="flex justify-center gap-2 mb-6 shrink-0">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  step === i + 1 ? 'w-8 bg-bakery-brown' : step > i + 1 ? 'w-2 bg-bakery-brown/50' : 'w-2 bg-bakery-brown/20'
                }`}
              />
            ))}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide pr-1 min-h-0">
            {step === 1 && (
              <div className="animate-fade-in py-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-bakery-accent/20 rounded-2xl flex items-center justify-center text-bakery-brown shrink-0">
                    <Layout size={20} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl sm:text-2xl font-black font-serif text-bakery-brown">{t('businessProfile') || 'Business profile'}</h2>
                    <p className="text-bakery-brown/50 text-xs sm:text-sm">{t('businessProfileSubtitle') || 'Set your core business details to get started.'}</p>
                  </div>
                </div>
                <div className="space-y-3 mb-8">
                  <input
                    type="text"
                    placeholder={t('businessName') || 'Business Name'}
                    className="w-full p-3 sm:p-4 bg-white border-2 border-bakery-brown/15 focus:border-bakery-brown/50 rounded-2xl outline-none font-bold text-sm sm:text-base text-bakery-brown"
                    value={businessConfig.name}
                    onChange={e => setBusinessConfig(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <div className="relative">
                    <select
                      className="w-full p-3 sm:p-4 pr-12 bg-white border-2 border-bakery-brown/15 focus:border-bakery-brown/50 rounded-2xl outline-none font-bold appearance-none text-sm sm:text-base text-bakery-brown"
                      value={businessConfig.venueType}
                      onChange={e => setBusinessConfig(prev => ({ ...prev, venueType: e.target.value }))}
                    >
                      {venueOptions.map(v => (
                        <option key={v} value={v}>
                          {venueLabel(v)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-bakery-brown/50 pointer-events-none" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <select
                        className="w-full p-3 sm:p-4 pr-12 bg-white border-2 border-bakery-brown/15 focus:border-bakery-brown/50 rounded-2xl outline-none font-bold appearance-none text-sm sm:text-base text-bakery-brown"
                        value={businessConfig.country}
                        onChange={e => handleCountryChange(e.target.value)}
                      >
                        {countryOptions.map(c => (
                          <option key={c.code} value={c.code}>
                            {typeof Intl !== 'undefined' && (Intl as any).DisplayNames
                              ? new Intl.DisplayNames([lang], { type: 'region' }).of(c.code) || c.label
                              : t(`country${c.code}`) || c.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-bakery-brown/50 pointer-events-none" />
                    </div>
                    <CitySelect
                      countryCode={businessConfig.country}
                      value={businessConfig.city}
                      placeholder={t('city') || 'City'}
                      onChange={(city) =>
                        setBusinessConfig((prev) => ({ ...prev, city }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <select
                        className="w-full p-3 sm:p-4 pr-12 bg-white border-2 border-bakery-brown/15 focus:border-bakery-brown/50 rounded-2xl outline-none font-bold appearance-none text-sm sm:text-base text-bakery-brown"
                        value={businessConfig.currencyCode}
                        onChange={e => handleCurrencyChange(e.target.value)}
                      >
                        {currencyOptions.map(c => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-bakery-brown/50 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        className="w-full p-3 sm:p-4 pr-12 bg-white border-2 border-bakery-brown/15 focus:border-bakery-brown/50 rounded-2xl outline-none font-bold appearance-none text-sm sm:text-base text-bakery-brown"
                        value={businessConfig.language}
                        onChange={e => {
                          const next = e.target.value as Language;
                          setBusinessConfig(prev => ({ ...prev, language: next }));
                          setLang(next);
                        }}
                      >
                        {languageOptions.map(l => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-bakery-brown/50 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleBusinessConfigContinue}
                  disabled={isProvisioning}
                  className="w-full py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {isProvisioning ? <Loader2 size={20} className="animate-spin" /> : null}
                  {t('continue')}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-in py-2 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-bakery-accent/20 rounded-2xl flex items-center justify-center text-bakery-brown shrink-0">
                    <UtensilsCrossed size={20} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl sm:text-2xl font-black font-serif text-bakery-brown">{t('buildYourMenu') || 'Build your menu'}</h2>
                    <p className="text-bakery-brown/50 text-xs sm:text-sm">
                      {t('buildYourMenuSubtitle') || 'Scan a menu photo or add items manually. One item is enough to start selling.'}
                    </p>
                  </div>
                </div>

                {/* Scan */}
                <div className="bg-bakery-beige/20 border-2 border-dashed border-bakery-brown/10 rounded-2xl p-6 text-center">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                  <Camera size={28} className="mx-auto text-bakery-brown mb-2" />
                  <p className="font-bold text-bakery-brown text-sm mb-1">{t('takePhotoUpload')}</p>
                  <p className="text-xs text-bakery-brown/40 mb-3">{t('aiExtractsMenu')}</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="px-6 py-2.5 bg-bakery-brown text-white rounded-xl font-bold text-sm hover:bg-bakery-brown/90 disabled:opacity-50"
                  >
                    {isScanning ? t('processing') : t('selectImage')}
                  </button>
                </div>

                {products.length > 0 && (
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                      {t('menuItems')} ({products.length})
                    </h3>
                    <div className="max-h-36 overflow-y-auto space-y-2">
                      {products.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-3 bg-bakery-beige/30 rounded-xl text-sm">
                          <span className="font-bold truncate">
                            {p.emoji} {tp(p)}
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-black">{formatPrice(p.price)}</span>
                            <button type="button" onClick={() => setProducts(products.filter(prod => prod.id !== p.id))} className="text-rose-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories inline */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('categories')}</h3>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder={t('categoryPlaceholder')}
                      className="flex-1 p-3 bg-bakery-cream rounded-xl outline-none font-bold text-sm"
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCategory()}
                    />
                    <button type="button" onClick={addCategory} className="p-3 bg-bakery-brown text-white rounded-xl">
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <div key={cat} className="px-3 py-1.5 bg-bakery-beige text-bakery-brown rounded-full font-bold text-xs flex items-center gap-2">
                        {tc(cat)}
                        <button type="button" onClick={() => setCategories(categories.filter(c => c !== cat))} className="text-bakery-brown/30 hover:text-rose-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Manual add */}
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('manualMenuItems')}</h3>
                  <div className="grid grid-cols-6 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder={t('emoji')}
                      className="col-span-1 p-3 bg-bakery-cream rounded-xl outline-none font-bold text-center"
                      value={productForm.emoji}
                      onChange={e => setProductForm({ ...productForm, emoji: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder={t('productName')}
                      className="col-span-5 p-3 bg-bakery-cream rounded-xl outline-none font-bold text-sm"
                      value={productForm.name}
                      onChange={e => handleProductNameChange(e.target.value)}
                    />
                    {isAIProcessing && (
                      <div className="col-span-6 text-[10px] text-bakery-brown/40 italic">{t('aiTranslating')}</div>
                    )}
                    <select
                      className="col-span-3 p-3 bg-white border border-bakery-beige rounded-xl outline-none font-bold text-sm"
                      value={productForm.category}
                      onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                    >
                      {(categories.length ? categories : ['General']).map(cat => (
                        <option key={cat} value={cat}>
                          {tc(cat)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder={t('price')}
                      className="col-span-3 p-3 bg-bakery-cream rounded-xl outline-none font-bold text-sm"
                      value={productForm.price}
                      onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addProduct}
                    className="w-full py-3 bg-bakery-brown text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    {t('addProduct')}
                  </button>
                </div>

                <ScanProgressModal
                  isOpen={isScanning}
                  status={scanStatus}
                  imageThumbnail={scanThumbnail}
                  onClose={() => {
                    setIsScanning(false);
                    setSelectedFile(null);
                  }}
                  onCancel={cancelScan}
                  onRetry={() => {
                    setIsScanning(false);
                    startScan();
                  }}
                />

                {selectedFile && !isScanning && (
                  <Modal title={t('previewMenuImage')} onClose={() => setSelectedFile(null)}>
                    <div className="space-y-4">
                      <img src={selectedFile} alt={t('preview')} className="w-full rounded-2xl object-contain max-h-64 bg-bakery-beige/20" />
                      <div className="flex gap-3">
                        <button type="button" onClick={() => setSelectedFile(null)} className="flex-1 py-3 bg-bakery-beige rounded-xl font-bold">
                          {t('cancel')}
                        </button>
                        <button type="button" onClick={startScan} className="flex-[2] py-3 bg-bakery-brown text-white rounded-xl font-bold flex items-center justify-center gap-2">
                          <Camera size={18} />
                          {t('scanMenu')}
                        </button>
                      </div>
                    </div>
                  </Modal>
                )}

                {scanResults && (
                  <Modal title={t('reviewScannedMenu')} onClose={() => setScanResults(null)}>
                    <div className="space-y-4">
                      <p className="text-sm text-bakery-brown/60">
                        {t('scanReviewIntro').replace('{count}', String(scanResults.products.length))}
                      </p>
                      <div className="max-h-[45vh] overflow-y-auto space-y-2">
                        {scanResults.products.map((p, idx) => (
                          <div key={idx} className="p-3 bg-bakery-beige/30 rounded-xl flex items-center gap-2">
                            <span>{p.emoji}</span>
                            <input
                              className="flex-1 bg-transparent font-bold outline-none border-b border-transparent focus:border-bakery-brown"
                              value={p.name}
                              onChange={e => {
                                const next = [...scanResults.products];
                                next[idx].name = e.target.value;
                                setScanResults({ products: next });
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setScanResults({ products: scanResults.products.filter((_, i) => i !== idx) })}
                              className="text-rose-500"
                            >
                              <Trash2 size={14} />
                            </button>
                            <button type="button" onClick={() => setExpandedScanItem(expandedScanItem === idx ? null : idx)} className="text-bakery-brown/40">
                              {expandedScanItem === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={saveScannedProducts}
                        className="w-full py-3 bg-bakery-brown text-white rounded-xl font-bold flex items-center justify-center gap-2"
                      >
                        <Check size={16} />
                        {t('addMenuItems').replace('{count}', String(scanResults.products.length))}
                      </button>
                    </div>
                  </Modal>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={menuContinue}
                    className="w-full py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90"
                  >
                    {t('continue')}
                  </button>
                  {canCompleteSetup && (
                    <button
                      type="button"
                      onClick={menuContinue}
                      className="w-full py-3 rounded-2xl font-bold border-2 border-bakery-brown text-bakery-brown text-sm"
                    >
                      {t('startSellingNow') || 'Start selling now →'}
                    </button>
                  )}
                  <button type="button" onClick={prevStep} className="w-full py-2 text-bakery-brown/40 font-bold text-xs uppercase tracking-widest">
                    {t('back')}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-in py-2 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-bakery-accent/20 rounded-2xl flex items-center justify-center text-bakery-brown shrink-0">
                    <Layout size={20} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl sm:text-2xl font-black font-serif text-bakery-brown">{t('chooseModules')}</h2>
                    <p className="text-bakery-brown/50 text-xs sm:text-sm">{t('chooseModulesSubtitle')}</p>
                  </div>
                </div>
                <p className="text-[11px] text-bakery-brown/45 font-bold">{t('modulesAlwaysOn')}</p>
                <div className="space-y-2">
                  {moduleOptions.map(opt => {
                    const on = modules[opt.key];
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => toggleModule(opt.key)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex gap-3 items-start ${
                          on
                            ? 'border-bakery-brown bg-bakery-beige/40'
                            : 'border-bakery-brown/10 bg-white hover:border-bakery-brown/25'
                        }`}
                      >
                        <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          on ? 'bg-bakery-brown text-white' : 'bg-bakery-beige text-bakery-brown/50'
                        }`}>
                          {opt.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-sm text-bakery-brown">{opt.title}</p>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${on ? 'text-emerald-700' : 'text-bakery-brown/35'}`}>
                              {on ? t('on') || 'On' : t('off') || 'Off'}
                            </span>
                          </div>
                          <p className="text-xs text-bakery-brown/50 mt-0.5">{opt.hint}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={nextStep}
                    className="w-full py-4 bg-bakery-brown text-white rounded-2xl font-bold hover:bg-bakery-brown/90"
                  >
                    {t('continue')}
                  </button>
                  <button type="button" onClick={prevStep} className="w-full py-2 text-bakery-brown/40 font-bold text-xs uppercase tracking-widest">
                    {t('back')}
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="text-center animate-fade-in py-4">
                <div className="w-16 h-16 bg-emerald-500 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-emerald-500/20">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black font-serif text-bakery-brown mb-3">
                  {t('readyToSell') || 'You can take orders'}
                </h2>
                <p className="text-bakery-brown/60 text-sm sm:text-base mb-6 leading-relaxed max-w-md mx-auto">
                  {t('onboardingHonestDone') ||
                    'Your menu is ready. Finish stock, team, and finance anytime from Overview and Settings.'}
                </p>
                <div className="text-left bg-bakery-beige/30 rounded-2xl p-4 mb-6 space-y-1">
                  <p className="text-sm font-bold text-emerald-700">
                    {t('menuItems')}: {products.length} ✓
                  </p>
                  <p className="text-xs text-bakery-brown/50">
                    {[
                      modules.stock && t('stock'),
                      modules.staff && t('staff'),
                      modules.finance && t('finance'),
                      modules.orders && t('orders'),
                      modules.sales && t('sales'),
                      modules.tables && t('moduleTables'),
                      modules.customers && t('moduleCustomers'),
                      modules.tips && t('moduleTips'),
                      modules.onlineOrders && t('moduleOnlineOrders'),
                      modules.parkTickets && t('moduleParkTickets'),
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('modulesAlwaysOn')}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => finishSetup(true)}
                    className="w-full py-4 bg-bakery-brown text-white rounded-2xl font-bold flex items-center justify-center gap-2"
                  >
                    {t('goToCashier') || 'Go to Cashier'}
                    <ChevronRight size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => finishSetup(false)}
                    className="w-full py-3 text-bakery-brown/60 font-bold text-sm hover:text-bakery-brown"
                  >
                    {t('goToDashboard')}
                  </button>
                  <button type="button" onClick={prevStep} className="w-full py-2 text-bakery-brown/40 font-bold text-xs uppercase tracking-widest">
                    {t('back')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
