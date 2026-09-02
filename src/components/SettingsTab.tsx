import React, { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { CURRENCIES, VENUE_TYPES, CURRENCY_OPTIONS } from '../constants';
import { SUPPORTED_COUNTRIES } from '../data/supportedCountries';
import { getRegionalTaxProfile, regionalTaxLines } from '../utils/taxRegions';
import { CitySelect } from './CitySelect';
import { BusinessSettings, Language, TaxSettings, EnabledModules, normalizeEnabledModules } from '../types';
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
} from 'lucide-react';
import { supabase } from './supabaseClient';
import {
  getLocalAccountById,
  getLocalSession,
  upsertLocalAccount,
} from '../utils/localAccounts';
import { applyCountryDialCode, getDialCode } from '../utils/phone';
import { APP_LANGUAGE_OPTIONS } from '../utils/languages';

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
  type SettingsSection = 'profile' | 'hours' | 'locale' | 'modules' | 'fiscal' | 'account';
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile');

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
  }, [businessSettings?.enabledModules]);

  useEffect(() => {
    setFiscalForm({
      vatRegime: taxSettings.vatRegime,
      municipalTaxRate: taxSettings.municipalTaxRate,
    });
  }, [taxSettings.vatRegime, taxSettings.municipalTaxRate]);

  const isOwner = user?.role === 'owner';
  const taxProfile = getRegionalTaxProfile(formData.country || businessSettings?.country);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessSettings) return;
    const next = { ...businessSettings, ...formData };
    await saveBusinessSettings(next);
  };

  const handleSaveModules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessSettings) return;
    await saveBusinessSettings({
      ...businessSettings,
      ...formData,
      enabledModules: normalizeEnabledModules(modulesForm),
    });
  };

  const toggleModule = (key: keyof EnabledModules) => {
    setModulesForm(prev => ({ ...prev, [key]: !prev[key] }));
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

    if (!next || next.length < 6) {
      addToast(t('passwordTooShort'), 'error');
      return;
    }
    if (next !== confirm) {
      addToast(t('passwordsDontMatch'), 'error');
      return;
    }

    setPasswordSaving(true);
    try {
      const localSession = getLocalSession();
      if (localSession) {
        const account = getLocalAccountById(localSession.accountId);
        if (!account) {
          addToast(t('invalidCredentials'), 'error');
          return;
        }
        if (account.password !== current) {
          addToast(t('currentPasswordIncorrect'), 'error');
          return;
        }
        upsertLocalAccount({ ...account, password: next });
        setUser({ ...user, password: next } as typeof user);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        addToast(t('passwordUpdated'), 'success');
        return;
      }

      // Demo / in-memory users with local password field
      const userRecord = users.find(u => u.id === user.id) || user;
      const localPassword = (userRecord as { password?: string }).password;
      if (localPassword != null) {
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
    { id: 'fiscal', label: t('fiscalDefaults'), icon: <Receipt size={14} /> },
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
        {settingsSection !== 'account' && (
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
          <form onSubmit={handleSaveModules} className="card-bakery p-4 sm:p-8 space-y-5">
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
            <button type="submit" className="btn-primary px-8 py-3 rounded-2xl font-bold text-sm">
              {t('save')}
            </button>
          </form>
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

        {settingsSection === 'account' && (
          <div className="lg:col-span-3 space-y-6 max-w-2xl">
            <div className="card-bakery p-6 bg-bakery-accent/10 border-bakery-accent/30">
              <h3 className="font-black uppercase tracking-widest text-xs text-bakery-brown/60 mb-4">
                {t('accountSignedInAs')}
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('fullName')}</p>
                  <p className="font-bold text-sm sm:text-base">{user?.fullName || formData.ownerName || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('username')}</p>
                  <p className="font-bold text-sm sm:text-base break-all">{user?.username || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('role')}</p>
                  <p className="font-bold text-sm sm:text-base uppercase">{user ? t(user.role === 'staff' ? 'staffRole' : user.role) : '—'}</p>
                </div>
                {(user?.email || formData.ownerEmail) && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('ownerEmail')}</p>
                    <p className="font-bold text-sm sm:text-base break-all">{user?.email || formData.ownerEmail}</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-bakery-brown/50 mt-4 pt-4 border-t border-bakery-beige/60">{t('accountProfileHint')}</p>
            </div>

            {isOwner && (
              <div className="card-bakery p-6 bg-bakery-accent/10 border-bakery-accent/30">
                <h3 className="font-black uppercase tracking-widest text-xs text-bakery-brown/60 mb-4 italic">
                  {t('ownerInformation')}
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('ownerFullName')}</p>
                    <p className="font-bold text-sm sm:text-base">{formData.ownerName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('ownerEmail')}</p>
                    <p className="font-bold text-sm sm:text-base break-all">{formData.ownerEmail || '—'}</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="card-bakery p-6 space-y-4">
              <div className="flex items-center gap-2 text-bakery-caramel mb-2">
                <KeyRound size={18} />
                <h3 className="font-black uppercase tracking-widest text-xs">{t('changePassword')}</h3>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                  {t('currentPassword')}
                </label>
                <input
                  type="password"
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
                <input
                  type="password"
                  className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                  {t('confirmNewPassword')}
                </label>
                <input
                  type="password"
                  className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                disabled={passwordSaving}
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
