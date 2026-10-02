import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '../AppContext';
import { supabase } from './supabaseClient';
import { AuthShell, authFieldClassName, authPrimaryButtonClassName } from './AuthShell';
import { AuthDestination, resolvePostAuthDestination } from '../utils/authRouting';
import { isNetworkAuthError } from '../utils/localAccounts';

const REMEMBER_EMAIL_KEY = 'previsio_remember_email';

type LoginPageProps = {
  onBack: () => void;
  onGoRegister: () => void;
  onAuthenticated: (destination: AuthDestination) => void;
};

export const LoginPage = ({ onBack, onGoRegister, onAuthenticated }: LoginPageProps) => {
  const { addToast, login, t } = useApp();
  const [mode, setMode] = useState<'owner' | 'staff'>('owner');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const finishAuth = async (userId: string | null | undefined) => {
    const destination = userId ? await resolvePostAuthDestination(userId) : 'onboarding';
    onAuthenticated(destination);
  };

  const handleForgotPassword = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email above, then click Forgot password.');
      addToast('Enter your email to reset your password.', 'error');
      return;
    }
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (resetError) {
        if (isNetworkAuthError(resetError)) {
          addToast('Password reset is unavailable offline. Try again when connected.', 'error');
        } else {
          addToast(resetError.message, 'error');
        }
        return;
      }
      addToast('Check your email for a password reset link.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not send reset email.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'staff') {
        await login({ identifier: username.trim(), password, mode: 'staff' });
        addToast(t('welcomeBack') || 'Welcome back.', 'success');
        onAuthenticated('dashboard');
        return;
      }

      const trimmedEmail = email.trim();
      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, trimmedEmail);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (!authError && data.user) {
        addToast(t('welcomeBack') || 'Welcome back.', 'success');
        await finishAuth(data.user.id);
        return;
      }

      try {
        await login({ identifier: trimmedEmail, password, mode: 'owner' });
        addToast(t('welcomeBack') || 'Welcome back.', 'success');
      } catch (localErr) {
        const message =
          localErr instanceof Error
            ? localErr.message
            : authError?.message || 'Invalid email or password.';
        setError(message);
        addToast(message, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed.';
      setError(message);
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell onBackHome={onBack}>
      <div className="mb-7">
        <h1 className="text-2xl sm:text-[1.75rem] font-black font-serif tracking-tight text-bakery-brown">
          {t('welcomeBack') || 'Welcome back'}
        </h1>
        <p className="mt-2 text-sm text-bakery-brown/55 leading-relaxed">
          {t('signInSubtitle')}
        </p>
      </div>

      <div className="flex gap-1 p-1 mb-5 rounded-xl bg-bakery-beige/40">
        <button
          type="button"
          onClick={() => { setMode('owner'); setError(null); }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === 'owner' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'}`}
        >
          {t('ownerLogin')}
        </button>
        <button
          type="button"
          onClick={() => { setMode('staff'); setError(null); }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === 'staff' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'}`}
        >
          {t('staffLogin')}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-600"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'owner' ? (
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-bold text-bakery-brown">
              {t('email')}
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={authFieldClassName}
              placeholder={t('emailPlaceholder')}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="login-username" className="mb-1.5 block text-sm font-bold text-bakery-brown">
              {t('staffUsername') || t('username') || 'Username'}
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className={authFieldClassName}
              placeholder="staff1"
            />
          </div>
        )}

        <div>
          <label htmlFor="login-password" className="mb-1.5 block text-sm font-bold text-bakery-brown">
            {t('password') || 'Password'}
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={authFieldClassName}
            placeholder="••••••••"
          />
        </div>

        {mode === 'owner' && (
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <label className="inline-flex items-center gap-2 text-sm text-bakery-brown/60 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-bakery-beige text-bakery-brown focus:ring-bakery-caramel/40"
              />
              {t('rememberMe')}
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm font-bold text-bakery-caramel hover:text-bakery-brown transition-colors"
            >
              {t('forgotPassword')}
            </button>
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className={`${authPrimaryButtonClassName} mt-2`}>
          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
          {t('signIn') || t('loginTitle') || 'Sign in'}
        </button>
      </form>

      {mode === 'owner' && (
        <p className="mt-6 text-center text-sm text-bakery-brown/50">
          {t('dontHaveAccount')}{' '}
          <button
            type="button"
            onClick={onGoRegister}
            className="font-bold text-bakery-caramel hover:text-bakery-brown"
          >
            {t('register')}
          </button>
        </p>
      )}
    </AuthShell>
  );
};
