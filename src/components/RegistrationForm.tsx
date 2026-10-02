import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '../AppContext';
import { supabase } from './supabaseClient';
import { AuthShell, authFieldClassName, authPrimaryButtonClassName } from './AuthShell';
import { AuthDestination, resolvePostAuthDestination } from '../utils/authRouting';
import { isNetworkAuthError } from '../utils/localAccounts';

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
  const { addToast, registerAccount, t } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      const message = t('passwordMinError');
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
          data: {
            full_name: fullName,
            username,
          },
        },
      });

      if (!authError) {
        if (data.session?.user) {
          addToast('Account created successfully.', 'success');
          const destination = await resolvePostAuthDestination(data.session.user.id);
          onAuthenticated(destination);
          return;
        }

        // Email confirmation required — try immediate sign-in, else tell user
        const signIn = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (!signIn.error && signIn.data.user) {
          addToast('Account created successfully.', 'success');
          const destination = await resolvePostAuthDestination(signIn.data.user.id);
          onAuthenticated(destination);
          return;
        }

        addToast('Account created. Please confirm your email, then sign in.', 'info');
        onGoLogin();
        return;
      }

      if (isNetworkAuthError(authError)) {
        const { error: localError } = await registerAccount({
          fullName,
          username,
          email: trimmedEmail,
          password,
        });
        if (!localError) {
          onAuthenticated('onboarding');
        } else {
          const message =
            typeof localError === 'object' && localError && 'message' in localError
              ? String((localError as { message?: string }).message)
              : 'Registration failed.';
          setError(message);
        }
        return;
      }

      const message = authError.message || 'Registration failed.';
      setError(message);
      addToast(message, 'error');
    } catch (err) {
      if (isNetworkAuthError(err)) {
        const { error: localError } = await registerAccount({
          fullName,
          username,
          email: trimmedEmail,
          password,
        });
        if (!localError) {
          onAuthenticated('onboarding');
          return;
        }
      }
      const message = err instanceof Error ? err.message : 'Registration failed.';
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
            minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={authFieldClassName}
            placeholder={t('passwordMinHint')}
          />
        </div>

        <button type="submit" disabled={isSubmitting} className={`${authPrimaryButtonClassName} mt-2`}>
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
