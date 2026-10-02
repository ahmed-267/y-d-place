import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '../AppContext';
import { supabase } from './supabaseClient';
import { AuthShell, authFieldClassName, authPrimaryButtonClassName } from './AuthShell';
import { AuthDestination } from '../utils/authRouting';
import { isNetworkAuthError } from '../utils/localAccounts';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { isPasswordStrongEnough } from '../utils/passwordStrength';

type RegistrationFormProps = {
  onBack: () => void;
  onGoLogin: () => void;
  onAuthenticated: (destination: AuthDestination) => void;
};

const deriveProfileFromEmail = (email: string) => {
  const local = email.split('@')[0] || 'owner';
  const username = local.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 24) || 'owner';
  const fullName =
    local
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim() || 'Owner';
  return { username, fullName };
};

export const RegistrationForm = ({ onBack, onGoLogin, onAuthenticated }: RegistrationFormProps) => {
  const { addToast, t } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const handleResend = async () => {
    if (!pendingEmail) return;
    setIsResending(true);
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: pendingEmail });
      if (resendError) {
        const message = isNetworkAuthError(resendError) ? t('authOffline') : resendError.message;
        addToast(message, 'error');
      } else {
        addToast(t('confirmationSent'), 'success');
      }
    } catch (err) {
      addToast(isNetworkAuthError(err) ? t('authOffline') : 'Could not resend email.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordStrongEnough(password)) {
      const message = t('passwordTooWeak');
      setError(message);
      addToast(message, 'error');
      return;
    }
    if (password !== confirmPassword) {
      const message = t('passwordsDoNotMatch');
      setError(message);
      addToast(message, 'error');
      return;
    }

    setIsSubmitting(true);
    const trimmedEmail = email.trim().toLowerCase();
    const { username, fullName } = deriveProfileFromEmail(trimmedEmail);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: fullName,
            username,
          },
        },
      });

      if (authError) {
        const message = isNetworkAuthError(authError) ? t('authOffline') : (authError.message || 'Registration failed.');
        setError(message);
        addToast(message, 'error');
        return;
      }

      if (data.session?.user) {
        onAuthenticated('onboarding');
        return;
      }

      setPendingEmail(trimmedEmail);
    } catch (err) {
      const message = isNetworkAuthError(err)
        ? t('authOffline')
        : err instanceof Error
          ? err.message
          : 'Registration failed.';
      setError(message);
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pendingEmail) {
    return (
      <AuthShell onBackHome={onBack}>
        <div className="mb-7">
          <h1 className="text-2xl sm:text-[1.75rem] font-black font-serif tracking-tight text-bakery-brown">
            {t('checkYourEmail')}
          </h1>
          <p className="mt-2 text-sm text-bakery-brown/55 leading-relaxed">
            {t('checkYourEmailBody').replace('{email}', pendingEmail)}
          </p>
        </div>
        <button
          type="button"
          disabled={isResending}
          onClick={handleResend}
          className={`${authPrimaryButtonClassName} mt-2`}
        >
          {isResending ? <Loader2 size={18} className="animate-spin" /> : null}
          {t('resendConfirmation')}
        </button>
        <p className="mt-6 text-center text-sm text-bakery-brown/50">
          <button
            type="button"
            onClick={onGoLogin}
            className="font-bold text-bakery-brown hover:text-bakery-caramel transition-colors"
          >
            {t('signIn')}
          </button>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell onBackHome={onBack}>
      <div className="mb-7">
        <h1 className="text-2xl sm:text-[1.75rem] font-black font-serif tracking-tight text-bakery-brown">
          {t('createAnAccount')}
        </h1>
        <p className="mt-2 text-sm text-bakery-brown/55 leading-relaxed">
          {t('createAccountSubtitle')}
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
          <label htmlFor="register-email" className="mb-1.5 block text-sm font-bold text-bakery-brown">
            {t('email')}
          </label>
          <input
            id="register-email"
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
          <label htmlFor="register-password" className="mb-1.5 block text-sm font-bold text-bakery-brown">
            {t('password')}
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={authFieldClassName}
            placeholder={t('passwordMinHint')}
          />
          <PasswordStrengthMeter password={password} t={t} />
        </div>

        <div>
          <label htmlFor="register-confirm-password" className="mb-1.5 block text-sm font-bold text-bakery-brown">
            {t('confirmPassword')}
          </label>
          <input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className={authFieldClassName}
            placeholder={t('passwordMinHint')}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !isPasswordStrongEnough(password)}
          className={`${authPrimaryButtonClassName} mt-2`}
        >
          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
          {t('createAccount')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-bakery-brown/50">
        {t('alreadyHaveAccount')}{' '}
        <button
          type="button"
          onClick={onGoLogin}
          className="font-bold text-bakery-brown hover:text-bakery-caramel transition-colors"
        >
          {t('signIn')}
        </button>
      </p>
    </AuthShell>
  );
};
