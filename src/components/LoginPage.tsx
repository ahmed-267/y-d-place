
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { ArrowLeft, Lock, Mail, Store, User } from 'lucide-react';
import { ShiftLog } from '../types';

export const LoginPage = ({ onBack }: { onBack: () => void }) => {
  const { t, users, setUser, setShiftLogs, shiftLogs, addToast, loginToBusiness } = useApp();
  const [mode, setMode] = useState<'owner' | 'staff'>('staff');
  const [restaurantName, setRestaurantName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    const bizLoginSuccess = loginToBusiness({
      mode,
      restaurantName: restaurantName.trim(),
      identifier: identifier.trim(),
      password
    });

    if (bizLoginSuccess) return;

    const foundUser = users.find(u => u.username === identifier && u.password === password);
    if (foundUser) {
      const newLog: ShiftLog = {
        id: Date.now(),
        username: foundUser.username,
        fullName: foundUser.fullName,
        role: foundUser.role,
        loginTime: Date.now(),
        logoutTime: null,
        ordersProcessed: 0
      };
      setShiftLogs([...shiftLogs, newLog]);
      setUser(foundUser);
      addToast(t('welcomeBack').replace('{name}', foundUser.username));
    } else {
      addToast(t('invalidCredentials'), "error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bakery-beige/30 p-4 sm:p-6">
      <div className="card-bakery w-full max-w-md p-6 sm:p-10 animate-fade-in">
        <button onClick={onBack} className="text-bakery-brown/50 hover:text-bakery-brown mb-6 sm:mb-8 flex items-center gap-2 transition-colors">
          <ArrowLeft size={18} />
          <span className="font-bold text-sm sm:text-base">{t('cancel')}</span>
        </button>
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-bakery-brown rounded-2xl flex items-center justify-center text-white mx-auto mb-4">
            <Lock size={28} className="sm:w-8 sm:h-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black font-serif">{t('loginTitle')}</h2>
        </div>
        <div className="flex items-center gap-2 bg-bakery-beige/40 p-1 rounded-2xl mb-6">
          <button
            onClick={() => setMode('owner')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold ${mode === 'owner' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'}`}
            type="button"
          >
            {t('ownerLogin')}
          </button>
          <button
            onClick={() => setMode('staff')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold ${mode === 'staff' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'}`}
            type="button"
          >
            {t('staffLogin')}
          </button>
        </div>
        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
          <div>
            <label className="block text-sm font-bold mb-2">{t('restaurantName')}</label>
            <div className="relative">
              <Store size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" />
              <input 
                type="text"
                className="w-full pl-10 pr-4 py-3 sm:py-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel transition-all text-sm sm:text-base"
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">{mode === 'owner' ? t('ownerEmail') : t('staffUsername')}</label>
            <div className="relative">
              {mode === 'owner' ? (
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" />
              ) : (
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" />
              )}
              <input 
                type={mode === 'owner' ? 'email' : 'text'}
                className="w-full pl-10 pr-4 py-3 sm:py-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel transition-all text-sm sm:text-base"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">{t('password')}</label>
            <input 
              type="password" 
              className="w-full p-3 sm:p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel transition-all text-sm sm:text-base"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full p-3 sm:p-4 rounded-2xl font-bold text-base sm:text-lg shadow-lg active:scale-95">
            {t('loginBtn')}
          </button>
        </form>
      </div>
    </div>
  );
};
