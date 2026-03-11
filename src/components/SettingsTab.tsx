
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { COUNTRIES, CURRENCIES, VENUE_TYPES, CURRENCY_OPTIONS } from '../constants';
import { BusinessSettings, Language } from '../types';
import { Save, Building2, Globe, Coins, Languages } from 'lucide-react';

export const SettingsTab = () => {
  const { t, businessSettings, setBusinessSettings, addToast } = useApp();
  
  const [formData, setFormData] = useState<BusinessSettings>(businessSettings || {
    id: '',
    name: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    venueType: '',
    country: '',
    city: '',
    currencyCode: '',
    currencySymbol: '',
    language: 'en'
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setBusinessSettings(formData);
    addToast("Settings updated successfully!");
  };

  const handleCountryChange = (countryCode: string) => {
    const currency = CURRENCIES[countryCode] || CURRENCIES['US'];
    setFormData({
      ...formData,
      country: countryCode,
      currencyCode: currency.code,
      currencySymbol: currency.symbol
    });
  };

  const handleCurrencyChange = (code: string) => {
    const currency = CURRENCY_OPTIONS.find(c => c.code === code);
    if (currency) {
      setFormData({
        ...formData,
        currencyCode: currency.code,
        currencySymbol: currency.symbol
      });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10 max-w-full overflow-hidden">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black font-serif text-bakery-brown">{t('businessSettings')}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="card-bakery p-4 sm:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Business Info */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-bakery-caramel mb-2">
                  <Building2 size={20} />
                  <h3 className="font-black uppercase tracking-widest text-sm">{t('overview')}</h3>
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
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-bakery-caramel mb-2">
                  <Globe size={20} />
                  <h3 className="font-black uppercase tracking-widest text-sm">{t('country')} & {t('city')}</h3>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('country')}</label>
                  <select 
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold bg-white text-sm sm:text-base"
                    value={formData.country}
                    onChange={e => handleCountryChange(e.target.value)}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('city')}</label>
                  <input 
                    type="text" 
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold text-sm sm:text-base"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    required 
                  />
                </div>
              </div>

              {/* Currency */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-bakery-caramel mb-2">
                  <Coins size={20} />
                  <h3 className="font-black uppercase tracking-widest text-sm">{t('currency')}</h3>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('currency')}</label>
                  <select 
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold bg-white text-sm sm:text-base"
                    value={formData.currencyCode}
                    onChange={e => handleCurrencyChange(e.target.value)}
                  >
                    {CURRENCY_OPTIONS.map(c => (
                      <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Language */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-bakery-caramel mb-2">
                  <Languages size={20} />
                  <h3 className="font-black uppercase tracking-widest text-sm">{t('preferredLanguage')}</h3>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('preferredLanguage')}</label>
                  <select 
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold bg-white text-sm sm:text-base"
                    value={formData.language}
                    onChange={e => setFormData({ ...formData, language: e.target.value as Language })}
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="nl">Nederlands</option>
                    <option value="fl">Vlaams</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-bakery-beige">
              <button type="submit" className="btn-primary w-full md:w-auto px-10 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-sm sm:text-base">
                <Save size={20} />
                {t('updateSettings')}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="card-bakery p-6 bg-bakery-accent/10 border-bakery-accent/30">
            <h3 className="font-black uppercase tracking-widest text-xs text-bakery-brown/60 mb-4 italic">Owner Information</h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('ownerFullName')}</p>
                <p className="font-bold text-sm sm:text-base">{formData.ownerName}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('ownerEmail')}</p>
                <p className="font-bold text-sm sm:text-base break-all">{formData.ownerEmail}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('ownerPhone')}</p>
                <p className="font-bold text-sm sm:text-base">{formData.ownerPhone}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};