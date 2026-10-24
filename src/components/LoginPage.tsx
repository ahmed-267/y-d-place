import { PasswordInput } from './PasswordInput';
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '../AppContext';
import { supabase } from './supabaseClient';
import { AuthShell, authFieldClassName, authPrimaryButtonClassName } from './AuthShell';
import { AuthDestination } from '../utils/authRouting';
import { isNetworkAuthError } from '../utils/localAccounts';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { isPasswordStrongEnough } from '../utils/passwordStrength';

const REMEMBER_EMAIL_KEY = 'previsio_remember_email';

type LoginPageProps = {
  onBack: () => void;
  onGoRegister: () => void;
  onAuthenticated: (destination: AuthDestination) => void;
};

const isUnconfirmed = (message?: string) =>
  (message || '').toLowerCase().includes('email not confirmed');

export const LoginPage = ({ onBack, onGoRegister, onAuthenticated }: LoginPageProps) => {
  const { addToast, login, t, isPasswordRecovery, completePasswordRecovery } = useApp();
  const [mode, setMode] = useState<'owner' | 'staff'>('owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

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

  const handleForgotPassword = async () => {
    setError(null);
    if (!email.trim()) {
      setError(t('enterEmailForReset'));
      addToast(t('enterEmailForReset'), 'error');
      return;
    }
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (resetError) {
        addToast(isNetworkAuthError(resetError) ? t('authOffline') : resetError.message, 'error');
        return;
      }
      addToast(t('checkYourEmail'), 'success');
    } catch (err) {
      addToast(isNetworkAuthError(err) ? t('authOffline') : (err instanceof Error ? err.message : 'Could not send reset email.'), 'error');
    }
  };

  const handleResendConfirmation = async () => {
    const target = unconfirmedEmail || email.trim();
    if (!target) return;
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: target, options: { emailRedirectTo: `${window.location.origin}/login` } });
      if (resendError) {
        addToast(isNetworkAuthError(resendError) ? t('authOffline') : resendError.message, 'error');
        return;
      }
      addToast(t('confirmationSent'), 'success');
    } catch (err) {
      addToast(isNetworkAuthError(err) ? t('authOffline') : 'Could not resend email.', 'error');
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isPasswordStrongEnough(newPassword)) {
      setError(t('passwordTooWeak'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
        addToast(updateError.message, 'error');
        return;
      }
      completePasswordRecovery();
      await supabase.auth.signOut();
      setPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      addToast(t('passwordUpdated'), 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update password.';
      setError(message);
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnconfirmedEmail(null);
    setIsSubmitting(true);

    try {
      const trimmedEmail = email.trim();
      if (rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, trimmedEmail);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      await login({ identifier: trimmedEmail, password, mode });
      // AppContext loads the profile and App routes only once that succeeds.
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Sign in failed.';
      if (isUnconfirmed(raw)) setUnconfirmedEmail(email.trim());
      const message = isUnconfirmed(raw) ? t('confirmEmailToSignIn') : isNetworkAuthError(err) ? t('authOffline') : raw;
      setError(message);
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPasswordRecovery) {
    return (
      <AuthShell onBackHome={onBack}>
        <div className="mb-7">
          <h1 className="text-2xl sm:text-[1.75rem] font-black font-serif tracking-tight text-bakery-brown">
            {t('setNewPassword')}
          </h1>
          <p className="mt-2 text-sm text-bakery-brown/55 leading-relaxed">
            {t('setNewPasswordHint')}
          </p>
        </div>
        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-600">
            {error}
          </div>
        )}
        <form onSubmit={handleRecoverySubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-bold text-bakery-brown">
              {t('password')}
            </label>
            <PasswordInput
              id="new-password"

              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className={authFieldClassName}
              placeholder={t('passwordMinHint')}
            />
            <PasswordStrengthMeter password={newPassword} t={t} />
          </div>
          <div>
            <label htmlFor="confirm-new-password" className="mb-1.5 block text-sm font-bold text-bakery-brown">
              {t('confirmPassword')}
            </label>
            <PasswordInput
              id="confirm-new-password"

              autoComplete="new-password"
              required
              minLength={8}
              value={confirmNewPassword}
              onChange={e => setConfirmNewPassword(e.target.value)}
              className={authFieldClassName}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !isPasswordStrongEnough(newPassword)}
            className={`${authPrimaryButtonClassName} mt-2`}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            {t('saveNewPassword')}
          </button>
        </form>
      </AuthShell>
    );
  }

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

      {unconfirmedEmail && (
        <button
          type="button"
          onClick={handleResendConfirmation}
          className="mb-4 w-full text-sm font-bold text-bakery-caramel hover:text-bakery-brown"
        >
          {t('resendConfirmation')}
        </button>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div>
          <label htmlFor="login-password" className="mb-1.5 block text-sm font-bold text-bakery-brown">
            {t('password') || 'Password'}
          </label>
          <PasswordInput
            id="login-password"

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

        {mode === 'staff' && (
          <p className="text-xs text-bakery-brown/45">
            Staff sign in with the email from their invite.
          </p>
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
