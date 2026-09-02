import { BusinessSettings, Language, User, normalizeEnabledModules } from '../types';

export const LOCAL_ACCOUNTS_KEY = 'previsio_local_accounts';
export const LOCAL_SESSION_KEY = 'previsio_local_session';

export type LocalAccount = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  password: string;
  business: BusinessSettings | null;
  setupCompleted: boolean;
  createdAt: number;
};

export type LocalSession = {
  accountId: string;
};

export const isLocalBusinessId = (id?: string | null) =>
  !!id && (id.startsWith('local-') || id === 'local');

export const isNetworkAuthError = (error: unknown) => {
  if (!error) return false;
  const msg = (
    typeof error === 'string'
      ? error
      : (error as { message?: string }).message || String(error)
  ).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('fetch failed') ||
    msg.includes('err_name_not_resolved') ||
    msg.includes('could not resolve')
  );
};

export const loadLocalAccounts = (): LocalAccount[] => {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveLocalAccounts = (accounts: LocalAccount[]) => {
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
};

export const findLocalAccount = (identifier: string, password?: string) => {
  const needle = identifier.trim().toLowerCase();
  return loadLocalAccounts().find((account) => {
    const match =
      account.email.toLowerCase() === needle ||
      account.username.toLowerCase() === needle;
    if (!match) return false;
    if (password == null) return true;
    return account.password === password;
  });
};

export const upsertLocalAccount = (account: LocalAccount) => {
  const accounts = loadLocalAccounts();
  const idx = accounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) accounts[idx] = account;
  else accounts.push(account);
  saveLocalAccounts(accounts);
  return account;
};

export const createLocalAccount = (payload: {
  fullName: string;
  username: string;
  email: string;
  password: string;
}): LocalAccount => {
  const email = payload.email.trim().toLowerCase();
  const username = payload.username.trim();
  if (findLocalAccount(email) || findLocalAccount(username)) {
    throw new Error('An account with this email or username already exists on this device.');
  }

  const account: LocalAccount = {
    id: `local-user-${Date.now()}`,
    email,
    username,
    fullName: payload.fullName.trim(),
    password: payload.password,
    business: null,
    setupCompleted: false,
    createdAt: Date.now(),
  };
  upsertLocalAccount(account);
  return account;
};

export const setLocalSession = (accountId: string) => {
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ accountId } satisfies LocalSession));
};

export const clearLocalSession = () => {
  localStorage.removeItem(LOCAL_SESSION_KEY);
};

export const getLocalSession = (): LocalSession | null => {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalSession;
  } catch {
    clearLocalSession();
    return null;
  }
};

export const getLocalAccountById = (id: string) =>
  loadLocalAccounts().find((account) => account.id === id) || null;

export const localAccountToUser = (account: LocalAccount): User => ({
  id: Date.now(),
  email: account.email,
  username: account.username,
  fullName: account.fullName,
  role: 'owner',
  password: account.password,
});

export const buildLocalBusiness = (
  settings: Omit<BusinessSettings, 'id'>,
  account: LocalAccount
): BusinessSettings => ({
  id: `local-${Date.now()}`,
  name: settings.name,
  ownerName: settings.ownerName || account.fullName,
  ownerEmail: settings.ownerEmail || account.email,
  ownerPhone: settings.ownerPhone || '',
  venueType: settings.venueType,
  country: settings.country,
  city: settings.city,
  openingHours: settings.openingHours,
  currencyCode: settings.currencyCode || 'EUR',
  currencySymbol: settings.currencySymbol || '€',
  language: (settings.language as Language) || 'en',
  enabledModules: normalizeEnabledModules(settings.enabledModules),
  address: settings.address,
});
