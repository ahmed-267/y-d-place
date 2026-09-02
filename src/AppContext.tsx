import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, Product, Ingredient, PreparedStock, Sale, Language, Expense, TaxSettings, WorkShift, BusinessSettings, Order, RotaShift, StaffAvailability, LandingPageConfig, ShiftLog, Role } from './types';
import { DEFAULT_USERS, TRANSLATIONS, DEFAULT_CATEGORIES } from './constants';
import { generateDemoData } from './utils/demoData';
import { supabase } from './components/supabaseClient';
import { createDemoLandingConfig } from './utils/demoLanding';
import { clearPersistedOps, loadPersistedOps, savePersistedOps } from './utils/opsPersistence';
import {
  DEMO_BUSINESS_ID,
  businessToRow,
  createDemoBusiness,
  expenseToRow,
  mapBusinessRow,
  mapExpenseRow,
  mapProductRow,
  mapSaleRow,
  mapUserRow,
  mapWorkShiftRow,
  workShiftToRow,
} from './utils/dbMappers';
import {
  buildLocalBusiness,
  clearLocalSession,
  createLocalAccount,
  findLocalAccount,
  getLocalAccountById,
  getLocalSession,
  isLocalBusinessId,
  isNetworkAuthError,
  localAccountToUser,
  setLocalSession,
  upsertLocalAccount,
} from './utils/localAccounts';
import { normalizeAppLanguage } from './utils/languages';

const LANDING_STORAGE_KEY = 'previsio_landing_page';
const DEMO_SESSION_KEY = 'previsio_demo_session';

interface AppContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
  tp: (product: Product | undefined) => string;
  tc: (category: string) => string;
  activeTab: string;
  setActiveTab: (tabId: string) => void;
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  addSale: (sale: Omit<Sale, 'id' | 'timestamp' | 'cashierFullName' | 'cashierUsername'>) => Promise<void>;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  preparedStock: PreparedStock[];
  setPreparedStock: React.Dispatch<React.SetStateAction<PreparedStock[]>>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  deleteSale: (saleId: string) => Promise<void>;
  updateSale: (sale: Sale) => Promise<void>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  workShifts: WorkShift[];
  setWorkShifts: React.Dispatch<React.SetStateAction<WorkShift[]>>;
  addWorkShift: (shift: Omit<WorkShift, 'id'>) => Promise<void>;
  updateWorkShift: (shift: WorkShift) => Promise<void>;
  deleteWorkShift: (shiftId: number | string) => Promise<void>;
  shiftLogs: ShiftLog[];
  setShiftLogs: React.Dispatch<React.SetStateAction<ShiftLog[]>>;
  rota: RotaShift[];
  setRota: React.Dispatch<React.SetStateAction<RotaShift[]>>;
  saveRota: (rota: RotaShift[]) => Promise<void>;
  staffAvailability: StaffAvailability[];
  setStaffAvailability: React.Dispatch<React.SetStateAction<StaffAvailability[]>>;
  taxSettings: TaxSettings;
  setTaxSettings: React.Dispatch<React.SetStateAction<TaxSettings>>;
  toasts: { id: number; message: string; type: 'success' | 'error' | 'info' }[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  logout: () => void;
  resetAllData: () => void;
  formatPrice: (amount: number, showCode?: boolean) => React.ReactNode;
  businessSettings: BusinessSettings | null;
  setBusinessSettings: React.Dispatch<React.SetStateAction<BusinessSettings | null>>;
  saveBusinessSettings: (settings: BusinessSettings) => Promise<void>;
  registerAccount: (payload: { fullName: string; username: string; email: string; password: string }) => Promise<{ error: any }>;
  provisionBusinessProfile: (settings: Omit<BusinessSettings, 'id'>) => Promise<{ error: any }>;
  isBusinessSetupCompleted: boolean;
  setIsBusinessSetupCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  login: (payload: { identifier: string; password: string; mode: 'owner' | 'staff' }) => Promise<void>;
  isFirstTime: boolean;
  isOnboarding: boolean;
  startOnboarding: () => void;
  completeOnboarding: () => void;
  loadDemoData: () => void;
  landingPageConfig: LandingPageConfig | null;
  setLandingPageConfig: React.Dispatch<React.SetStateAction<LandingPageConfig | null>>;
  hasLandingPage: boolean;
  isSessionLoading: boolean;
  isLoggingIn: boolean;
  isDemoMode: boolean;
  inviteStaff: (payload: { fullName: string; username: string; password: string; role: Role; email?: string }) => Promise<{ error: string | null; credentials?: { username: string; password: string } }>;
  ensureLandingForDemo: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
export { AppContext };

const findDemoUser = (identifier: string, password: string) =>
  DEFAULT_USERS.find(
    (u) =>
      (u.username === identifier || u.email === identifier) &&
      u.password === password
  );

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [businessSettings, setBusinessSettingsState] = useState<BusinessSettings | null>(null);
  const [lang, setLangState] = useState<Language>('en');
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [preparedStock, setPreparedStock] = useState<PreparedStock[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [shiftLogs, setShiftLogs] = useState<ShiftLog[]>([]);
  const [rota, setRota] = useState<RotaShift[]>([]);
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability[]>([]);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({ municipalTaxRate: 7, vatRegime: 'Standard' });
  const [landingPageConfig, setLandingPageConfigState] = useState<LandingPageConfig | null>(() => {
    try {
      const raw = localStorage.getItem(LANDING_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as LandingPageConfig) : null;
    } catch {
      return null;
    }
  });

  const ensureLandingForDemo = useCallback(() => {
    setLandingPageConfigState((prev) => {
      if (prev) return prev;
      const demo = createDemoLandingConfig();
      try {
        localStorage.setItem(LANDING_STORAGE_KEY, JSON.stringify(demo));
      } catch { /* ignore */ }
      return demo;
    });
  }, []);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isBusinessSetupCompleted, setIsBusinessSetupCompleted] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const isDemoBusiness = isDemoMode || businessSettings?.id === DEMO_BUSINESS_ID || isLocalBusinessId(businessSettings?.id);

  const setLandingPageConfig: React.Dispatch<React.SetStateAction<LandingPageConfig | null>> = (value) => {
    setLandingPageConfigState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      try {
        if (next) localStorage.setItem(LANDING_STORAGE_KEY, JSON.stringify(next));
        else localStorage.removeItem(LANDING_STORAGE_KEY);
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  };

  const setLang = (l: Language) => {
    const nextLang = normalizeAppLanguage(l);
    setLangState(normalizeAppLanguage(nextLang));
    setBusinessSettingsState(prev => {
      if (!prev) return prev;
      const next = { ...prev, language: nextLang };
      // Persist same field Settings uses — quiet (no toast on header shortcut)
      if (isLocalBusinessId(next.id) || next.id === DEMO_BUSINESS_ID) {
        const localSession = getLocalSession();
        if (localSession) {
          const account = getLocalAccountById(localSession.accountId);
          if (account) upsertLocalAccount({ ...account, business: next });
        }
      } else if (next.id) {
        void supabase.from('businesses').update({ language: nextLang }).eq('id', next.id);
      }
      return next;
    });
  };

  const t = (key: string) => {
    if (!key) return '';
    const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    const en = TRANSLATIONS['en'] as Record<string, string>;
    const local = (dict as Record<string, string>)[key];
    if (local) return local;
    if (en[key]) return en[key];
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, c => c.toUpperCase());
  };

  const tp = (product: Product | undefined) => {
    if (!product) return '';
    return product.translations?.[lang] || product.nameEN;
  };

  const tc = (category: string) => {
    const normalized = category.toLowerCase().replace(/\s+/g, '').replace(/ê/g, 'e');
    const keyMap: Record<string, string> = {
      waffles: 'waffles',
      crepes: 'crepes',
      drinks: 'drinks',
      icecream: 'icecream',
      extras: 'extras',
      other: 'other',
      general: 'general'
    };
    const key = keyMap[normalized];
    if (key) {
      const translated = t(key);
      if (translated !== key) return translated;
    }
    return category;
  };

  const isFirstTime = !localStorage.getItem('biz_registry');

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const applyDemoSession = useCallback((demoUser: User) => {
    const demo = generateDemoData();
    const usersWithRates = demo.users.map(u => ({
      ...u,
      hourlyRate: u.role === 'owner' ? 25 : u.role === 'manager' ? 18 : 14
    }));
    const business = createDemoBusiness();

    setIsDemoMode(true);
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ username: demoUser.username }));
    setBusinessSettingsState(business);
    setLangState(normalizeAppLanguage(business.language));
    setProducts(demo.products);
    setIngredients(demo.ingredients);
    setPreparedStock(demo.preparedStock);
    setUsers(usersWithRates);
    setSales(demo.sales);
    setOrders([]);
    setExpenses(demo.expenses);
    setWorkShifts(demo.workShifts);
    setShiftLogs(demo.shiftLogs);
    setRota([]);
    setStaffAvailability([]);
    setCategories(DEFAULT_CATEGORIES);
    setIsOnboarding(false);
    setIsBusinessSetupCompleted(true);
    setUser(demoUser);
    setActiveTab(demoUser.role === 'staff' ? 'cashier' : demoUser.role === 'manager' ? 'orders' : 'overview');

    // Always ensure the demo business has a public storefront to preview
    setLandingPageConfigState((prev) => {
      if (prev) return prev;
      const demo = createDemoLandingConfig();
      try {
        localStorage.setItem(LANDING_STORAGE_KEY, JSON.stringify(demo));
      } catch { /* ignore */ }
      return demo;
    });

    const persisted = loadPersistedOps(DEMO_BUSINESS_ID);
    if (persisted) {
      if (persisted.orders) setOrders(persisted.orders);
      if (persisted.ingredients) setIngredients(persisted.ingredients);
      if (persisted.preparedStock) setPreparedStock(persisted.preparedStock);
      if (persisted.sales?.length) setSales(persisted.sales);
      if (persisted.products?.length) setProducts(persisted.products);
      if (persisted.taxSettings) setTaxSettings(persisted.taxSettings);
    }
  }, []);

  const fetchBusinessData = useCallback(async (businessId: string) => {
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId);
    if (productsError) addToast(`Error fetching products: ${productsError.message}`, 'error');
    else setProducts((productsData || []).map((row) => mapProductRow(row as Record<string, unknown>)));

    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('business_id', businessId);
    if (salesError) addToast(`Error fetching sales: ${salesError.message}`, 'error');
    else setSales((salesData || []).map((row) => mapSaleRow(row as Record<string, unknown>)));

    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('business_id', businessId);
    if (expensesError) addToast(`Error fetching expenses: ${expensesError.message}`, 'error');
    else setExpenses((expensesData || []).map((row) => mapExpenseRow(row as Record<string, unknown>)));

    const { data: shiftsData, error: shiftsError } = await supabase
      .from('work_shifts')
      .select('*')
      .eq('business_id', businessId);
    if (shiftsError) addToast(`Error fetching work shifts: ${shiftsError.message}`, 'error');
    else setWorkShifts((shiftsData || []).map((row) => mapWorkShiftRow(row as Record<string, unknown>)));

    const { data: usersData } = await supabase
      .from('app_users')
      .select('*')
      .eq('business_id', businessId);
    if (usersData?.length) {
      setUsers(usersData.map((row) => mapUserRow(row as Record<string, unknown>)));
    }

    const { data: ingredientsData } = await supabase
      .from('ingredients')
      .select('*')
      .eq('business_id', businessId);
    if (ingredientsData) {
      setIngredients(
        ingredientsData.map((row: any) => ({
          id: Number(row.id),
          name: String(row.name ?? ''),
          unit: String(row.unit ?? 'pcs'),
          qty: Number(row.qty ?? 0),
          lowThreshold: Number(row.low_threshold ?? row.lowThreshold ?? 5),
        }))
      );
    } else {
      setIngredients([]);
    }

    const { data: preparedData } = await supabase
      .from('prepared_stock')
      .select('*')
      .eq('business_id', businessId);
    if (preparedData) {
      setPreparedStock(
        preparedData.map((row: any) => ({
          id: Number(row.id),
          name: String(row.name ?? ''),
          portions: Number(row.portions ?? 0),
          lowThreshold: Number(row.low_threshold ?? row.lowThreshold ?? 5),
        }))
      );
    } else {
      setPreparedStock([]);
    }

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('business_id', businessId);
    if (ordersData) {
      setOrders(
        ordersData.map((row: any) => ({
          id: String(row.id),
          type: row.type || 'WalkIn',
          status: row.status || 'Preparing',
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          lastUpdatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
          scheduledFor: row.scheduled_for,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          items: row.items || [],
          subtotal: Number(row.subtotal ?? 0),
          paymentMethod: row.payment_method || 'Cash',
          createdByUsername: row.created_by_username || '',
          createdByFullName: row.created_by_fullname || '',
          completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
          saleId: row.sale_id,
        }))
      );
    } else {
      setOrders([]);
    }

    const { data: businessRow } = await supabase
      .from('businesses')
      .select('categories')
      .eq('id', businessId)
      .maybeSingle();
    const cats = (businessRow as any)?.categories;
    setCategories(Array.isArray(cats) && cats.length ? cats : ['General']);

    setRota([]);
    setStaffAvailability([]);
    setShiftLogs([]);
  }, [addToast]);

  useEffect(() => {
    const restoreLocalRegisteredSession = () => {
      const session = getLocalSession();
      if (!session) return false;
      const account = getLocalAccountById(session.accountId);
      if (!account) {
        clearLocalSession();
        return false;
      }
      setIsDemoMode(false);
      setUser(localAccountToUser(account));
      setBusinessSettingsState(account.business);
      if (account.business?.language) setLangState(normalizeAppLanguage(account.business.language));
      setIsBusinessSetupCompleted(account.setupCompleted);
      setIsOnboarding(!account.setupCompleted);
      setActiveTab('overview');
      if (account.business?.id) {
        const persisted = loadPersistedOps(account.business.id);
        if (persisted) {
          if (persisted.products?.length) setProducts(persisted.products);
          if (persisted.ingredients) setIngredients(persisted.ingredients);
          if (persisted.preparedStock) setPreparedStock(persisted.preparedStock);
          if (persisted.sales?.length) setSales(persisted.sales);
          if (persisted.orders) setOrders(persisted.orders);
          if (persisted.expenses) setExpenses(persisted.expenses);
          if (persisted.workShifts) setWorkShifts(persisted.workShifts);
          if (persisted.shiftLogs) setShiftLogs(persisted.shiftLogs);
          if (persisted.users?.length) setUsers(persisted.users);
          if (persisted.categories?.length) setCategories(persisted.categories);
          if (persisted.rota) setRota(persisted.rota);
          if (persisted.staffAvailability) setStaffAvailability(persisted.staffAvailability);
          if (persisted.taxSettings) setTaxSettings(persisted.taxSettings);
        } else if (!account.setupCompleted) {
          setCategories(['General']);
        }
      } else {
        setCategories(['General']);
      }
      return true;
    };

    const checkCurrentSession = async () => {
      // Restore local demo session first
      try {
        const demoRaw = localStorage.getItem(DEMO_SESSION_KEY);
        if (demoRaw) {
          const { username } = JSON.parse(demoRaw) as { username: string };
          const demoUser = DEFAULT_USERS.find((u) => u.username === username);
          if (demoUser) {
            applyDemoSession(demoUser as User);
            setIsSessionLoading(false);
            return;
          }
        }
      } catch {
        localStorage.removeItem(DEMO_SESSION_KEY);
      }

      // Restore offline / local registered accounts (used when Supabase is unreachable)
      if (restoreLocalRegisteredSession()) {
        setIsSessionLoading(false);
        return;
      }

      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);
        const session = sessionResult?.data?.session ?? null;
        if (session) {
          const authUser = session.user;
          const { data: userProfile, error: profileError } = await supabase
            .from('app_users')
            .select('*, businesses (*)')
            .eq('id', authUser.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error("Initial session check failed to get profile:", profileError.message);
          }

          if (userProfile && userProfile.businesses) {
            const business = mapBusinessRow(userProfile.businesses as Record<string, unknown>);
            setIsDemoMode(false);
            setBusinessSettingsState(business);
            setUser({
              id: authUser.id as unknown as number,
              email: authUser.email,
              fullName: userProfile.full_name,
              username: userProfile.username,
              role: userProfile.role,
            });
            const setupDone = Boolean((userProfile.businesses as any)?.setup_completed);
            setIsBusinessSetupCompleted(setupDone);
            setIsOnboarding(!setupDone);
            if (business.language) setLangState(normalizeAppLanguage(business.language));
            fetchBusinessData(business.id);
          } else {
            setIsDemoMode(false);
            setUser({
              id: authUser.id as unknown as number,
              email: authUser.email,
              fullName: (authUser.user_metadata?.full_name as string) || authUser.email || 'Owner',
              username: (authUser.user_metadata?.username as string) || authUser.email || 'owner',
              role: 'owner',
            });
            setBusinessSettingsState(null);
            setIsBusinessSetupCompleted(false);
            setIsOnboarding(true);
          }
        }
      } catch (error) {
        console.warn('Supabase session check failed; staying logged out unless local session exists.', error);
        if (restoreLocalRegisteredSession()) {
          setIsSessionLoading(false);
          return;
        }
      }
      setIsSessionLoading(false);
    };
    checkCurrentSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const isAuthAction = _event === 'SIGNED_IN' || _event === 'SIGNED_OUT';
      try {
        if (localStorage.getItem(DEMO_SESSION_KEY) || getLocalSession()) {
          // Demo / local sessions own the UI; ignore Supabase auth churn
          return;
        }
        if (session) {
          const authUser = session.user;
          const { data: userProfile, error: profileError } = await supabase
            .from('app_users')
            .select('*, businesses (*)')
            .eq('id', authUser.id)
            .single();

          if (userProfile && userProfile.businesses) {
            const business = mapBusinessRow(userProfile.businesses as Record<string, unknown>);
            setIsDemoMode(false);
            setBusinessSettingsState(business);
            setUser({
              id: authUser.id as unknown as number,
              email: authUser.email,
              fullName: userProfile.full_name,
              username: userProfile.username,
              role: userProfile.role,
            });
            const setupDone = Boolean((userProfile.businesses as any)?.setup_completed);
            setIsBusinessSetupCompleted(setupDone);
            setIsOnboarding(!setupDone);
            fetchBusinessData(business.id);
          } else {
            if (profileError && profileError.code !== 'PGRST116') {
              console.error("Auth state change error fetching profile:", profileError.message);
            }
            addToast('Could not load business profile. Please complete setup.', 'info');
            setIsDemoMode(false);
            setUser({
              id: authUser.id as unknown as number,
              email: authUser.email,
              fullName: (authUser.user_metadata?.full_name as string) || authUser.email || 'Owner',
              username: (authUser.user_metadata?.username as string) || authUser.email || 'owner',
              role: 'owner',
            });
            setBusinessSettingsState(null);
            setIsBusinessSetupCompleted(false);
            setIsOnboarding(true);
          }
        } else if (!localStorage.getItem(DEMO_SESSION_KEY) && !getLocalSession()) {
          setUser(null);
          setBusinessSettingsState(null);
          setIsBusinessSetupCompleted(false);
          setIsDemoMode(false);
        }
      } catch (error) {
        console.error("Critical error in onAuthStateChange:", error);
        addToast("An unexpected error occurred during login.", "error");
      } finally {
        if (isAuthAction) {
          setIsLoggingIn(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchBusinessData, applyDemoSession, addToast]);

  const activateLocalAccount = (account: ReturnType<typeof createLocalAccount>, message = 'Account created on this device. Continue onboarding.') => {
    setLocalSession(account.id);
    setIsDemoMode(false);
    setUser(localAccountToUser(account));
    setBusinessSettingsState(account.business);
    setIsBusinessSetupCompleted(account.setupCompleted);
    setIsOnboarding(!account.setupCompleted);
    setActiveTab('overview');
    if (!account.business) setCategories(['General']);
    addToast(message, 'success');
    return { error: null };
  };

  const registerAccount = async (payload: { fullName: string; username: string; email: string; password: string }) => {
    if (!payload.password || payload.password.length < 6) {
      addToast(t('passwordTooShort'), 'error');
      return { error: { message: 'Password must be at least 6 characters.' } };
    }

    const registerLocally = () => {
      try {
        const account = createLocalAccount(payload);
        return activateLocalAccount(account);
      } catch (localError) {
        const message = localError instanceof Error ? localError.message : 'Could not create a local account.';
        addToast(message, 'error');
        return { error: { message } };
      }
    };

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            full_name: payload.fullName,
            username: payload.username
          }
        }
      });

      if (authError) {
        if (isNetworkAuthError(authError)) return registerLocally();
        addToast(authError.message, 'error');
        return { error: authError };
      }

      if (!authData.session) {
        const signInResult = await Promise.race([
          supabase.auth.signInWithPassword({
            email: payload.email,
            password: payload.password,
          }),
          new Promise<{ error: { message: string } }>((resolve) =>
            setTimeout(() => resolve({ error: { message: 'Login timed out after sign-up. Please try logging in.' } }), 12000)
          )
        ]);

        if ('error' in signInResult && signInResult.error) {
          const msg = signInResult.error.message || '';
          if (isNetworkAuthError(signInResult.error)) return registerLocally();
          if (msg.toLowerCase().includes('email not confirmed')) {
            addToast('Account created. Please confirm your email, then log in to continue onboarding.', 'info');
          } else {
            addToast(msg, 'error');
          }
          return { error: signInResult.error };
        }
      }

      clearLocalSession();
      setIsDemoMode(false);
      setIsOnboarding(true);
      setActiveTab('overview');
      addToast('Account created successfully.', 'success');
      return { error: null };
    } catch (error) {
      if (isNetworkAuthError(error)) return registerLocally();
      const message = error instanceof Error ? error.message : 'Registration failed.';
      addToast(message, 'error');
      return { error: { message } };
    }
  };

  const provisionBusinessProfile = async (settings: Omit<BusinessSettings, 'id'>) => {
    const localSession = getLocalSession();
    if (localSession) {
      const account = getLocalAccountById(localSession.accountId);
      if (!account) {
        clearLocalSession();
        return { error: { message: 'Local account session expired. Please register again.' } };
      }
      const business = account.business ?? buildLocalBusiness(settings, account);
      const nextAccount = {
        ...account,
        business: {
          ...business,
          ...settings,
          id: business.id,
          ownerName: settings.ownerName || account.fullName,
          ownerEmail: settings.ownerEmail || account.email,
        },
        setupCompleted: false,
      };
      upsertLocalAccount(nextAccount);
      setBusinessSettingsState(nextAccount.business);
      setUser(localAccountToUser(nextAccount));
      if (nextAccount.business.language) setLangState(normalizeAppLanguage(nextAccount.business.language));
      setIsOnboarding(true);
      setIsBusinessSetupCompleted(false);
      setActiveTab('overview');
      addToast(t('businessRegistered'), 'success');
      return { error: null };
    }

    let authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null = null;
    try {
      const { data: authState, error: sessionError } = await supabase.auth.getUser();
      if (sessionError || !authState.user) {
        if (isNetworkAuthError(sessionError) && user) {
          // Fall through to a one-off local business if we somehow lost the session key
          const fallbackAccount = createLocalAccount({
            fullName: user.fullName,
            username: user.username,
            email: user.email || `${user.username}@local.previsio`,
            password: user.password || `local-${Date.now()}`,
          });
          setLocalSession(fallbackAccount.id);
          const business = buildLocalBusiness(settings, fallbackAccount);
          upsertLocalAccount({ ...fallbackAccount, business, setupCompleted: false });
          setBusinessSettingsState(business);
          setIsOnboarding(true);
          setIsBusinessSetupCompleted(false);
          addToast(t('businessRegistered'), 'success');
          return { error: null };
        }
        return { error: sessionError || { message: 'No authenticated user found.' } };
      }
      authUser = authState.user;
    } catch (error) {
      if (isNetworkAuthError(error) && user) {
        try {
          const fallbackAccount = createLocalAccount({
            fullName: user.fullName,
            username: user.username,
            email: user.email || `${user.username}@local.previsio`,
            password: user.password || `local-${Date.now()}`,
          });
          setLocalSession(fallbackAccount.id);
          const business = buildLocalBusiness(settings, fallbackAccount);
          upsertLocalAccount({ ...fallbackAccount, business, setupCompleted: false });
          setBusinessSettingsState(business);
          setIsOnboarding(true);
          setIsBusinessSetupCompleted(false);
          addToast(t('businessRegistered'), 'success');
          return { error: null };
        } catch (localError) {
          return { error: localError };
        }
      }
      return { error: error instanceof Error ? error : { message: 'No authenticated user found.' } };
    }

    if (!authUser) {
      return { error: { message: 'No authenticated user found.' } };
    }

    const { data: existingOwnedBusiness } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_user_id', authUser.id)
      .maybeSingle();

    const attachOwnerProfile = async (businessId: string, businessRow: Record<string, unknown>) => {
      const profilePayload = {
        id: authUser.id,
        business_id: businessId,
        username: (authUser.user_metadata?.username as string) || authUser.email || 'owner',
        full_name: (authUser.user_metadata?.full_name as string) || authUser.email || 'Owner',
        role: 'owner',
      };
      const { error: profileError } = await supabase.from('app_users').upsert(profilePayload);
      if (profileError) {
        addToast(`Database Error: ${profileError.message}`, 'error');
        return { error: profileError };
      }

      setBusinessSettingsState(mapBusinessRow(businessRow));
      setUser({
        id: authUser.id as unknown as number,
        email: authUser.email,
        fullName: profilePayload.full_name,
        username: profilePayload.username,
        role: 'owner',
      });
      setIsOnboarding(true);
      setIsBusinessSetupCompleted(false);
      setActiveTab('overview');
      return { error: null };
    };

    if (existingOwnedBusiness?.id) {
      return attachOwnerProfile(existingOwnedBusiness.id, existingOwnedBusiness as Record<string, unknown>);
    }

    const { data: existingProfile } = await supabase
      .from('app_users')
      .select('business_id')
      .eq('id', authUser.id)
      .maybeSingle();

    if (existingProfile?.business_id) {
      const { data: existingBusiness } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', existingProfile.business_id)
        .maybeSingle();

      if (existingBusiness) {
        setBusinessSettingsState(mapBusinessRow(existingBusiness as Record<string, unknown>));
        setIsOnboarding(true);
        setIsBusinessSetupCompleted(Boolean((existingBusiness as any).setup_completed));
        return { error: null };
      }
    }

    const { data: bizData, error: bizError } = await supabase
      .from('businesses')
      .insert({
        ...businessToRow(settings as BusinessSettings),
        setup_completed: false,
        owner_user_id: authUser.id
      })
      .select()
      .single();

    if (bizError) {
      if (bizError.message?.includes('businesses_owner_user_id_key')) {
        const { data: fallbackBusiness } = await supabase
          .from('businesses')
          .select('*')
          .eq('owner_user_id', authUser.id)
          .maybeSingle();
        if (fallbackBusiness?.id) {
          return attachOwnerProfile(fallbackBusiness.id, fallbackBusiness as Record<string, unknown>);
        }
      }
      addToast(`Database Error: ${bizError.message}`, 'error');
      return { error: bizError };
    }
    if (!bizData?.id) {
      return { error: { message: 'Failed to retrieve business details after creation.' } };
    }

    const result = await attachOwnerProfile(bizData.id, bizData as Record<string, unknown>);
    if (!result.error) {
      addToast(t('businessRegistered'), 'success');
    }
    return result;
  };

  const login = async (payload: { identifier: string; password: string; mode: 'owner' | 'staff' }) => {
    setIsLoggingIn(true);
    try {
      const demoUser = findDemoUser(payload.identifier, payload.password);

      // Demo credentials + invited staff roster
      if (!demoUser && payload.mode === 'staff') {
        try {
          const roster = JSON.parse(localStorage.getItem('previsio_staff_roster') || '[]') as User[];
          const invited = roster.find(u => u.username === payload.identifier && u.password === payload.password);
          if (invited) {
            applyDemoSession(invited);
            setUser(invited);
            addToast(t('welcomeBack'), 'success');
            setIsLoggingIn(false);
            return;
          }
        } catch { /* ignore */ }
      }

      if (demoUser) {
        if (payload.mode === 'owner' && demoUser.role !== 'owner') {
          throw new Error('Invalid owner credentials');
        }
        if (payload.mode === 'staff' && demoUser.role === 'owner') {
          throw new Error('Use Owner Login for the demo owner account');
        }
        applyDemoSession(demoUser as User);
        addToast(t('welcomeBack'), 'success');
        setIsLoggingIn(false);
        return;
      }

      if (payload.mode === 'owner') {
        const localAccount = findLocalAccount(payload.identifier, payload.password);
        if (localAccount) {
          activateLocalAccount(localAccount, t('welcomeBack'));
          setIsLoggingIn(false);
          return;
        }

        try {
          const { error } = await supabase.auth.signInWithPassword({
            email: payload.identifier,
            password: payload.password,
          });
          if (error) {
            if (isNetworkAuthError(error)) {
              throw new Error('Cloud login is unavailable. If you registered on this device, use that email and password.');
            }
            throw error;
          }
          // onAuthStateChange finishes the session
        } catch (error) {
          if (isNetworkAuthError(error)) {
            throw new Error('Cloud login is unavailable. If you registered on this device, use that email and password.');
          }
          throw error;
        }
      } else {
        throw new Error('Invalid staff credentials');
      }
    } catch (error) {
      setIsLoggingIn(false);
      throw error;
    }
  };

  const logout = () => {
    setIsLoggingIn(true);
    localStorage.removeItem(DEMO_SESSION_KEY);
    clearLocalSession();
    if (isDemoMode || isLocalBusinessId(businessSettings?.id)) clearPersistedOps();
    setIsDemoMode(false);
    supabase.auth.signOut().catch(() => undefined).finally(() => setIsLoggingIn(false));
    setProducts([]);
    setIngredients([]);
    setPreparedStock([]);
    setSales([]);
    setOrders([]);
    setUsers([]);
    setCategories([]);
    setExpenses([]);
    setWorkShifts([]);
    setShiftLogs([]);
    setRota([]);
    setStaffAvailability([]);
    setBusinessSettingsState(null);
    setUser(null);
    setIsBusinessSetupCompleted(false);
    setIsOnboarding(false);
    setActiveTab('overview');
    addToast(t('logout'), 'info');
  };

  const inviteStaff = async (payload: { fullName: string; username: string; password: string; role: Role; email?: string }) => {
    if (!payload.username.trim() || !payload.password || payload.password.length < 6) {
      return { error: t('passwordTooShort') };
    }
    if (users.some(u => u.username === payload.username) || DEFAULT_USERS.some(u => u.username === payload.username)) {
      return { error: 'Username already taken.' };
    }

    const newUser: User = {
      id: Date.now(),
      fullName: payload.fullName,
      username: payload.username.trim(),
      password: payload.password,
      role: payload.role === 'owner' ? 'staff' : payload.role,
      email: payload.email,
      hourlyRate: payload.role === 'manager' ? 18 : 14,
    };

    if (!isDemoBusiness && businessSettings?.id) {
      const { error } = await supabase.from('app_users').insert({
        business_id: businessSettings.id,
        username: newUser.username,
        full_name: newUser.fullName,
        role: newUser.role,
        email: newUser.email,
        // Local password for demo-compatible staff login until invite emails exist
        local_password: newUser.password,
      });
      if (error && !error.message.includes('local_password')) {
        // Table may not have local_password — still keep local roster
        console.warn(error.message);
      }
    }

    setUsers(prev => [...prev, newUser]);
    // Also register in DEFAULT_USERS-compatible local storage for staff login
    try {
      const key = 'previsio_staff_roster';
      const raw = localStorage.getItem(key);
      const roster = raw ? JSON.parse(raw) : [];
      roster.push({ ...newUser, businessId: businessSettings?.id || DEMO_BUSINESS_ID });
      localStorage.setItem(key, JSON.stringify(roster));
    } catch { /* ignore */ }

    return {
      error: null,
      credentials: { username: newUser.username, password: payload.password },
    };
  };

  const resetAllData = () => {
    clearPersistedOps();
    try {
      localStorage.removeItem(DEMO_SESSION_KEY);
      localStorage.removeItem(LANDING_STORAGE_KEY);
      sessionStorage.removeItem('previsio_onboarding_step');
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  const formatPrice = (amount: number) => {
    const symbol = businessSettings?.currencySymbol || '€';
    return (
      <span className="inline-flex items-baseline gap-0.5">
        <span>{symbol}{amount.toFixed(2)}</span>
      </span>
    );
  };

  const startOnboarding = () => {
    setIsOnboarding(true);
  };

  const completeOnboarding = async () => {
    const localSession = getLocalSession();
    if (localSession) {
      const account = getLocalAccountById(localSession.accountId);
      if (account) {
        upsertLocalAccount({
          ...account,
          business: businessSettings || account.business,
          setupCompleted: true,
        });
      }
    } else if (businessSettings?.id && !isDemoBusiness) {
      try {
        const { error } = await supabase
          .from('businesses')
          .update({ setup_completed: true })
          .eq('id', businessSettings.id);
        if (error) {
          addToast(`Error saving setup status: ${error.message}`, 'error');
        }
      } catch (error) {
        if (!isNetworkAuthError(error)) {
          addToast('Error saving setup status.', 'error');
        }
      }
    }
    setIsOnboarding(false);
    setIsBusinessSetupCompleted(true);
  };

  const loadDemoData = () => {
    applyDemoSession(
      user ||
        ({
          id: 1,
          username: 'owner@123.com',
          fullName: 'PreVisio Owner',
          role: 'owner',
          password: 'owner123',
          email: 'owner@123.com',
        } as User)
    );
    addToast(t('demoDataLoaded'));
  };

  const saveBusinessSettings = async (settings: BusinessSettings) => {
    setBusinessSettingsState(settings);
    if (settings.language) setLangState(normalizeAppLanguage(settings.language));

    if (isDemoBusiness || settings.id === DEMO_BUSINESS_ID || isLocalBusinessId(settings.id)) {
      const localSession = getLocalSession();
      if (localSession) {
        const account = getLocalAccountById(localSession.accountId);
        if (account) upsertLocalAccount({ ...account, business: settings });
      }
      addToast(t('settingsUpdated'), 'success');
      return;
    }

    try {
      const { error } = await supabase
        .from('businesses')
        .update(businessToRow(settings))
        .eq('id', settings.id);

      if (error) addToast(error.message, 'error');
      else addToast(t('settingsUpdated'), 'success');
    } catch (error) {
      if (isNetworkAuthError(error)) {
        addToast(t('settingsUpdated'), 'success');
      } else {
        addToast('Could not save settings.', 'error');
      }
    }
  };

  const addSale = async (sale: Omit<Sale, 'id' | 'timestamp' | 'cashierFullName' | 'cashierUsername'>) => {
    if (!user || !businessSettings) return;

    if (isDemoBusiness) {
      const localSale: Sale = {
        ...sale,
        id: `DEMO-${Date.now()}`,
        timestamp: Date.now(),
        cashierUsername: user.username,
        cashierFullName: user.fullName,
      };
      setSales(prev => [...prev, localSale]);
      addToast(t('orderSent'));
      return;
    }

    const { data: saleData, error: saleError } = await supabase.from('sales').insert({
      subtotal: sale.subtotal,
      payment_method: sale.paymentMethod,
      cashier_username: user.username || user.email,
      cashier_fullname: user.fullName,
      business_id: businessSettings.id,
    }).select().single();

    if (saleError || !saleData) {
      addToast(`Error creating sale: ${saleError?.message}`, 'error');
      return;
    }

    const saleItems = sale.items.map(item => ({
      sale_id: saleData.id,
      product_id: item.productId,
      qty: item.qty,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      extras: item.extras,
      name_en: item.nameEN,
      translations: item.translations,
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
    if (itemsError) {
      addToast(`Error adding sale items: ${itemsError.message}`, 'error');
      return;
    }

    setSales(prev => [...prev, mapSaleRow({ ...saleData, sale_items: saleItems })]);
    addToast(t('orderSent'));
  };

  const updateSale = async (sale: Sale) => {
    if (isDemoBusiness) {
      setSales(prev => prev.map(s => s.id === sale.id ? sale : s));
      addToast(t('saleUpdated'));
      return;
    }
    const { error } = await supabase
      .from('sales')
      .update({ subtotal: sale.subtotal, payment_method: sale.paymentMethod })
      .eq('id', sale.id);
    if (error) addToast(error.message, 'error');
    else {
      setSales(prev => prev.map(s => s.id === sale.id ? sale : s));
      addToast(t('saleUpdated'));
    }
  };

  const deleteSale = async (saleId: string) => {
    if (isDemoBusiness) {
      setSales(prev => prev.filter(s => s.id !== saleId));
      addToast(t('saleDeleted'));
      return;
    }
    const { error } = await supabase.from('sales').delete().eq('id', saleId);
    if (error) addToast(error.message, 'error');
    else {
      setSales(prev => prev.filter(s => s.id !== saleId));
      addToast(t('saleDeleted'));
    }
  };

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    if (!businessSettings) return;
    if (isDemoBusiness) {
      setExpenses(prev => [...prev, { ...expense, id: `EXP-${Date.now()}` }]);
      addToast(t('addExpense'), 'success');
      return;
    }
    const { data, error } = await supabase
      .from('expenses')
      .insert([expenseToRow(expense, businessSettings.id)])
      .select()
      .single();
    if (error) addToast(error.message, 'error');
    else {
      setExpenses(prev => [...prev, mapExpenseRow(data as Record<string, unknown>)]);
      addToast(t('addExpense'), 'success');
    }
  };

  const updateExpense = async (expense: Expense) => {
    if (isDemoBusiness) {
      setExpenses(prev => prev.map(e => e.id === expense.id ? expense : e));
      addToast(t('editExpense'), 'success');
      return;
    }
    const { data, error } = await supabase
      .from('expenses')
      .update(expenseToRow(expense, businessSettings!.id))
      .eq('id', expense.id)
      .select()
      .single();
    if (error) addToast(error.message, 'error');
    else {
      setExpenses(prev => prev.map(e => e.id === expense.id ? mapExpenseRow(data as Record<string, unknown>) : e));
      addToast(t('editExpense'), 'success');
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (isDemoBusiness) {
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      addToast(t('delete'), 'success');
      return;
    }
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) addToast(error.message, 'error');
    else {
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      addToast(t('delete'), 'success');
    }
  };

  const addWorkShift = async (shift: Omit<WorkShift, 'id'>) => {
    if (!businessSettings) return;
    if (isDemoBusiness) {
      setWorkShifts(prev => [...prev, { ...shift, id: `WS-${Date.now()}` }]);
      addToast(t('shiftLogged'));
      return;
    }
    const { data, error } = await supabase
      .from('work_shifts')
      .insert([workShiftToRow(shift, businessSettings.id)])
      .select()
      .single();
    if (error) addToast(error.message, 'error');
    else {
      setWorkShifts(prev => [...prev, mapWorkShiftRow(data as Record<string, unknown>)]);
      addToast(t('shiftLogged'));
    }
  };

  const updateWorkShift = async (shift: WorkShift) => {
    if (isDemoBusiness) {
      setWorkShifts(prev => prev.map(s => s.id === shift.id ? shift : s));
      addToast(t('shiftUpdated'));
      return;
    }
    const { data, error } = await supabase
      .from('work_shifts')
      .update(workShiftToRow(shift, businessSettings!.id))
      .eq('id', shift.id)
      .select()
      .single();
    if (error) addToast(error.message, 'error');
    else {
      setWorkShifts(prev => prev.map(s => s.id === shift.id ? mapWorkShiftRow(data as Record<string, unknown>) : s));
      addToast(t('shiftUpdated'));
    }
  };

  const deleteWorkShift = async (shiftId: number | string) => {
    if (isDemoBusiness) {
      setWorkShifts(prev => prev.filter(s => String(s.id) !== String(shiftId)));
      addToast(t('shiftDeleted'));
      return;
    }
    const { error } = await supabase.from('work_shifts').delete().eq('id', shiftId);
    if (error) addToast(error.message, 'error');
    else {
      setWorkShifts(prev => prev.filter(s => String(s.id) !== String(shiftId)));
      addToast(t('shiftDeleted'));
    }
  };

  const saveRota = async (newRota: RotaShift[]) => {
    if (!businessSettings) return;
    if (isDemoBusiness) {
      setRota(newRota);
      addToast(t('rotaSaved'));
      return;
    }
    const shiftsToSave = newRota.map(s => ({ ...s, business_id: businessSettings.id }));
    const { error } = await supabase.from('rota_shifts').upsert(shiftsToSave);
    if (error) {
      setRota(newRota);
      addToast(t('rotaSaved'));
    } else {
      setRota(newRota);
      addToast(t('rotaSaved'));
    }
  };

  // Persist ops locally so kitchen/stock survive refresh (demo + soft real tenants)
  useEffect(() => {
    if (!businessSettings?.id) return;
    if (!isDemoBusiness && !isDemoMode) return;
    savePersistedOps({
      businessId: businessSettings.id,
      products,
      ingredients,
      preparedStock,
      sales,
      orders,
      expenses,
      workShifts,
      shiftLogs,
      users,
      categories,
      rota,
      staffAvailability,
      taxSettings,
      updatedAt: Date.now(),
    });
  }, [
    businessSettings?.id, isDemoBusiness, isDemoMode,
    products, ingredients, preparedStock, sales, orders, expenses,
    workShifts, shiftLogs, users, categories, rota, staffAvailability, taxSettings,
  ]);

  return (
    <AppContext.Provider value={{
      lang, setLang, t, tp, tc, activeTab, setActiveTab,
      user, setUser, products, setProducts, ingredients, setIngredients,
      preparedStock, setPreparedStock,
      sales, setSales, deleteSale, updateSale, addSale, orders, setOrders, users, setUsers, categories, setCategories,
      expenses, addExpense, updateExpense, deleteExpense,
      workShifts, setWorkShifts, addWorkShift, updateWorkShift, deleteWorkShift,
      shiftLogs, setShiftLogs,
      rota, setRota, saveRota, staffAvailability, setStaffAvailability, isSessionLoading,
      taxSettings, setTaxSettings, landingPageConfig, setLandingPageConfig, hasLandingPage: !!landingPageConfig, isLoggingIn,
      toasts, addToast, logout, resetAllData, formatPrice,
      businessSettings, setBusinessSettings: setBusinessSettingsState, saveBusinessSettings,
      registerAccount, provisionBusinessProfile, login, inviteStaff, ensureLandingForDemo, isFirstTime, isBusinessSetupCompleted, setIsBusinessSetupCompleted,
      isOnboarding, startOnboarding, completeOnboarding, loadDemoData, isDemoMode
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
