
import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { COUNTRIES, CURRENCIES, VENUE_TYPES } from '../constants';
import { BusinessSettings, User, Language } from '../types';
import { ArrowLeft } from 'lucide-react';

export const RegistrationForm = ({ onBack }: { onBack: () => void }) => {
  const { t, registerBusiness, addToast } = useApp();

  const venueLabel = (venue: string) => {
    const map: Record<string, string> = {
      'Restaurant': 'restaurant',
      'Food Truck': 'foodTruck',
      'Cafe': 'cafe',
      'Café': 'cafe',
      'Bar': 'bar',
      'Bakery': 'bakery',
      'Fast Food': 'fastFood',
      'Other': 'otherVenue'
    };
    const key = map[venue] || venue;
    const translated = t(key);
    return translated === key ? venue : translated;
  };
  
  const [formData, setFormData] = useState({
    businessName: '',
    ownerFullName: '',
    username: '',
    ownerEmail: '',
    ownerPhone: '',
    venueType: 'Restaurant',
    country: 'US',
    city: '',
    currencyCode: 'USD',
    currencySymbol: '$',
    language: 'en' as Language,
    password: '',
    confirmPassword: ''
  });

  const CURRENCY_OPTIONS = [
    { label: 'Euro (€) — EUR', code: 'EUR', symbol: '€' },
    { label: 'British Pound (£) — GBP', code: 'GBP', symbol: '£' },
    { label: 'US Dollar ($) — USD', code: 'USD', symbol: '$' },
    { label: 'Swiss Franc (CHF) — CHF', code: 'CHF', symbol: 'CHF' },
    { label: 'Canadian Dollar (CA$) — CAD', code: 'CAD', symbol: 'CA$' },
    { label: 'Australian Dollar (A$) — AUD', code: 'AUD', symbol: 'A$' },
    { label: 'UAE Dirham (AED) — AED', code: 'AED', symbol: 'AED' },
    { label: 'Saudi Riyal (SAR) — SAR', code: 'SAR', symbol: 'SAR' },
    { label: 'Egyptian Pound (EGP) — EGP', code: 'EGP', symbol: 'EGP' },
    { label: 'Moroccan Dirham (MAD) — MAD', code: 'MAD', symbol: 'MAD' },
    { label: 'Jordanian Dinar (JOD) — JOD', code: 'JOD', symbol: 'JOD' },
    { label: 'Polish Złoty (zł) — PLN', code: 'PLN', symbol: 'zł' },
    { label: 'Romanian Leu (lei) — RON', code: 'RON', symbol: 'lei' },
    { label: 'Turkish Lira (₺) — TRY', code: 'TRY', symbol: '₺' },
    { label: 'Japanese Yen (¥) — JPY', code: 'JPY', symbol: '¥' },
    { label: 'Chinese Yuan (¥) — CNY', code: 'CNY', symbol: '¥' },
    { label: 'Brazilian Real (R$) — BRL', code: 'BRL', symbol: 'R$' },
    { label: 'South African Rand (R) — ZAR', code: 'ZAR', symbol: 'R' },
  ];

  const COUNTRY_CURRENCY_MAP: Record<string, string> = {
    'BE': 'EUR', 'FR': 'EUR', 'NL': 'EUR', 'DE': 'EUR', 'ES': 'EUR', 'IT': 'EUR', 'PT': 'EUR', 'LU': 'EUR', 'AT': 'EUR',
    'GB': 'GBP', 'US': 'USD', 'CA': 'CAD', 'AU': 'AUD', 'CH': 'CHF', 'AE': 'AED', 'SA': 'SAR', 'EG': 'EGP', 'MA': 'MAD',
    'JO': 'JOD', 'PL': 'PLN', 'RO': 'RON', 'TR': 'TRY', 'JP': 'JPY', 'CN': 'CNY', 'BR': 'BRL', 'ZA': 'ZAR'
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const countryCode = e.target.value;
    const currencyCode = COUNTRY_CURRENCY_MAP[countryCode];
    
    if (currencyCode) {
      const option = CURRENCY_OPTIONS.find(o => o.code === currencyCode);
      if (option) {
        setFormData({
          ...formData,
          country: countryCode,
          currencyCode: option.code,
          currencySymbol: option.symbol
        });
        return;
      }
    }
    
    setFormData({ ...formData, country: countryCode });
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const option = CURRENCY_OPTIONS.find(o => o.code === e.target.value);
    if (option) {
      setFormData({
        ...formData,
        currencyCode: option.code,
        currencySymbol: option.symbol
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      addToast(t('passwordsDontMatch'), "error");
      return;
    }

    const bizId = formData.businessName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    
    const settings: BusinessSettings = {
      id: bizId,
      name: formData.businessName,
      ownerName: formData.ownerFullName,
      ownerEmail: formData.ownerEmail,
      ownerPhone: formData.ownerPhone,
      venueType: formData.venueType,
      country: formData.country,
      city: formData.city,
      currencyCode: formData.currencyCode,
      currencySymbol: formData.currencySymbol,
      language: formData.language
    };

    const owner: User = {
      id: 1,
      username: formData.username,
      fullName: formData.ownerFullName,
      password: formData.password,
      role: 'owner'
    };

    registerBusiness(settings, owner);
  };

  return (
    <div className="min-h-screen bg-bakery-beige/30 p-2 sm:p-4 flex items-center justify-center">
      <div className="card-bakery w-full max-w-xl p-4 sm:p-6 md:p-10 animate-fade-in overflow-y-auto max-h-[95vh] scrollbar-hide">
        <button onClick={onBack} className="text-bakery-brown/50 hover:text-bakery-brown mb-4 sm:mb-6 flex items-center gap-2 transition-colors">
          <ArrowLeft size={18} />
          <span className="font-bold text-sm sm:text-base">{t('cancel')}</span>
        </button>
        
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-serif mb-6 sm:mb-8 text-center">{t('registerBusiness')}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1 sm:mb-2">{t('businessName')}</label>
              <input 
                type="text" 
                className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                value={formData.businessName}
                onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                required 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1 sm:mb-2">{t('ownerFullName')}</label>
              <input 
                type="text" 
                className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                value={formData.ownerFullName}
                onChange={e => setFormData({ ...formData, ownerFullName: e.target.value })}
                required 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1 sm:mb-2">{t('username')}</label>
              <input 
                type="text" 
                className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                required 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1 sm:mb-2">{t('ownerEmail')}</label>
              <input 
                type="email" 
                className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                value={formData.ownerEmail}
                onChange={e => setFormData({ ...formData, ownerEmail: e.target.value })}
                required 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1 sm:mb-2">{t('ownerPhone')}</label>
              <input 
                type="tel" 
                className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                value={formData.ownerPhone}
                onChange={e => setFormData({ ...formData, ownerPhone: e.target.value })}
                required 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1 sm:mb-2">{t('venueType')}</label>
              <select 
                className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold bg-white text-sm sm:text-base"
                value={formData.venueType}
                onChange={e => setFormData({ ...formData, venueType: e.target.value })}
              >
                {VENUE_TYPES.map(v => (
                  <option key={v} value={v}>{venueLabel(v)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1 sm:mb-2">{t('country')}</label>
              <select 
                className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold bg-white text-sm sm:text-base"
                value={formData.country}
                onChange={handleCountryChange}
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1 sm:mb-2">{t('city')}</label>
              <input 
                type="text" 
                className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                required 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1 sm:mb-2">{t('currency')}</label>
              <select 
                className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold bg-white text-sm sm:text-base"
                value={formData.currencyCode}
                onChange={handleCurrencyChange}
                required
              >
                {CURRENCY_OPTIONS.map(o => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1 sm:mb-2">{t('preferredLanguage')}</label>
              <select 
                className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold bg-white text-sm sm:text-base"
                value={formData.language}
                onChange={e => setFormData({ ...formData, language: e.target.value as Language })}
              >
                <option value="en">{t('langEnglish')}</option>
                <option value="fr">{t('langFrench')}</option>
                <option value="nl">{t('langDutch')}</option>
                <option value="fl">{t('langFlemish')}</option>
                <option value="es">{t('langSpanish')}</option>
                <option value="it">{t('langItalian')}</option>
                <option value="de">{t('langGerman')}</option>
                <option value="ar">{t('langArabic')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-bakery-beige">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1 sm:mb-2">{t('password')}</label>
              <input 
                type="password" 
                className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                required 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1 sm:mb-2">{t('confirmPassword')}</label>
              <input 
                type="password" 
                className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                value={formData.confirmPassword}
                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                required 
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full p-4 sm:p-5 rounded-2xl font-bold text-lg sm:text-xl shadow-lg active:scale-95 transition-all">
            {t('register')}
          </button>
        </form>
      </div>
    </div>
  );
};
