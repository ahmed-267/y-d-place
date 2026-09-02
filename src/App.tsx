import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './AppContext';
import { LoginPage } from './components/LoginPage';
import { WelcomeScreen } from './components/WelcomeScreen';
import { RegistrationForm } from './components/RegistrationForm';
import { Dashboard } from './components/Dashboard';
import { GeneratedRestaurantLanding } from './components/GeneratedRestaurantLanding';
import { Toast } from './components/Toast';
import { Loader2 } from 'lucide-react';

type AppView = 'login' | 'dashboard' | 'welcome' | 'register' | 'publicLanding' | 'onboarding';
type AuthDestination = 'dashboard' | 'onboarding';

const AppContent = () => {
  const { user, isSessionLoading, isOnboarding, businessSettings } = useApp();
  const initialView = (): AppView => {
    const path = window.location.pathname;
    if (path === '/public-site' || path.startsWith('/restaurant/')) return 'publicLanding';
    if (path === '/dashboard') return 'dashboard';
    if (path === '/onboarding') return 'onboarding';
    if (path === '/login') return 'login';
    if (path === '/register') return 'register';
    return 'welcome';
  };
  const [view, setView] = useState<AppView>(initialView);
  /** Holds post-auth target until AppContext finishes hydrating the session. */
  const [pendingAuthRoute, setPendingAuthRoute] = useState<AuthDestination | null>(null);

  useEffect(() => {
    if (isSessionLoading) return;

    if (user) {
      if (pendingAuthRoute) {
        setView(pendingAuthRoute);
        setPendingAuthRoute(null);
        return;
      }
      if (isOnboarding) {
        if (view !== 'onboarding' && view !== 'publicLanding') setView('onboarding');
      } else if (view === 'welcome' || view === 'register' || view === 'login' || view === 'onboarding') {
        setView('dashboard');
      }
      return;
    }

    if (pendingAuthRoute) return; // wait for onAuthStateChange to attach the user

    if (view === 'dashboard' || view === 'onboarding') {
      setView('welcome');
    }
  }, [user, view, isSessionLoading, isOnboarding, pendingAuthRoute]);

  const goAuthenticated = (destination: AuthDestination) => {
    setPendingAuthRoute(destination);
    setView(destination);
    window.history.replaceState(null, '', destination === 'dashboard' ? '/dashboard' : '/onboarding');
  };

  useEffect(() => {
    const pathByView: Record<AppView, string> = {
      welcome: '/',
      login: '/login',
      register: '/register',
      onboarding: '/onboarding',
      dashboard: '/dashboard',
      publicLanding: businessSettings?.id ? `/restaurant/${businessSettings.id}` : '/public-site',
    };
    const target = pathByView[view];
    if (window.location.pathname !== target) {
      window.history.replaceState(null, '', target);
    }
  }, [view, businessSettings?.id]);

  if (isSessionLoading) {
    return (
      <div className="min-h-screen bg-bakery-cream flex items-center justify-center">
        <Loader2 className="animate-spin text-bakery-brown" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {view === 'welcome' && (
        <WelcomeScreen onLogin={() => setView('login')} onRegister={() => setView('register')} />
      )}
      {view === 'register' && (
        <RegistrationForm
          onBack={() => setView('welcome')}
          onGoLogin={() => setView('login')}
          onAuthenticated={goAuthenticated}
        />
      )}
      {view === 'onboarding' && <Dashboard />}
      {view === 'login' && (
        <LoginPage
          onBack={() => setView('welcome')}
          onGoRegister={() => setView('register')}
          onAuthenticated={goAuthenticated}
        />
      )}
      {view === 'publicLanding' && (
        <GeneratedRestaurantLanding onManageBusiness={() => setView(user ? 'dashboard' : 'welcome')} />
      )}
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
