import { PasswordInput } from './PasswordInput';
import React, { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { CURRENCIES, VENUE_TYPES, CURRENCY_OPTIONS } from '../constants';
import { SUPPORTED_COUNTRIES } from '../data/supportedCountries';
import { getRegionalTaxProfile, regionalTaxLines } from '../utils/taxRegions';
import { CitySelect } from './CitySelect';
import { BusinessSettings, Language, TaxSettings, EnabledModules, normalizeEnabledModules, normalizeDiscountPolicy, normalizeBrandTheme, DiscountPolicy, BrandTheme, DEFAULT_BRAND_THEME } from '../types';
import { appearancePalette, BRAND_PALETTES, resolveBrandPalette, contrastingInk, applyBrandThemeToDocument } from '../utils/brandTheme';
import {
  Save,
  Building2,
  Globe,
  Coins,
  Languages,
  KeyRound,
  Clock,
  Phone,
  Receipt,
  LayoutGrid,
  Palette,
  Shield,
  Compass,
  CreditCard,
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { wipeLocalAccounts } from '../utils/localAccounts';
import { applyCountryDialCode, getDialCode } from '../utils/phone';
import { APP_LANGUAGE_OPTIONS } from '../utils/languages';
import { requestProductTour } from '../utils/productTour';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { isPasswordStrongEnough } from '../utils/passwordStrength';
import { hasOwnerAccess } from '../utils/roles';
import { hasActiveSubscription, subscriptionLabelKey } from '../utils/subscription';
import { openPortal, startCheckout } from './BillingGate';

const LANGUAGE_OPTIONS = APP_LANGUAGE_OPTIONS;

const emptyBusiness = (): BusinessSettings => ({
  id: '',
  name: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  venueType: '',
  country: '',
  city: '',
  address: '',
  openingHours: '',
  currencyCode: '',
  currencySymbol: '',
  language: 'en',
  enabledModules: normalizeEnabledModules(),
});

export const SettingsTab = () => {
  const {
    t,
    lang,
    businessSettings,
    saveBusinessSettings,
    addToast,
    user,
    users,
    setUsers,
    setUser,
    taxSettings,
    setTaxSettings,
    isDemoMode,
    accountAppearance,
  } = useApp();

  const [formData, setFormData] = useState<BusinessSettings>(businessSettings || emptyBusiness());
  const [fiscalForm, setFiscalForm] = useState<Pick<TaxSettings, 'vatRegime' | 'municipalTaxRate'>>({
    vatRegime: taxSettings.vatRegime,
    municipalTaxRate: taxSettings.municipalTaxRate,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [modulesForm, setModulesForm] = useState<EnabledModules>(() =>
    normalizeEnabledModules(businessSettings?.enabledModules)
  );
  const [discountForm, setDiscountForm] = useState<DiscountPolicy>(() =>
    normalizeDiscountPolicy(businessSettings?.discountPolicy)
  );
  const [themeForm, setThemeForm] = useState<BrandTheme>(() =>
    normalizeBrandTheme(businessSettings?.brandTheme)
  );
  const selectedPalette = appearancePalette(resolveBrandPalette(themeForm), accountAppearance);
  type SettingsSection =
    | 'profile'
    | 'hours'
    | 'locale'
    | 'modules'
    | 'appearance'
    | 'floor'
    | 'fiscal'
    | 'billing'
    | 'account';
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile');
  const [billingBusy, setBillingBusy] = useState(false);

  useEffect(() => {
    if (businessSettings) setFormData({ ...emptyBusiness(), ...businessSettings });
  }, [businessSettings]);

  useEffect(() => {
    if (!businessSettings) return;
    setFormData(prev => {
      const phone = prev.ownerPhone || '';
      if (phone.trim().startsWith('+') || !prev.country) return prev;
      return { ...prev, ownerPhone: applyCountryDialCode(phone, prev.country) };
    });
  }, [businessSettings?.id, businessSettings?.country]);


  useEffect(() => {
    setModulesForm(normalizeEnabledModules(businessSettings?.enabledModules));
    setDiscountForm(normalizeDiscountPolicy(businessSettings?.discountPolicy));
    setThemeForm(normalizeBrandTheme(businessSettings?.brandTheme));
  }, [businessSettings?.enabledModules, businessSettings?.discountPolicy, businessSettings?.brandTheme]);

  useEffect(() => {
    setFiscalForm({
      vatRegime: taxSettings.vatRegime,
      municipalTaxRate: taxSettings.municipalTaxRate,
    });
  }, [taxSettings.vatRegime, taxSettings.municipalTaxRate]);

  const isOwner = hasOwnerAccess(user?.role);
  const taxProfile = getRegionalTaxProfile(formData.country || businessSettings?.country);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessSettings) return;
    const next = { ...businessSettings, ...formData };
    await saveBusinessSettings(next);
  };

  const persistTheme = async (theme: BrandTheme) => {
    const normalized = normalizeBrandTheme(theme);
    if (!businessSettings) return;
    if (!await saveBusinessSettings({
      ...businessSettings,
      brandTheme: normalized,
    })) return;
    setThemeForm(normalized);
    applyBrandThemeToDocument(normalized);
  };

  const persistDiscount = async (next: DiscountPolicy) => {
    const normalized = normalizeDiscountPolicy(next);
    if (!businessSettings) return;
    if (!await saveBusinessSettings({
      ...businessSettings,
      discountPolicy: normalized,
    })) return;
    setDiscountForm(normalized);
  };

  const persistModules = async (next: EnabledModules) => {
    const normalized = normalizeEnabledModules(next);
    if (!businessSettings) return;
    if (!await saveBusinessSettings({
      ...businessSettings,
      enabledModules: normalized,
    })) return;
    setModulesForm(normalized);
  };

  const toggleModule = (key: keyof EnabledModules) => {
    const next = { ...modulesForm, [key]: !modulesForm[key] };
    void persistModules(next);
  };

  const handleSaveFiscal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      addToast(t('ownerOnlyTaxSettings') || 'Only the owner can change tax settings.', 'error');
      return;
    }
    setTaxSettings(prev => ({
      ...prev,
      vatRegime: fiscalForm.vatRegime,
      municipalTaxRate: fiscalForm.municipalTaxRate,
      countryCode: formData.country || prev.countryCode,
    }));
    addToast(t('settingsUpdated'), 'success');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const current = passwordForm.currentPassword.trim();
    const next = passwordForm.newPassword.trim();
    const confirm = passwordForm.confirmPassword.trim();

    if (!isPasswordStrongEnough(next)) {
      addToast(t('passwordTooWeak'), 'error');
      return;
    }
    if (next !== confirm) {
      addToast(t('passwordsDontMatch') || t('passwordsDoNotMatch'), 'error');
      return;
    }

    setPasswordSaving(true);
    try {
      // Legacy offline accounts are wiped on boot — never persist plaintext passwords.
      wipeLocalAccounts();

      // Demo / in-memory users with local password field (Try demo only)
      const userRecord = users.find(u => u.id === user.id) || user;
      const localPassword = (userRecord as { password?: string }).password;
      if (isDemoMode && localPassword != null) {
        if (localPassword !== current) {
          addToast(t('currentPasswordIncorrect'), 'error');
          return;
        }
        const updatedUsers = users.map(u => (u.id === user.id ? { ...u, password: next } : u));
        setUsers(updatedUsers);
        setUser({ ...user, password: next } as typeof user);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        addToast(t('passwordUpdated'), 'success');
        return;
      }

      // Cloud (Supabase): re-auth then update
      const email = user.email || user.username;
      if (!email) {
        addToast(t('invalidCredentials'), 'error');
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInError) {
        addToast(t('currentPasswordIncorrect'), 'error');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        addToast(updateError.message, 'error');
        return;
      }
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      addToast(t('passwordUpdated'), 'success');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleCountryChange = (countryCode: string) => {
    const currency = CURRENCIES[countryCode as keyof typeof CURRENCIES] || CURRENCIES['GB'];
    const profile = getRegionalTaxProfile(countryCode);
    setFormData({
      ...formData,
      country: countryCode,
      city: '',
      currencyCode: currency.code,
      currencySymbol: currency.symbol,
      ownerPhone: applyCountryDialCode(formData.ownerPhone || '', countryCode),
    });
    if (isOwner) {
      setFiscalForm((prev) => ({
        ...prev,
        municipalTaxRate: profile.defaultMunicipalTaxRate,
      }));
    }
  };


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

  const handleCurrencyChange = (code: string) => {
    const currency = CURRENCY_OPTIONS.find(c => c.code === code);
    if (currency) {
      setFormData({
        ...formData,
        currencyCode: currency.code,
        currencySymbol: currency.symbol,
      });
    }
  };

  const settingsTabs: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: t('businessProfile'), icon: <Building2 size={14} /> },
    { id: 'hours', label: t('hoursAndContact'), icon: <Clock size={14} /> },
    { id: 'locale', label: t('localeLanguage'), icon: <Languages size={14} /> },
    { id: 'modules', label: t('enabledModules'), icon: <LayoutGrid size={14} /> },
    { id: 'appearance', label: t('appearanceSection'), icon: <Palette size={14} /> },
    { id: 'floor', label: t('floorRules'), icon: <Shield size={14} /> },
    { id: 'fiscal', label: t('fiscalDefaults'), icon: <Receipt size={14} /> },
    { id: 'billing', label: t('billingSection'), icon: <CreditCard size={14} /> },
    { id: 'account', label: t('accountSection'), icon: <KeyRound size={14} /> },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-8 max-w-full overflow-hidden">
      <div className="flex flex-wrap gap-1.5 bg-bakery-beige/40 p-1.5 rounded-2xl">
        {settingsTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSettingsSection(tab.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all ${
              settingsSection === tab.id
                ? 'bg-bakery-brown text-white shadow-sm'
                : 'text-bakery-brown/60 hover:text-bakery-brown hover:bg-white/70'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {settingsSection !== 'account' && settingsSection !== 'billing' && (
        <div className="lg:col-span-2 space-y-6">
          {(settingsSection === 'profile' || settingsSection === 'hours' || settingsSection === 'locale') && (
          <form onSubmit={handleSave} className="card-bakery p-4 sm:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {settingsSection === 'profile' && (
              <>
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-bakery-caramel mb-2">
                  <Building2 size={20} />
                  <h3 className="font-black uppercase tracking-widest text-sm">{t('businessProfile')}</h3>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('businessName')}</label>
                  <input
                    type="text"
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('venueType')}</label>
                  <select
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold bg-white text-sm sm:text-base"
                    value={formData.venueType}
                    onChange={e => setFormData({ ...formData, venueType: e.target.value })}
                  >
                    {VENUE_TYPES.map(v => (
                      <option key={v} value={v}>
                        {venueLabel(v)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('ownerPhone')}</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-bakery-brown/30" />
                    <input
                      type="tel"
                      className="w-full pl-10 p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                      value={formData.ownerPhone || ''}
                      onChange={e => setFormData({ ...formData, ownerPhone: e.target.value })}
                      onFocus={() => {
                        if (!(formData.ownerPhone || '').trim() && formData.country) {
                          setFormData(prev => ({
                            ...prev,
                            ownerPhone: applyCountryDialCode(prev.ownerPhone || '', prev.country),
                          }));
                        }
                      }}
                      placeholder={`${getDialCode(formData.country) || '+'} …`}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 text-bakery-caramel mb-2">
                  <Globe size={20} />
                  <h3 className="font-black uppercase tracking-widest text-sm">
                    {t('country')} & {t('city')}
                  </h3>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('country')}</label>
                  <select
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold bg-white text-sm sm:text-base"
                    value={formData.country}
                    onChange={e => handleCountryChange(e.target.value)}
                  >
                    {SUPPORTED_COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {typeof Intl !== 'undefined' && (Intl as any).DisplayNames
                          ? new Intl.DisplayNames([lang], { type: 'region' }).of(c.code) || c.name
                          : t(`country${c.code}`) || c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('city')}</label>
                  <CitySelect
                    countryCode={formData.country}
                    value={formData.city}
                    placeholder={t('city') || 'City'}
                    onChange={(city) => setFormData({ ...formData, city })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('currency')}</label>
                  <div className="relative">
                    <Coins size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-bakery-brown/30" />
                    <select
                      className="w-full pl-10 p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold bg-white text-sm sm:text-base"
                      value={formData.currencyCode}
                      onChange={e => handleCurrencyChange(e.target.value)}
                    >
                      {CURRENCY_OPTIONS.map(c => (
                        <option key={c.code} value={c.code}>
                          {`${c.symbol} ${c.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              </>
              )}

              {settingsSection === 'hours' && (
              <div className="space-y-6 md:col-span-2">
                <div className="flex items-center gap-2 text-bakery-caramel mb-2">
                  <Clock size={20} />
                  <h3 className="font-black uppercase tracking-widest text-sm">{t('hoursAndContact')}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('streetAddress')}</label>
                    <input
                      type="text"
                      className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                      value={formData.address || ''}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      placeholder="12 Rue Example"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('openingHours')}</label>
                    <input
                      type="text"
                      className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                      value={formData.openingHours || ''}
                      onChange={e => setFormData({ ...formData, openingHours: e.target.value })}
                      placeholder={t('openingHoursPlaceholder')}
                    />
                  </div>
                </div>
              </div>
              )}

              {settingsSection === 'locale' && (
              <div className="space-y-6 md:col-span-2">
                <div className="flex items-center gap-2 text-bakery-caramel mb-2">
                  <Languages size={20} />
                  <h3 className="font-black uppercase tracking-widest text-sm">{t('localeLanguage')}</h3>
                </div>
                <p className="text-xs text-bakery-brown/50 -mt-2">{t('localeLanguageHint')}</p>
                <div className="space-y-2 md:max-w-md">
                  {LANGUAGE_OPTIONS.map(opt => {
                    const selected = formData.language === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => setFormData({ ...formData, language: opt.code })}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                          selected
                            ? 'border-bakery-brown bg-bakery-brown text-white shadow-sm'
                            : 'border-bakery-beige bg-white text-bakery-brown hover:border-bakery-caramel'
                        }`}
                      >
                        <span className="text-xl leading-none" aria-hidden="true">{opt.flag}</span>
                        <span className="font-bold text-sm flex-1">{t(opt.labelKey)}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${selected ? 'text-white/50' : 'text-bakery-brown/35'}`}>
                          {opt.code}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              )}
            </div>

            <div className="pt-6 border-t border-bakery-beige">
              <button
                type="submit"
                className="btn-primary w-full md:w-auto px-10 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-sm sm:text-base"
              >
                <Save size={20} />
                {t('updateSettings')}
              </button>
            </div>
          </form>
          )}

          {settingsSection === 'modules' && (
          <div className="card-bakery p-4 sm:p-8 space-y-5">
            <div className="flex items-center gap-2 text-bakery-caramel">
              <LayoutGrid size={20} />
              <h3 className="font-black uppercase tracking-widest text-sm">{t('enabledModules')}</h3>
            </div>
            <p className="text-xs text-bakery-brown/50">{t('enabledModulesHint')}</p>
            <p className="text-[11px] text-bakery-brown/40 font-bold">{t('modulesAlwaysOn')}</p>
            <div className="space-y-2">
              {(
                [
                  { key: 'orders' as const, title: t('moduleOrders'), hint: t('moduleOrdersHint') },
                  { key: 'sales' as const, title: t('moduleSales'), hint: t('moduleSalesHint') },
                  { key: 'stock' as const, title: t('moduleStock'), hint: t('moduleStockHint') },
                  { key: 'staff' as const, title: t('moduleStaff'), hint: t('moduleStaffHint') },
                  { key: 'finance' as const, title: t('moduleFinance'), hint: t('moduleFinanceHint') },
                  { key: 'tables' as const, title: t('moduleTables'), hint: t('moduleTablesHint') },
                  { key: 'customers' as const, title: t('moduleCustomers'), hint: t('moduleCustomersHint') },
                  { key: 'tips' as const, title: t('moduleTips'), hint: t('moduleTipsHint') },
                  { key: 'onlineOrders' as const, title: t('moduleOnlineOrders'), hint: t('moduleOnlineOrdersHint') },
                ] as const
              ).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleModule(opt.key)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                    modulesForm[opt.key]
                      ? 'border-bakery-brown bg-bakery-beige/40'
                      : 'border-bakery-brown/10 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm text-bakery-brown">{opt.title}</p>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      modulesForm[opt.key] ? 'text-emerald-700' : 'text-bakery-brown/35'
                    }`}>
                      {modulesForm[opt.key] ? t('on') : t('off')}
                    </span>
                  </div>
                  <p className="text-xs text-bakery-brown/50 mt-0.5">{opt.hint}</p>
                </button>
              ))}
            </div>
            {modulesForm.onlineOrders && (
              <div className="rounded-2xl border border-bakery-beige p-4 space-y-2">
                <p className="text-sm font-black text-bakery-brown">{t('onlineOrderPage')}</p>
                <p className="text-xs text-bakery-brown/50">{t('onlineOrderHint')}</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <code className="text-[11px] bg-bakery-cream px-2 py-1 rounded-lg break-all">
                    {`${typeof window !== 'undefined' ? window.location.origin : ''}/order/${businessSettings?.id || ''}`}
                  </code>
                  <button
                    type="button"
                    className="h-9 px-3 rounded-xl bg-bakery-brown text-white text-xs font-bold"
                    onClick={() => {
                      const url = `${window.location.origin}/order/${businessSettings?.id || ''}`;
                      void navigator.clipboard?.writeText(url);
                      addToast(t('linkCopied'), 'success');
                    }}
                  >
                    {t('copyOrderLink')}
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {settingsSection === 'appearance' && (
          <div className="card-bakery p-4 sm:p-8 space-y-5">
            <div className="flex items-center gap-2 text-bakery-caramel">
              <Palette size={20} />
              <h3 className="font-black uppercase tracking-widest text-sm">{t('appearanceSection')}</h3>
            </div>
            <p className="text-xs text-bakery-brown/50">{t('appearanceHint')}</p>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('themePalette')}</span>
              <select
                className="w-full p-3 border border-bakery-beige rounded-xl text-sm font-bold bg-white outline-none"
                value={selectedPalette.id}
                onChange={e => void persistTheme({ paletteId: e.target.value as BrandTheme['paletteId'] })}
              >
                {BRAND_PALETTES.map(p => (
                  <option key={p.id} value={p.id}>
                    {t(p.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {BRAND_PALETTES.map(base => {
                const p = appearancePalette(base, accountAppearance);
                const active = selectedPalette.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void persistTheme({ paletteId: p.id })}
                    className={`rounded-2xl border-2 p-2 text-left transition-all ${
                      active ? 'border-bakery-brown shadow-sm ring-2 ring-bakery-caramel/40' : 'border-bakery-beige hover:border-bakery-caramel'
                    }`}
                  >
                    <div className="h-14 rounded-xl overflow-hidden flex mb-2 border border-black/5">
                      <div className="w-[34%]" style={{ background: p.sidebar }} />
                      <div className="flex-1 relative" style={{ background: p.canvas }}>
                        <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full border border-white/70 shadow" style={{ background: p.accent }} />
                      </div>
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-bakery-brown">{t(p.labelKey)}</p>
                    <div className="flex gap-1 mt-1.5">
                      {[p.ink, p.accent, p.soft].map((c, i) => (
                        <span key={i} className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: c }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="h-28 rounded-2xl border border-bakery-beige overflow-hidden flex shadow-sm">
              <div
                className="w-[30%] flex flex-col justify-end p-3 text-[10px] font-bold gap-1"
                style={{ background: selectedPalette.sidebar, color: contrastingInk(selectedPalette.sidebar) }}
              >
                <span className="opacity-60">{t('themeSidebar')}</span>
                <span
                  className="inline-flex w-full h-6 rounded-lg text-[9px] font-black items-center justify-center"
                  style={{ background: selectedPalette.accent, color: contrastingInk(selectedPalette.accent) }}
                >
                  Nav
                </span>
              </div>
              <div
                className="flex-1 flex flex-col justify-end p-3 gap-2"
                style={{ background: selectedPalette.canvas, color: contrastingInk(selectedPalette.canvas) }}
              >
                <span className="text-[10px] font-bold opacity-60">{t('themeCanvas')}</span>
                <div
                  className="rounded-xl border px-3 py-2 text-[10px] font-bold"
                  style={{
                    background: selectedPalette.card,
                    borderColor: selectedPalette.soft,
                    color: selectedPalette.ink,
                  }}
                >
                  Card · text
                </div>
                <span
                  className="inline-flex self-start px-3 py-1.5 rounded-full text-[9px] font-black"
                  style={{ background: selectedPalette.ink, color: contrastingInk(selectedPalette.ink) }}
                >
                  Button
                </span>
              </div>
            </div>
            <button type="button" className="px-4 py-2 rounded-xl border border-bakery-beige text-xs font-bold" onClick={() => void persistTheme(DEFAULT_BRAND_THEME)}>
              {t('resetTheme')}
            </button>
          </div>
          )}

          {settingsSection === 'floor' && (
          <div className="card-bakery p-4 sm:p-8 space-y-5">
            <div className="flex items-center gap-2 text-bakery-caramel">
              <Shield size={20} />
              <h3 className="font-black uppercase tracking-widest text-sm">{t('discountPolicyTitle')}</h3>
            </div>
            <p className="text-xs text-bakery-brown/50">{t('discountPolicyHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('staffMaxPercent')}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-full p-3 border border-bakery-beige rounded-xl font-bold"
                  value={discountForm.staffMaxPercent}
                  onChange={e => void persistDiscount({ ...discountForm, staffMaxPercent: Math.max(0, parseFloat(e.target.value) || 0) })}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('staffMaxAmount')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full p-3 border border-bakery-beige rounded-xl font-bold"
                  value={discountForm.staffMaxAmount}
                  onChange={e => void persistDiscount({ ...discountForm, staffMaxAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                />
              </div>
            </div>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-bakery-beige cursor-pointer">
              <input
                type="checkbox"
                checked={discountForm.requireManagerPinAboveLimit}
                onChange={e => void persistDiscount({ ...discountForm, requireManagerPinAboveLimit: e.target.checked })}
              />
              <span className="text-sm font-bold text-bakery-brown">{t('requireManagerPin')}</span>
            </label>
          </div>
          )}

          {settingsSection === 'fiscal' && (
          <form onSubmit={handleSaveFiscal} className="card-bakery p-4 sm:p-8 space-y-6">
            <div className="flex items-center gap-2 text-bakery-caramel">
              <Receipt size={20} />
              <h3 className="font-black uppercase tracking-widest text-sm">{t('fiscalDefaults')}</h3>
            </div>
            <p className="text-xs text-bakery-brown/50">{t('fiscalDefaultsHint')}</p>

            <div className="rounded-2xl border border-bakery-beige/60 bg-bakery-beige/20 p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">
                {t('taxForRegion') || 'Tax for your region'} — {taxProfile.countryName}
              </p>
              <ul className="space-y-1.5 text-xs text-bakery-brown/80 list-disc pl-4">
                {regionalTaxLines(taxProfile).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="text-[10px] text-bakery-brown/50 italic pt-1">{taxProfile.disclaimer}</p>
            </div>

            {!isOwner ? (
              <p className="text-sm font-bold text-bakery-brown/60">
                {t('ownerOnlyTaxSettings') ||
                  'Only the business owner can change VAT regime and municipal tax rate.'}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                      {t('municipalTaxRate')} (%)
                    </label>
                    <input
                      type="number"
                      className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm"
                      value={fiscalForm.municipalTaxRate}
                      onChange={e =>
                        setFiscalForm({ ...fiscalForm, municipalTaxRate: parseFloat(e.target.value) || 0 })
                      }
                    />
                    <p className="text-[10px] text-bakery-brown/40 mt-1">{taxProfile.municipalTaxSummary}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('vatRegime')}</label>
                    <select
                      className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold bg-white text-sm"
                      value={fiscalForm.vatRegime}
                      onChange={e =>
                        setFiscalForm({
                          ...fiscalForm,
                          vatRegime: e.target.value as TaxSettings['vatRegime'],
                        })
                      }
                    >
                      <option value="SmallBusiness">{t('smallBusinessExemption')}</option>
                      <option value="Standard">
                        {t('standardVAT')} ({taxProfile.standardVatPercent}% {taxProfile.vatLabel})
                      </option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-primary px-8 py-3 rounded-2xl font-bold text-sm">
                  {t('save')}
                </button>
              </>
            )}
          </form>
          )}
        </div>
        )}

        {settingsSection === 'billing' && (
          <div className="lg:col-span-3 space-y-5 max-w-xl">
            <div className="card-bakery p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-bakery-caramel/20 text-bakery-caramel flex items-center justify-center">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-bakery-brown">{t('billingSection')}</h3>
                  <p className="text-xs text-bakery-brown/50">{t('billingGateBody')}</p>
                </div>
              </div>

              {isDemoMode ? (
                <p className="text-sm font-semibold text-bakery-brown/60">{t('demoRoleSwitcher')}: Pro (demo)</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-bakery-beige p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">
                        {t('billingStatus')}
                      </p>
                      <p className="font-black text-bakery-brown">
                        {t(subscriptionLabelKey(businessSettings?.plan))}
                        {hasActiveSubscription(businessSettings) ? ' ✓' : ''}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-bakery-beige p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">
                        {businessSettings?.plan === 'trialing' ? t('billingTrialEnds') : t('billingPeriodEnds')}
                      </p>
                      <p className="font-bold text-bakery-brown">
                        {(() => {
                          const ts =
                            businessSettings?.plan === 'trialing'
                              ? businessSettings.trialEndsAt
                              : businessSettings?.currentPeriodEndsAt;
                          return ts ? new Date(ts).toLocaleString() : t('dash');
                        })()}
                      </p>
                    </div>
                  </div>

                  {user?.role === 'owner' ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      {(!businessSettings?.plan ||
                        businessSettings.plan === 'none' ||
                        businessSettings.plan === 'canceled' ||
                        businessSettings.plan === 'past_due') && (
                        <button
                          type="button"
                          disabled={billingBusy}
                          className="btn-primary px-5 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                          onClick={async () => {
                            setBillingBusy(true);
                            try {
                              const url = await startCheckout();
                              if (url) window.location.href = url;
                              else addToast(t('billingCheckoutMissing'), 'error');
                            } catch (err) {
                              addToast(
                                err instanceof Error ? err.message : t('billingCheckoutFailed'),
                                'error'
                              );
                            } finally {
                              setBillingBusy(false);
                            }
                          }}
                        >
                          {t('billingStartTrial')}
                        </button>
                      )}
                      {(businessSettings?.stripeCustomerId ||
                        businessSettings?.stripeSubscriptionId ||
                        businessSettings?.plan === 'trialing' ||
                        businessSettings?.plan === 'pro') && (
                        <button
                          type="button"
                          disabled={billingBusy}
                          className="px-5 py-3 rounded-2xl border border-bakery-beige font-bold text-sm disabled:opacity-50"
                          onClick={async () => {
                            setBillingBusy(true);
                            try {
                              const url = await openPortal();
                              if (url) window.location.href = url;
                              else addToast(t('billingPortalMissing'), 'error');
                            } catch (err) {
                              addToast(
                                err instanceof Error ? err.message : t('billingPortalFailed'),
                                'error'
                              );
                            } finally {
                              setBillingBusy(false);
                            }
                          }}
                        >
                          {t('billingManage')}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-bakery-brown/60">{t('billingAskOwner')}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {settingsSection === 'account' && (
          <div className="lg:col-span-3 space-y-5 max-w-xl">
            <div className="card-bakery p-5 sm:p-6">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-bakery-brown text-white flex items-center justify-center text-lg font-black shrink-0">
                  {(user?.fullName || formData.ownerName || '?')
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">
                    {t('accountSignedInAs')}
                  </p>
                  <h3 className="font-bold text-lg text-bakery-brown truncate">
                    {user?.fullName || formData.ownerName || '—'}
                  </h3>
                  <p className="text-xs font-bold uppercase tracking-wider text-bakery-caramel mt-1">
                    {user ? t(user.role === 'staff' ? 'staffRole' : user.role) : '—'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(() => {
                  const loginId = (user?.username || '').trim();
                  const email = (user?.email || (isOwner ? formData.ownerEmail : '') || '').trim();
                  const usernameIsEmail = !!loginId && !!email && loginId.toLowerCase() === email.toLowerCase();
                  const looksLikeEmail = loginId.includes('@');
                  return (
                    <>
                      {email && (
                        <div className="rounded-xl bg-bakery-cream/50 border border-bakery-beige/80 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">{t('ownerEmail')}</p>
                          <p className="font-bold text-sm break-all">{email}</p>
                        </div>
                      )}
                      {loginId && !usernameIsEmail && (
                        <div className="rounded-xl bg-bakery-cream/50 border border-bakery-beige/80 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">
                            {looksLikeEmail ? t('ownerEmail') : t('username')}
                          </p>
                          <p className="font-bold text-sm break-all">{loginId}</p>
                          {looksLikeEmail && !email && (
                            <p className="text-[10px] text-bakery-brown/45 mt-1">{t('accountProfileHint')}</p>
                          )}
                        </div>
                      )}
                      {loginId && usernameIsEmail && !email && (
                        <div className="rounded-xl bg-bakery-cream/50 border border-bakery-beige/80 p-3 sm:col-span-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">{t('ownerEmail')}</p>
                          <p className="font-bold text-sm break-all">{loginId}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <p className="text-xs text-bakery-brown/50 mt-4">{t('accountProfileHint')}</p>
            </div>

            <div className="card-bakery p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2 text-bakery-caramel">
                <Compass size={18} />
                <h3 className="font-black uppercase tracking-widest text-xs">{t('productTour')}</h3>
              </div>
              <p className="text-sm text-bakery-brown/60">{t('replayTourHint')}</p>
              <button
                type="button"
                onClick={() => requestProductTour()}
                className="btn-primary h-11 px-5 rounded-xl text-sm inline-flex items-center gap-2"
              >
                <Compass size={16} />
                {t('replayTour')}
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="card-bakery p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 text-bakery-caramel mb-1">
                <KeyRound size={18} />
                <h3 className="font-black uppercase tracking-widest text-xs">{t('changePassword')}</h3>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                  {t('currentPassword')}
                </label>
                <PasswordInput

                  className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                  {t('newPassword')}
                </label>
                <PasswordInput

                  className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                  autoComplete="new-password"
                />
                <PasswordStrengthMeter password={passwordForm.newPassword} t={t} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                  {t('confirmNewPassword')}
                </label>
                <PasswordInput

                  className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                disabled={passwordSaving || !isPasswordStrongEnough(passwordForm.newPassword)}
                className="btn-primary w-full py-3 rounded-2xl font-bold text-sm disabled:opacity-60"
              >
                {passwordSaving ? t('processing') : t('updatePassword')}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
