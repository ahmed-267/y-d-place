import { Language } from '../types';

export type AppLanguageOption = {
  code: Language;
  labelKey: string;
  nativeLabel: string;
  flag: string;
};

/** Languages selectable in the UI (flags + dropdown). */
export const APP_LANGUAGE_OPTIONS: AppLanguageOption[] = [
  { code: 'en', labelKey: 'langEnglish', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'fr', labelKey: 'langFrench', nativeLabel: 'Français', flag: '🇫🇷' },
  { code: 'nl', labelKey: 'langDutch', nativeLabel: 'Nederlands', flag: '🇳🇱' },
  { code: 'fl', labelKey: 'langFlemish', nativeLabel: 'Vlaams', flag: '🇧🇪' },
  { code: 'es', labelKey: 'langSpanish', nativeLabel: 'Español', flag: '🇪🇸' },
  { code: 'it', labelKey: 'langItalian', nativeLabel: 'Italiano', flag: '🇮🇹' },
  { code: 'de', labelKey: 'langGerman', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', labelKey: 'langArabic', nativeLabel: 'العربية', flag: '🇸🇦' },
];

const APP_LANGUAGE_CODES = new Set(APP_LANGUAGE_OPTIONS.map(o => o.code));

export const isAppLanguage = (code: string | undefined | null): code is Language =>
  Boolean(code && APP_LANGUAGE_CODES.has(code as Language));

export const normalizeAppLanguage = (code: string | undefined | null): Language =>
  isAppLanguage(code) ? code : 'en';

export const getLanguageOption = (code: Language | string | undefined | null) =>
  APP_LANGUAGE_OPTIONS.find(o => o.code === code) || APP_LANGUAGE_OPTIONS[0];
