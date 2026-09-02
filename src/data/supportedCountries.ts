/** Countries supported for onboarding / tax in this phase. */
export const SUPPORTED_COUNTRIES = [
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'BE', name: 'Belgium' },
  { code: 'ES', name: 'Spain' },
] as const;

export type SupportedCountryCode = (typeof SUPPORTED_COUNTRIES)[number]['code'];

export const isSupportedCountry = (code: string | undefined | null): code is SupportedCountryCode =>
  Boolean(code && SUPPORTED_COUNTRIES.some((c) => c.code === code));
