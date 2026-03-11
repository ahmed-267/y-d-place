import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './AppContext';
import { LoginPage } from './components/LoginPage';
import { WelcomeScreen } from './components/WelcomeScreen';
import { RegistrationForm } from './components/RegistrationForm';
import { OnboardingWizard } from './components/OnboardingWizard';
import { Dashboard } from './components/Dashboard';
import { Toast } from './components/Toast';

const AppContent = () => {
  const { user, isOnboarding } = useApp();
  const [view, setView] = useState<'login' | 'dashboard' | 'welcome' | 'register' | 'onboarding'>(user ? (isOnboarding ? 'onboarding' : 'dashboard') : 'welcome');

  useEffect(() => {
    if (user) {
      if (isOnboarding) {
        setView('onboarding');
      } else {
        setView('dashboard');
      }
    } else if (view === 'dashboard' || view === 'onboarding') {
      setView('welcome');
    }
  }, [user, isOnboarding, view]);

  return (
    <div className="min-h-screen">
      {view === 'welcome' && <WelcomeScreen onLogin={() => setView('login')} onRegister={() => setView('register')} />}
      {view === 'register' && <RegistrationForm onBack={() => setView('welcome')} />}
      {view === 'login' && <LoginPage onBack={() => setView('welcome')} />}
      {view === 'onboarding' && <OnboardingWizard />}
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