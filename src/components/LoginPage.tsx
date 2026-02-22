
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { ArrowLeft } from 'lucide-react';
import { ShiftLog } from '../types';

export const LoginPage = ({ onBack }: { onBack: () => void }) => {
  const { t, users, setUser, setShiftLogs, shiftLogs, addToast } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = users.find(u => u.username === username && u.password === password);
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
      addToast(`Welcome back, ${foundUser.username}!`);
    } else {
      addToast("Invalid credentials", "error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bakery-beige/30 p-6">
      <div className="card-bakery w-full max-w-md p-10 animate-fade-in">
        <button onClick={onBack} className="text-bakery-brown/50 hover:text-bakery-brown mb-8 flex items-center gap-2 transition-colors">
          <ArrowLeft size={18} />
          <span className="font-bold">{t('cancel')}</span>
        </button>
        <div className="text-center mb-10">
          <span className="text-5xl mb-4 block">🧇</span>
          <h2 className="text-3xl font-black font-serif">{t('login')}</h2>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold mb-2">{t('username')}</label>
            <input 
              type="text" 
              className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel transition-all"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">{t('password')}</label>
            <input 
              type="password" 
              className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel transition-all"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold text-lg shadow-lg">
            {t('loginBtn')}
          </button>
        </form>
      </div>
    </div>
  );
};
