/** Password strength 0–4. Acceptable at score >= MIN_ACCEPTABLE_SCORE. */
export const MIN_ACCEPTABLE_SCORE = 3;

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  labelKey: 'passwordStrengthEmpty' | 'passwordStrengthWeak' | 'passwordStrengthFair' | 'passwordStrengthGood' | 'passwordStrengthStrong';
  ok: boolean;
  tips: string[];
};

const COMMON = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'abc12345',
  'letmein1',
  'welcome1',
  'admin123',
  'iloveyou',
  'previsio',
]);

const scoreLabel = (score: 0 | 1 | 2 | 3 | 4): PasswordStrength['labelKey'] => {
  if (score <= 0) return 'passwordStrengthEmpty';
  if (score === 1) return 'passwordStrengthWeak';
  if (score === 2) return 'passwordStrengthFair';
  if (score === 3) return 'passwordStrengthGood';
  return 'passwordStrengthStrong';
};

export const evaluatePasswordStrength = (password: string): PasswordStrength => {
  if (!password) {
    return { score: 0, labelKey: 'passwordStrengthEmpty', ok: false, tips: [] };
  }

  const tips: string[] = [];
  let points = 0;

  const length = password.length;
  if (length >= 8) points += 1;
  else tips.push('passwordTipLength');
  if (length >= 12) points += 1;
  if (length >= 16) points += 0.5;

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (hasLower && hasUpper) points += 1;
  else tips.push('passwordTipCase');

  if (hasDigit) points += 0.75;
  else tips.push('passwordTipNumber');

  if (hasSymbol) points += 1;
  else tips.push('passwordTipSymbol');

  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password) || /^(012|123|234|345|456|567|678|789|890|abc|qwe)/i.test(password)) {
    points = Math.min(points, 1);
    tips.push('passwordTipCommon');
  }

  let score: 0 | 1 | 2 | 3 | 4;
  if (points < 2) score = 1;
  else if (points < 3.25) score = 2;
  else if (points < 4.5) score = 3;
  else score = 4;

  // Hard floor: under 8 chars can never be accepted
  if (length < 8) {
    score = Math.min(score, 1) as 0 | 1 | 2 | 3 | 4;
  }

  return {
    score,
    labelKey: scoreLabel(score),
    ok: score >= MIN_ACCEPTABLE_SCORE && length >= 8,
    tips: tips.slice(0, 3),
  };
};

export const isPasswordStrongEnough = (password: string) => evaluatePasswordStrength(password).ok;
