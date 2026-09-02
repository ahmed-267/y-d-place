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
  const { addToast, login } = useApp();
  const [email, setEmail] = useState('');
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

    const trimmedEmail = email.trim();

    try {
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
        addToast('Welcome back.', 'success');
        await finishAuth(data.user.id);
        return;
      }

      // Cloud rejected or unreachable — try local / demo owner accounts
      try {
        await login({ identifier: trimmedEmail, password, mode: 'owner' });
        addToast('Welcome back.', 'success');
        // Local/demo hydrate synchronously; App routing effect sends them onward.
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
        <h1 className="text-2xl sm:text-[1.75rem] font-black font-serif tracking-tight text-bakery-brown">Welcome back</h1>
        <p className="mt-2 text-sm text-bakery-brown/55 leading-relaxed">
          Sign in to your PreVisio management portal
        </p>
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
        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-sm font-bold text-bakery-brown">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={authFieldClassName}
            placeholder="you@restaurant.com"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1.5 block text-sm font-bold text-bakery-brown">
            Password
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

        <div className="flex items-center justify-between gap-3 pt-0.5">
          <label className="inline-flex items-center gap-2 text-sm text-bakery-brown/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-bakery-beige text-bakery-brown focus:ring-bakery-caramel/40"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm font-bold text-bakery-caramel hover:text-bakery-brown transition-colors"
          >
            Forgot password?
          </button>
        </div>

        <button type="submit" disabled={isSubmitting} className={`${authPrimaryButtonClassName} mt-2`}>
          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-bakery-brown/50">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={onGoRegister}
          className="font-bold text-bakery-brown hover:text-bakery-caramel transition-colors"
        >
          Create account
        </button>
      </p>
    </AuthShell>
  );
};
