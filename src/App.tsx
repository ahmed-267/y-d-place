import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './AppContext';
import { LoginPage } from './components/LoginPage';
import { WelcomeScreen } from './components/WelcomeScreen';
import { RegistrationForm } from './components/RegistrationForm';
import { Dashboard } from './components/Dashboard';
import { GeneratedRestaurantLanding } from './components/GeneratedRestaurantLanding';
import { PublicOrderPage } from './components/PublicOrderPage';
import { NotFoundPage } from './components/NotFoundPage';
import { Toast } from './components/Toast';
import { Loader2 } from 'lucide-react';

type AppView = 'login' | 'dashboard' | 'welcome' | 'register' | 'publicLanding' | 'onboarding' | 'publicOrder' | 'notFound';
type AuthDestination = 'dashboard' | 'onboarding';

const orderBusinessIdFromPath = () => {
  const m = window.location.pathname.match(/^\/order\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

const isKnownPath = (path: string) => {
  if (path === '/' || path === '') return true;
  if (['/login', '/register', '/dashboard', '/onboarding', '/public-site'].includes(path)) return true;
  if (path.startsWith('/restaurant/')) return true;
  if (path.startsWith('/order/')) return true;
  return false;
};

const pathToView = (path: string): AppView => {
  if (!isKnownPath(path)) return 'notFound';
  if (path.startsWith('/order/')) return 'publicOrder';
  if (path === '/public-site' || path.startsWith('/restaurant/')) return 'publicLanding';
  if (path === '/dashboard') return 'dashboard';
  if (path === '/onboarding') return 'onboarding';
  if (path === '/login') return 'login';
  if (path === '/register') return 'register';
  return 'welcome';
};

const AppContent = () => {
  const { user, isSessionLoading, isOnboarding, businessSettings } = useApp();
  const [orderBizId, setOrderBizId] = useState<string | null>(() => orderBusinessIdFromPath());
  const [view, setView] = useState<AppView>(() => pathToView(window.location.pathname));
  const [pendingAuthRoute, setPendingAuthRoute] = useState<AuthDestination | null>(null);

  useEffect(() => {
    const syncFromLocation = () => {
      const path = window.location.pathname;
      setOrderBizId(orderBusinessIdFromPath());
      setView(pathToView(path));
    };
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, []);

  useEffect(() => {
    if (isSessionLoading) return;
    if (view === 'publicOrder' || view === 'publicLanding' || view === 'notFound') return;

    if (user) {
      if (pendingAuthRoute) {
        setView(pendingAuthRoute);
        setPendingAuthRoute(null);
        return;
      }
      if (isOnboarding) {
        if (view !== 'onboarding') setView('onboarding');
      } else if (view === 'welcome' || view === 'register' || view === 'login' || view === 'onboarding') {
        setView('dashboard');
      }
      return;
    }

    if (pendingAuthRoute) return;

    if (view === 'dashboard' || view === 'onboarding') {
      setView('welcome');
    }
  }, [user, view, isSessionLoading, isOnboarding, pendingAuthRoute]);

  const goAuthenticated = (destination: AuthDestination) => {
    setPendingAuthRoute(destination);
    setView(destination);
    window.history.replaceState(null, '', destination === 'dashboard' ? '/dashboard' : '/onboarding');
  };

  const goHome = () => {
    setView('welcome');
    window.history.pushState(null, '', '/');
  };

  useEffect(() => {
    if (view === 'notFound') return;
    if (view === 'publicOrder' && orderBizId) {
      const target = `/order/${orderBizId}`;
      if (window.location.pathname !== target) {
        window.history.replaceState(null, '', target);
      }
      return;
    }
    const pathByView: Record<Exclude<AppView, 'publicOrder' | 'notFound'>, string> = {
      welcome: '/',
      login: '/login',
      register: '/register',
      onboarding: '/onboarding',
      dashboard: '/dashboard',
      publicLanding: businessSettings?.id ? `/restaurant/${businessSettings.id}` : '/public-site',
    };
    if (view === 'publicOrder') return;
    const target = pathByView[view];
    if (window.location.pathname !== target) {
      window.history.replaceState(null, '', target);
    }
  }, [view, businessSettings?.id, orderBizId]);

  if (isSessionLoading && view !== 'publicOrder' && view !== 'notFound') {
    return (
      <div className="min-h-screen bg-bakery-cream flex items-center justify-center">
        <Loader2 className="animate-spin text-bakery-brown" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {view === 'notFound' && (
        <NotFoundPage
          path={window.location.pathname}
          onHome={goHome}
          onLogin={() => {
            setView('login');
            window.history.pushState(null, '', '/login');
          }}
        />
      )}
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
      {view === 'publicOrder' && orderBizId && (
        <PublicOrderPage
          businessId={orderBizId}
          onDone={() => {
            /* stay on page */
          }}
        />
      )}
      {view === 'publicOrder' && !orderBizId && (
        <NotFoundPage
          path={window.location.pathname}
          onHome={goHome}
          onLogin={() => {
            setView('login');
            window.history.pushState(null, '', '/login');
          }}
        />
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
