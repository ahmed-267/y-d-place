import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './AppContext';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { Toast } from './components/Toast';

const AppContent = () => {
  const { user } = useApp();
  const [view, setView] = useState<'landing' | 'login' | 'dashboard'>('landing');

  useEffect(() => {
    if (user) {
      setView('dashboard');
    } else if (view === 'dashboard') {
      setView('landing');
    }
  }, [user, view]);

  return (
    <div className="min-h-screen">
      {view === 'landing' && <LandingPage onLoginClick={() => setView('login')} />}
      {view === 'login' && <LoginPage onBack={() => setView('landing')} />}
      {view === 'dashboard' && <Dashboard />}
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
