import React from 'react';
import { evaluatePasswordStrength } from '../utils/passwordStrength';

type Props = {
  password: string;
  t: (key: string) => string;
};

const BAR_COLORS = [
  'bg-transparent',
  'bg-rose-500',
  'bg-amber-500',
  'bg-lime-600',
  'bg-emerald-600',
];

const LABEL_COLORS = [
  'text-bakery-brown/40',
  'text-rose-600',
  'text-amber-700',
  'text-lime-700',
  'text-emerald-700',
];

export const PasswordStrengthMeter = ({ password, t }: Props) => {
  const strength = evaluatePasswordStrength(password);
  const score = password ? strength.score : 0;

  return (
    <div className="mt-2 space-y-1.5" aria-live="polite">
      <div className="flex gap-1" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-label={t('passwordStrength')}>
        {[1, 2, 3, 4].map(level => (
          <div
            key={level}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              score >= level ? BAR_COLORS[score] : 'bg-bakery-beige'
            }`}
          />
        ))}
      </div>
      {password ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className={`text-xs font-bold ${LABEL_COLORS[score]}`}>
            {t(strength.labelKey)}
            {!strength.ok ? ` — ${t('passwordStrengthRequired')}` : ''}
          </p>
        </div>
      ) : null}
      {password && !strength.ok && strength.tips.length > 0 ? (
        <ul className="text-[11px] text-bakery-brown/45 space-y-0.5 list-disc pl-4">
          {strength.tips.map(tip => (
            <li key={tip}>{t(tip)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
