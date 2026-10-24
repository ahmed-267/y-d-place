import { readAllPages } from './utils/pagedRows.mjs';
import { BrowserBackup } from './components/BrowserBackup';
import { mapOrderRow } from './utils/dbMappers';
import { useCloudCollection, type CloudSetter } from './hooks/useCloudCollection';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { User, Product, Ingredient, PreparedStock, Sale, Language, Expense, TaxSettings, WorkShift, BusinessSettings, Order, RotaShift, StaffAvailability, LandingPageConfig, ShiftLog, Role, CashSession, FloorPlan, PendingTableSession, emptyFloorPlan, normalizeFloorPlan, WasteLog, Customer, normalizeEnabledModules } from './types';
import { DEFAULT_USERS, TRANSLATIONS, DEFAULT_CATEGORIES } from './constants';
import { generateDemoData } from './utils/demoData';
import { supabase } from './components/supabaseClient';
import { createDemoLandingConfig } from './utils/demoLanding';
import { clearPersistedOps, loadPersistedOps, savePersistedOps, loadOnlineInbox, clearOnlineInbox, savePublicMenuSnapshot } from './utils/opsPersistence';
import { applyBrandThemeToDocument } from './utils/brandTheme';
import { queueTourAfterSetup } from './utils/productTour';
import { upsertCustomerFromOrder } from './utils/customers';
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
  productToRow,
  orderToRow,
  saleToRow,
  saleItemsToRows,
} from './utils/dbMappers';
import {
  clearLocalSession,
  getLocalAccountById,
  getLocalSession,
  isLocalBusinessId,
  isNetworkAuthError,
  loadLocalAccounts,
  upsertLocalAccount,
  wipeLocalAccounts,
} from './utils/localAccounts';
import { restoreStock } from './utils/stock';
import { normalizeAppLanguage } from './utils/languages';
import {
  clearStaffRoster,
  clearStaffSession,
  upsertStaffRosterEntry,
} from './utils/staffRoster';
import { isPasswordStrongEnough } from './utils/passwordStrength';

const APP_USER_SAFE_COLUMNS =
  'id, business_id, username, full_name, role, email, hourly_rate, numeric_id, businesses (*)';
const LANDING_STORAGE_KEY = 'previsio_landing_page';
const DEMO_SESSION_KEY = 'previsio_demo_session';

interface AppContextType {
  accountAppearance: 'light' | 'dark';
  setAccountAppearance: (mode: 'light' | 'dark') => void;
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
  setProducts: CloudSetter<Product>;
  addSale: (sale: Omit<Sale, 'id' | 'timestamp' | 'cashierFullName' | 'cashierUsername'>) => Promise<void>;
  recordSale: (sale: Sale, order?: Order) => Promise<boolean>;
  saveOrder: (order: Order) => Promise<boolean>;
  markSaleStatus: (saleId: string, status: 'voided' | 'refunded', reason?: string, orderStatus?: 'Cancelled' | 'Preparing' | 'Ready') => Promise<boolean>;
  ingredients: Ingredient[];
  setIngredients: CloudSetter<Ingredient>;
  preparedStock: PreparedStock[];
  setPreparedStock: CloudSetter<PreparedStock>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  deleteSale: (saleId: string) => Promise<boolean>;
  updateSale: (sale: Sale) => Promise<boolean>;
  orders: Order[];
  setOrders: CloudSetter<Order>;
  users: User[];
  setUsers: CloudSetter<User>;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<boolean>;
  updateExpense: (expense: Expense) => Promise<boolean>;
  deleteExpense: (expenseId: string) => Promise<void>;
  workShifts: WorkShift[];
  setWorkShifts: CloudSetter<WorkShift>;
  addWorkShift: (shift: Omit<WorkShift, 'id'>) => Promise<void>;
  updateWorkShift: (shift: WorkShift) => Promise<void>;
  deleteWorkShift: (shiftId: number | string) => Promise<void>;
  shiftLogs: ShiftLog[];
  setShiftLogs: React.Dispatch<React.SetStateAction<ShiftLog[]>>;
  clockIn: () => void;
  clockOut: () => void;
  openShiftLog: ShiftLog | null;
  cashSessions: CashSession[];
  openTill: (openingFloat: number) => void;
  closeTill: (countedCash: number) => CashSession | null;
  openCashSession: CashSession | null;
  refundSale: (saleId: string, reason?: string) => Promise<boolean>;
  floorPlan: FloorPlan;
  setFloorPlan: React.Dispatch<React.SetStateAction<FloorPlan>>;
  pendingTableSession: PendingTableSession | null;
  setPendingTableSession: React.Dispatch<React.SetStateAction<PendingTableSession | null>>;
  wasteLogs: WasteLog[];
  setWasteLogs: React.Dispatch<React.SetStateAction<WasteLog[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  rota: RotaShift[];
  setRota: CloudSetter<RotaShift>;
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
  saveBusinessSettings: (settings: BusinessSettings) => Promise<boolean>;
  registerAccount: (payload: { fullName: string; username: string; email: string; password: string }) => Promise<{ error: any }>;
  provisionBusinessProfile: (settings: Omit<BusinessSettings, 'id'>) => Promise<{ error: any }>;
  isBusinessSetupCompleted: boolean;
  setIsBusinessSetupCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  login: (payload: { identifier: string; password: string; mode: 'owner' | 'staff' }) => Promise<void>;
  isFirstTime: boolean;
  isOnboarding: boolean;
  startOnboarding: () => void;
  completeOnboarding: () => Promise<boolean>;
  loadDemoData: () => void;
  startDemoSession: (role?: Role) => void;
  switchDemoRole: (role: Role) => void;
  isPasswordRecovery: boolean;
  completePasswordRecovery: () => void;
  landingPageConfig: LandingPageConfig | null;
  setLandingPageConfig: React.Dispatch<React.SetStateAction<LandingPageConfig | null>>;
  hasLandingPage: boolean;
  isSessionLoading: boolean;
  isLoggingIn: boolean;
  cloudLoadError: string | null;
  refreshBusinessData: () => Promise<void>;
  isDemoMode: boolean;
  inviteStaff: (payload: { fullName: string; username: string; password: string; role: Role; email?: string }) => Promise<{ error: string | null; credentials?: { username: string; password: string } }>;
  ensureLandingForDemo: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
export { AppContext };

const isRecoveryHash = () => {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  return params.get('type') === 'recovery';
};

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
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [floorPlan, setFloorPlan] = useState<FloorPlan>(() => emptyFloorPlan());
  const [pendingTableSession, setPendingTableSession] = useState<PendingTableSession | null>(null);
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const passwordRecoveryRef = useRef(false);
  const [isBusinessSetupCompleted, setIsBusinessSetupCompleted] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [accountAppearance, setAppearance] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('previsio_account_appearance') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  const setAccountAppearance = (mode: 'light' | 'dark') => {
    setAppearance(mode);
    try { localStorage.setItem('previsio_account_appearance', mode); } catch { /* Session preference still works. */ }
  };

  const isDemoBusiness = isDemoMode || businessSettings?.id === DEMO_BUSINESS_ID || isLocalBusinessId(businessSettings?.id);

  useEffect(() => {
    applyBrandThemeToDocument(businessSettings?.brandTheme, user ? accountAppearance : 'light');
  }, [businessSettings?.brandTheme, accountAppearance, user]);

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
    const language = normalizeAppLanguage(l);
    setLangState(language);
    if (businessSettings && user) {
      try { localStorage.setItem(`previsio_language_${businessSettings.id}_${user.authId || user.id}`, language); } catch { /* Language selection still works for this session. */ }
    }
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
    setFloorPlan(emptyFloorPlan());
    setPendingTableSession(null);
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
      if (persisted.expenses) setExpenses(persisted.expenses);
      if (persisted.workShifts) setWorkShifts(persisted.workShifts);
      if (persisted.ingredients) setIngredients(persisted.ingredients);
      if (persisted.preparedStock) setPreparedStock(persisted.preparedStock);
      if (persisted.sales?.length) setSales(persisted.sales);
      if (persisted.products?.length) setProducts(persisted.products);
      if (persisted.taxSettings) setTaxSettings(persisted.taxSettings);
      if (persisted.cashSessions) setCashSessions(persisted.cashSessions);
      if (persisted.shiftLogs) setShiftLogs(persisted.shiftLogs);
      if (persisted.wasteLogs) setWasteLogs(persisted.wasteLogs);
      if (persisted.customers) setCustomers(persisted.customers);
    }
  }, []);

  const applyPersistedOpsToState = useCallback((businessId: string) => {
    const persisted = loadPersistedOps(businessId);
    if (!persisted) return;
    if (persisted.shiftLogs) setShiftLogs(persisted.shiftLogs);
    if (persisted.categories?.length) setCategories(persisted.categories);
    if (persisted.staffAvailability) setStaffAvailability(persisted.staffAvailability);
    if (persisted.taxSettings) setTaxSettings(persisted.taxSettings);
    if (persisted.cashSessions) setCashSessions(persisted.cashSessions);
    if (persisted.floorPlan) setFloorPlan(normalizeFloorPlan(persisted.floorPlan));
    if (persisted.wasteLogs) setWasteLogs(persisted.wasteLogs);
    if (persisted.customers) setCustomers(persisted.customers);

  }, []);

  const [cloudLoadError, setCloudLoadError] = useState<string | null>(null);
  const fetchGeneration = useRef(0);
  const loadedBusiness = useRef<string | null>(null);
  const fetchBusinessData = useCallback(async (businessId: string) => {
    const generation = ++fetchGeneration.current;
    const switched = loadedBusiness.current !== businessId;
    if (switched) {
      loadedBusiness.current = null;
      const previousCache = loadPersistedOps(businessId);
      if (previousCache) {
        try { localStorage.setItem(`previsio_recovery_${businessId}_${Date.now()}`, JSON.stringify(previousCache)); } catch { /* Keep legacy cache intact if quota is full. */ }
      }
    }
    const tables = ['products', 'sales', 'expenses', 'work_shifts', 'app_users', 'ingredients', 'prepared_stock', 'orders', 'rota_shifts'] as const;
    let rows: Record<string, any[]>;
    try {
      const results = await Promise.all(tables.map(table => readAllPages((from, to) => supabase.from(table)
        .select(table === 'sales' ? '*, sale_items(*)' : '*').eq('business_id', businessId).order('id').range(from, to))));
      if (generation !== fetchGeneration.current) return;
      rows = Object.fromEntries(tables.map((table, index) => [table, results[index]]));
      if (['products', 'ingredients', 'prepared_stock'].some(table => rows[table].some(row => !Number.isSafeInteger(Number(row.id)))) ||
          rows.app_users.some(row => row.numeric_id == null || !Number.isSafeInteger(Number(row.numeric_id)))) {
        throw new Error('This database uses an incompatible schema. Apply the reviewed database upgrade before editing.');
      }
      setCloudLoadError(null);
    } catch (error) {
      if (generation !== fetchGeneration.current) return;
      setCloudLoadError(error instanceof Error ? error.message : 'Business data could not be loaded.');
      addToast('Business data could not be loaded. Reload before editing.', 'error');
      return;
    }
    setProducts(rows.products.map(mapProductRow));
    setSales(rows.sales.filter(row => !row.archived_at).map(mapSaleRow));
    setExpenses(rows.expenses.map(mapExpenseRow));
    setWorkShifts(rows.work_shifts.map(mapWorkShiftRow));
    setUsers(rows.app_users.map(mapUserRow));
    setIngredients(rows.ingredients.map(row => ({ id: Number(row.id), revision: Number(row.revision || 0), name: row.name, unit: row.unit, qty: Number(row.qty), lowThreshold: Number(row.low_threshold ?? 5) })));
    setPreparedStock(rows.prepared_stock.map(row => ({ id: Number(row.id), revision: Number(row.revision || 0), name: row.name, portions: Number(row.portions), lowThreshold: Number(row.low_threshold ?? 5) })));
    setOrders(rows.orders.map(mapOrderRow));
    setRota(rows.rota_shifts as RotaShift[]);
    if (switched) {
      const cached = loadPersistedOps(businessId);
      setCategories(cached?.categories || ['General']);
      setCashSessions(cached?.cashSessions || []); setShiftLogs(cached?.shiftLogs || []);
      setFloorPlan(normalizeFloorPlan(cached?.floorPlan)); setWasteLogs(cached?.wasteLogs || []);
      setCustomers(cached?.customers || []);
      setStaffAvailability(cached?.staffAvailability || []);
    }
    loadedBusiness.current = businessId;
  }, [addToast]);

  const applyStaffBusinessSession = useCallback(async (staffUser: User, businessId: string) => {
    clearStaffSession();
    setUser(staffUser);
    setActiveTab(staffUser.role === 'manager' ? 'orders' : 'cashier');
    setIsOnboarding(false);
    setIsBusinessSetupCompleted(true);

    if (businessId === DEMO_BUSINESS_ID) {
      applyDemoSession(staffUser);
      setUser(staffUser);
      return;
    }

    if (isLocalBusinessId(businessId)) {
      const account = loadLocalAccounts().find(a => a.business?.id === businessId);
      setIsDemoMode(false);
      if (account?.business) {
        setBusinessSettingsState(account.business);
        if (account.business.language) setLangState(normalizeAppLanguage(account.business.language));
      } else {
        setBusinessSettingsState({
          id: businessId,
          name: 'Local business',
          ownerName: '',
          ownerEmail: '',
          ownerPhone: '',
          venueType: 'Café',
          country: 'BE',
          city: '',
          currencyCode: 'EUR',
          currencySymbol: '€',
          language: 'en',
          enabledModules: {
            orders: true,
            sales: true,
            stock: true,
            staff: true,
            finance: true,
            tables: false,
            customers: false,
            tips: false,
            onlineOrders: false,
          },
        });
      }
      applyPersistedOpsToState(businessId);
      return;
    }

    setIsDemoMode(false);
    const { data: bizRow } = await supabase.from('businesses').select('*').eq('id', businessId).maybeSingle();
    if (bizRow) {
      const business = mapBusinessRow(bizRow as Record<string, unknown>);
      setBusinessSettingsState(business);
      if (business.language) setLangState(normalizeAppLanguage(business.language));
    }
    await fetchBusinessData(businessId);
    applyPersistedOpsToState(businessId);
  }, [applyDemoSession, applyPersistedOpsToState, fetchBusinessData]);

  useEffect(() => {
    const checkCurrentSession = async () => {
      if (isRecoveryHash()) {
        passwordRecoveryRef.current = true;
        setIsPasswordRecovery(true);
        setIsSessionLoading(false);
        return;
      }

      // Drop leftover offline accounts — they stored plaintext passwords.
      wipeLocalAccounts();
      clearStaffSession();
      // Scrub legacy roster passwords if any remain
      clearStaffRoster();

      // Restore local demo session first
      try {
        const demoRaw = localStorage.getItem(DEMO_SESSION_KEY);
        if (demoRaw) {
          const { username } = JSON.parse(demoRaw) as { username: string };
          const demoUser = DEFAULT_USERS.find((u) => u.username === username);
          if (demoUser) {
            await supabase.auth.signOut().catch(() => undefined);
            applyDemoSession({ ...(demoUser as User), password: undefined });
            setIsSessionLoading(false);
            return;
          }
        }
      } catch {
        localStorage.removeItem(DEMO_SESSION_KEY);
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
            .select(APP_USER_SAFE_COLUMNS)
            .eq('id', authUser.id)
            .maybeSingle();

          if (profileError) {
            throw new Error(`Unable to load your account: ${profileError.message}`);
          }

          if (userProfile && userProfile.businesses) {
            const business = mapBusinessRow(userProfile.businesses as unknown as Record<string, unknown>);
            setIsDemoMode(false);
            setBusinessSettingsState(business);
            setUser({
              id: Number(userProfile.numeric_id),
              authId: authUser.id,
              email: authUser.email,
              fullName: userProfile.full_name,
              username: userProfile.username,
              role: userProfile.role,
            });
            const setupDone = Boolean((userProfile.businesses as any)?.setup_completed);
            setIsBusinessSetupCompleted(setupDone);
            setIsOnboarding(!setupDone);
            setLangState(normalizeAppLanguage(localStorage.getItem(`previsio_language_${business.id}_${authUser.id}`) || business.language));
            fetchBusinessData(business.id);
          } else {
            setIsDemoMode(false);
            setUser({
              id: authUser.id as unknown as number,
              authId: authUser.id,
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
        console.warn('Supabase session check failed; staying logged out.', error);
        addToast(error instanceof Error ? error.message : 'Unable to load your account. Please try signing in again.', 'error');
      }
      setIsSessionLoading(false);
    };
    checkCurrentSession();

    let disposed = false;
    let authVersion = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const version = ++authVersion;
      // Return immediately: Supabase holds its auth lock while invoking this callback.
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (disposed || version !== authVersion) return;
        void handleAuthEvent();
      }, 0);
      timers.add(timer);
      async function handleAuthEvent() {
      const isAuthAction = _event === 'SIGNED_IN' || _event === 'SIGNED_OUT' || _event === 'PASSWORD_RECOVERY';
      try {
        if (_event === 'PASSWORD_RECOVERY') {
          passwordRecoveryRef.current = true;
          setIsPasswordRecovery(true);
          return;
        }
        if (localStorage.getItem(DEMO_SESSION_KEY)) {
          // Demo session owns the UI; ignore Supabase auth churn
          return;
        }
        if (passwordRecoveryRef.current && _event !== 'SIGNED_OUT') {
          return;
        }
        if (session) {
          const authUser = session.user;
          const { data: userProfile, error: profileError } = await supabase
            .from('app_users')
            .select(APP_USER_SAFE_COLUMNS)
            .eq('id', authUser.id)
            .maybeSingle();

          if (disposed || version !== authVersion) return;
          if (userProfile && userProfile.businesses) {
            const business = mapBusinessRow(userProfile.businesses as unknown as Record<string, unknown>);
            setIsDemoMode(false);
            setBusinessSettingsState(business);
            setUser({
              id: Number(userProfile.numeric_id),
              authId: authUser.id,
              email: authUser.email,
              fullName: userProfile.full_name,
              username: userProfile.username,
              role: userProfile.role,
            });
            const setupDone = Boolean((userProfile.businesses as any)?.setup_completed);
            setIsBusinessSetupCompleted(setupDone);
            setIsOnboarding(!setupDone);
            setLangState(normalizeAppLanguage(localStorage.getItem(`previsio_language_${business.id}_${authUser.id}`) || business.language));
            fetchBusinessData(business.id);
          } else {
            if (profileError) {
              throw new Error(`Unable to load your account: ${profileError.message}`);
            }
            setIsDemoMode(false);
            setUser({
              id: authUser.id as unknown as number,
              authId: authUser.id,
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
        addToast(error instanceof Error ? error.message : "Unable to load your account. Please try again.", "error");
      } finally {
        if (!disposed && version === authVersion && isAuthAction) {
          setIsLoggingIn(false);
        }
      }
      }
    });

    return () => { disposed = true; authVersion++; timers.forEach(clearTimeout); subscription.unsubscribe(); };
  }, [fetchBusinessData, applyDemoSession, applyStaffBusinessSession, addToast]);

  const registerAccount = async (payload: { fullName: string; username: string; email: string; password: string }) => {
    if (!payload.password || payload.password.length < 8) {
      addToast(t('passwordTooShort'), 'error');
      return { error: { message: t('passwordMinError') } };
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: payload.fullName,
            username: payload.username
          }
        }
      });

      if (authError) {
        const message = isNetworkAuthError(authError)
          ? t('authOffline')
          : authError.message;
        addToast(message, 'error');
        return { error: { message } };
      }

      clearLocalSession();
      setIsDemoMode(false);
      return { error: null, session: data.session };
    } catch (error) {
      const message = isNetworkAuthError(error)
        ? t('authOffline')
        : error instanceof Error ? error.message : 'Registration failed.';
      addToast(message, 'error');
      return { error: { message } };
    }
  };

  const provisionBusinessProfile = async (settings: Omit<BusinessSettings, 'id'>) => {
    clearLocalSession();

    let authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null = null;
    try {
      const { data: authState, error: sessionError } = await supabase.auth.getUser();
      if (sessionError || !authState.user) {
        const message = isNetworkAuthError(sessionError) ? t('authOffline') : (sessionError?.message || 'No authenticated user found.');
        return { error: { message } };
      }
      authUser = authState.user;
    } catch (error) {
      const message = isNetworkAuthError(error)
        ? t('authOffline')
        : error instanceof Error ? error.message : 'No authenticated user found.';
      return { error: { message } };
    }

    if (!authUser) {
      return { error: { message: 'No authenticated user found.' } };
    }

    // Validate required columns before writing anything. Never retry by dropping
    // fields or bypassing the policies when the deployment schema is outdated.
    for (const [table, columns] of [
      ['businesses', 'id,address,discount_policy,brand_theme,setup_completed'],
      ['app_users', 'id,numeric_id,email'],
    ]) {
      const { error } = await supabase.from(table).select(columns).limit(0);
      if (error) return { error: { message: `Business setup cannot continue because the connected database is not ready: ${error.message}. The app administrator must apply the compatible database setup before you retry.` } };
    }

    const { data, error } = await supabase.rpc('previsio_provision_business', {
      settings: businessToRow(settings as BusinessSettings),
    });
    if (error) return { error };
    if (!data?.business?.id || (!Number.isSafeInteger(Number(data.numeric_id)) || Number(data.numeric_id)<=0)) {
      return { error: { message: 'Business setup returned an invalid profile. Please contact the app administrator.' } };
    }
    const business = mapBusinessRow(data.business);
    setBusinessSettingsState(business);
    setLangState(normalizeAppLanguage(settings.language || business.language));
    setUser({ id: Number(data.numeric_id), authId: authUser.id, email: authUser.email,
      fullName: data.full_name, username: data.username, role: 'owner' });
    setIsOnboarding(!data.business.setup_completed);
    setIsBusinessSetupCompleted(Boolean(data.business.setup_completed));
    setActiveTab('overview');
    addToast(t('businessRegistered'), 'success');
    return { error: null };
  };

  const login = async (payload: { identifier: string; password: string; mode: 'owner' | 'staff' }) => {
    try {
      localStorage.removeItem(DEMO_SESSION_KEY);
      clearStaffSession();

      const email = payload.identifier.trim().toLowerCase();
      if (!email.includes('@')) {
        throw new Error(payload.mode === 'staff' ? 'Use the staff member’s email to sign in.' : 'Enter a valid email.');
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: payload.password,
      });
      if (error) {
        if (isNetworkAuthError(error)) {
          throw new Error(t('authOffline'));
        }
        throw error;
      }
      // onAuthStateChange finishes the session for owners and staff
    } catch (error) {
      setIsLoggingIn(false);
      throw error;
    }
  };

  const completePasswordRecovery = () => {
    passwordRecoveryRef.current = false;
    setIsPasswordRecovery(false);
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const startDemoSession = (role: Role = 'owner') => {
    void supabase.auth.signOut().catch(() => undefined);
    clearStaffSession();
    const wanted: Role = role === 'manager' || role === 'staff' ? role : 'owner';
    const demoUser = DEFAULT_USERS.find(u => u.role === wanted) || DEFAULT_USERS.find(u => u.role === 'owner');
    applyDemoSession({
      id: demoUser?.id ?? 1,
      username: demoUser?.username || 'owner@123.com',
      fullName: demoUser?.fullName || 'PreVisio Owner',
      role: (demoUser?.role as Role) || 'owner',
      email: demoUser?.email || (wanted === 'owner' ? 'owner@123.com' : undefined),
      hourlyRate: wanted === 'owner' ? 25 : wanted === 'manager' ? 18 : 14,
    } as User);
    const roleLabel = wanted === 'staff' ? t('staffRole') : t(wanted);
    addToast(`${t('demoDataLoaded')} (${roleLabel})`);
  };

  /** Flip between owner / manager / staff views without reloading demo data. */
  const switchDemoRole = (role: Role) => {
    if (!isDemoMode) return;
    const wanted: Role = role === 'manager' || role === 'staff' ? role : 'owner';
    const demoUser = DEFAULT_USERS.find(u => u.role === wanted);
    if (!demoUser) return;
    setUser({
      id: demoUser.id,
      username: demoUser.username,
      fullName: demoUser.fullName,
      role: demoUser.role as Role,
      email: demoUser.email,
      hourlyRate: wanted === 'owner' ? 25 : wanted === 'manager' ? 18 : 14,
    });
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ username: demoUser.username }));
    setActiveTab(wanted === 'staff' ? 'cashier' : wanted === 'manager' ? 'orders' : 'overview');
    const roleLabel = wanted === 'staff' ? t('staffRole') : t(wanted);
    addToast(`${t('demoSwitchedRole') || 'Now viewing'}: ${roleLabel}`, 'info');
  };

  const logout = () => {
    fetchGeneration.current += 1;
    loadedBusiness.current = null;
    setIsLoggingIn(true);
    localStorage.removeItem(DEMO_SESSION_KEY);
    wipeLocalAccounts();
    clearStaffSession();
    clearStaffRoster();
    // Keep previsio_ops_v1 so demo/local till work survives logout (resetAllData still clears).
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
    setCashSessions([]);
    setBusinessSettingsState(null);
    setUser(null);
    setIsBusinessSetupCompleted(false);
    setIsOnboarding(false);
    setActiveTab('overview');
    addToast(t('logout'), 'info');
  };

  const inviteStaff = async (payload: { fullName: string; username: string; password: string; role: Role; email?: string }) => {
    const email = (payload.email || '').trim().toLowerCase();
    const username = payload.username.trim();
    const role = payload.role === 'owner' ? 'staff' : payload.role;

    if (!username || !email) {
      return { error: 'Email and username are required.' };
    }
    if (!isPasswordStrongEnough(payload.password)) {
      return { error: t('passwordTooWeak') || t('passwordTooShort') };
    }
    if (users.some(u => u.username === username || (u.email || '').toLowerCase() === email)) {
      return { error: 'Username or email already taken.' };
    }

    const safeUser: User = {
      id: Date.now(),
      fullName: payload.fullName,
      username,
      role,
      email,
      hourlyRate: role === 'manager' ? 18 : 14,
    };

    if (isDemoBusiness || isDemoMode) {
      setUsers(prev => [...prev, safeUser]);
      upsertStaffRosterEntry({ ...safeUser, businessId: DEMO_BUSINESS_ID });
      return {
        error: null,
        credentials: { username: email, password: '(demo — use Try demo for staff)' },
      };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return { error: 'You must be signed in as the owner to invite staff.' };
    }

    try {
      const res = await fetch('/api/invite-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: payload.fullName,
          username,
          email,
          password: payload.password,
          role,
        }),
      });
      const body = (await res.json()) as { error?: string; user?: { id: string; numericId: number; revision: number; username: string; fullName: string; email: string; role: Role } };
      if (!res.ok) {
        return { error: body.error || 'Invite failed' };
      }
      const created = body.user;
      const invited: User = {
        id: Number(created?.numericId),
        authId: created?.id,
        revision: created?.revision ?? 0,
        username: created?.username || username,
        fullName: created?.fullName || payload.fullName,
        email: created?.email || email,
        role: (created?.role as Role) || role,
        hourlyRate: role === 'manager' ? 18 : 14,
      };
      setUsers(prev => [...prev, invited]);
      upsertStaffRosterEntry({
        ...invited,
        businessId: businessSettings?.id || '',
      });
      return {
        error: null,
        credentials: { username: email, password: '(sent — staff sign in with this email)' },
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invite failed' };
    }
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
          .eq('id', businessSettings.id).select('id').single();
        if (error) {
          addToast(`Error saving setup status: ${error.message}`, 'error');
          return false;
        }
      } catch (error) {
        addToast('Setup was not saved. Please reconnect and retry.', 'error');
        return false;
      }
    }
    setIsOnboarding(false);
    setIsBusinessSetupCompleted(true);
    queueTourAfterSetup();
    return true;
  };

  const loadDemoData = () => {
    if (businessSettings?.id !== DEMO_BUSINESS_ID && !isDemoMode) {
      addToast(t('demoDataYdPlaceOnly') || 'Demo data is only available for the Y\'D Place account.', 'error');
      return;
    }
    applyDemoSession({
      id: 1,
      username: 'owner@123.com',
      fullName: 'PreVisio Owner',
      role: 'owner',
      email: 'owner@123.com',
    } as User);
    addToast(t('demoDataLoaded'));
  };

  const saveBusinessSettings = async (settings: BusinessSettings) => {
    if (isDemoBusiness || settings.id === DEMO_BUSINESS_ID || isLocalBusinessId(settings.id)) {
      const localSession = getLocalSession();
      if (localSession) {
        const account = getLocalAccountById(localSession.accountId);
        if (account) upsertLocalAccount({ ...account, business: settings });
      }
      setBusinessSettingsState(settings);
      if (settings.language) setLangState(normalizeAppLanguage(settings.language));
      addToast(t('settingsUpdated'), 'success');
      return true;
    }

    try {
      const { error } = await supabase
        .from('businesses')
        .update(businessToRow(settings))
        .eq('id', settings.id).select('id').single();

      if (error) throw new Error(error.message);
      setBusinessSettingsState(settings);
      if (settings.language) setLangState(normalizeAppLanguage(settings.language));
      addToast(t('settingsUpdated'), 'success');
      return true;
    } catch (error) {
      addToast('Settings were not saved. Please retry when connected.', 'error');
      return false;
    }
  };

  const saveOrder = async (order: Order): Promise<boolean> => {
    if (!businessSettings) return false;
    if (isDemoBusiness) { setOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]); return true; }
    const existing = orders.find(o => o.id === order.id);
    const { data, error } = await supabase.rpc('previsio_mutate', { collection: 'orders', biz: businessSettings.id,
      changes: [{ row: orderToRow(order, businessSettings.id), expected: existing ? existing.revision ?? 0 : null }] });
    if (error) { addToast(`Order not saved: ${error.message}`, 'error'); return false; }
    const saved = mapOrderRow(data[0]);
    setOrders(prev => [saved, ...prev.filter(o => o.id !== saved.id)]);
    return true;
  };

  const recordSale = async (sale: Sale, order?: Order): Promise<boolean> => {
    if (!businessSettings?.id) return false;
    if (!isDemoBusiness) {
      const { error } = await supabase.rpc('previsio_record_sale', {
        biz: businessSettings.id, sale: saleToRow(sale, businessSettings.id),
        lines: saleItemsToRows(sale), order_row: order ? { ...orderToRow(order, businessSettings.id), revision: orders.find(o => o.id === order.id)?.revision ?? null } : null,
      });
      if (error) { addToast(`Sale not saved: ${error.message}`, 'error'); return false; }
      await fetchBusinessData(businessSettings.id);
    } else {
      setSales(prev => prev.some(s => s.id === sale.id) ? prev : [...prev, sale]);
      if (order) setOrders(prev => [order, ...prev.filter(o => o.id !== order.id)]);
    }
    if (normalizeEnabledModules(businessSettings.enabledModules).customers && (sale.customerPhone || sale.customerName)) {
      setCustomers(prev => upsertCustomerFromOrder(prev, { name: sale.customerName, phone: sale.customerPhone, at: sale.timestamp }).customers);
    }
    return true;
  };

  const markSaleStatus = async (saleId: string, status: 'voided' | 'refunded', reason?: string, orderStatus: 'Cancelled' | 'Preparing' | 'Ready' = 'Cancelled'): Promise<boolean> => {
    if (!businessSettings?.id) return false;
    if (!isDemoBusiness) {
      const { error } = await supabase.rpc('previsio_reverse_sale', { biz: businessSettings.id, sale_id: saleId, new_status: status, reason: reason || null, order_status: orderStatus });
      if (error) { addToast(`Sale not changed: ${error.message}`, 'error'); return false; }
      await fetchBusinessData(businessSettings.id);
    } else {
      const sale = sales.find(s => s.id === saleId);
      if (!sale) return false;
      if (sale.status !== 'voided' && sale.status !== 'refunded') {
        const restored = restoreStock(sale.items, products, ingredients, preparedStock);
        setIngredients(restored.ingredients); setPreparedStock(restored.preparedStock);
        setSales(prev => prev.map(s => s.id === saleId ? { ...s, status, voidReason: reason, refundedAt: status === 'refunded' ? Date.now() : undefined } : s));
      }
      setOrders(prev => prev.map(o => o.saleId === saleId ? { ...o, status: orderStatus, saleId: orderStatus === 'Cancelled' ? o.saleId : undefined, completedAt: undefined, lastUpdatedAt: Date.now() } : o));
    }
    return true;
  };

  const addSale = async (sale: Omit<Sale, 'id' | 'timestamp' | 'cashierFullName' | 'cashierUsername'>) => {
    if (!user || !businessSettings) return;
    const full: Sale = {
      ...sale,
      id: `SALE-${Date.now()}`,
      timestamp: Date.now(),
      cashierUsername: user.username,
      cashierFullName: user.fullName,
      status: sale.status || 'completed',
    };
    if (await recordSale(full)) addToast(t('orderSent'));
  };

  const updateSale = async (sale: Sale) => {
    if (isDemoBusiness) { setSales(prev => prev.map(s => s.id === sale.id ? sale : s)); addToast(t('saleUpdated')); return true; }
    if (!businessSettings) return false;
    const { error } = await supabase.rpc('previsio_amend_sale', { biz: businessSettings.id, sale_id: sale.id, payment: sale.paymentMethod, expected_subtotal: sale.subtotal, archive: false });
    if (error) { addToast(`Sale not changed: ${error.message}`, 'error'); return false; }
    await fetchBusinessData(businessSettings.id); addToast(t('saleUpdated')); return true;
  };

  const deleteSale = async (saleId: string) => {
    if (isDemoBusiness) { setSales(prev => prev.filter(s => s.id !== saleId)); addToast(t('saleDeleted')); return true; }
    if (!businessSettings) return false;
    const { error } = await supabase.rpc('previsio_amend_sale', { biz: businessSettings.id, sale_id: saleId, payment: null, expected_subtotal: null, archive: true });
    if (error) { addToast(`Sale not removed: ${error.message}`, 'error'); return false; }
    await fetchBusinessData(businessSettings.id); addToast(t('saleDeleted')); return true;
  };

  const openShiftLog = user ? shiftLogs.find(l => l.username === user.username && !l.logoutTime) || null : null;
  const openCashSession = cashSessions.find(s => !s.closedAt) || null;

  const clockIn = () => {
    if (!user) return;
    if (shiftLogs.some(l => l.username === user.username && !l.logoutTime)) {
      addToast(t('clockedIn'), 'info');
      return;
    }
    const log: ShiftLog = {
      id: Date.now(),
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      loginTime: Date.now(),
      logoutTime: null,
      ordersProcessed: 0,
    };
    setShiftLogs(prev => [...prev, log]);
    addToast(t('clockIn'), 'success');
  };

  const clockOut = () => {
    if (!user) return;
    setShiftLogs(prev =>
      prev.map(l =>
        l.username === user.username && !l.logoutTime ? { ...l, logoutTime: Date.now() } : l
      )
    );
    addToast(t('clockOut'), 'success');
  };

  const openTill = (openingFloat: number) => {
    if (!user) return;
    if (cashSessions.some(s => !s.closedAt)) {
      addToast(t('tillOpen'), 'info');
      return;
    }
    setCashSessions(prev => [
      ...prev,
      {
        id: `TILL-${Date.now()}`,
        openedAt: Date.now(),
        openingFloat: Math.max(0, openingFloat || 0),
        openedBy: user.username,
      },
    ]);
    addToast(t('tillOpen'), 'success');
  };

  const closeTill = (countedCash: number): CashSession | null => {
    if (!user) return null;
    const open = cashSessions.find(s => !s.closedAt);
    if (!open) return null;
    const closed: CashSession = {
      ...open,
      closedAt: Date.now(),
      closingCounted: countedCash,
      closedBy: user.username,
    };
    setCashSessions(prev => prev.map(s => (s.id === open.id ? closed : s)));
    addToast(t('closeTill'), 'success');
    return closed;
  };

  const refundSale = async (saleId: string, reason?: string) => {
    if (!await markSaleStatus(saleId, 'refunded', reason)) return false;
    if (isDemoBusiness) setOrders(prev => prev.map(o => o.saleId === saleId ? { ...o, status: 'Cancelled', voidReason: reason, lastUpdatedAt: Date.now() } : o));
    addToast(t('refundSale'), 'info');
    return true;
  };

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    if (!businessSettings) return false;
    if (isDemoBusiness) {
      setExpenses(prev => [...prev, { ...expense, id: `EXP-${Date.now()}` }]);
      addToast(t('addExpense'), 'success');
      return true;
    }
    const { data, error } = await supabase
      .from('expenses')
      .insert([expenseToRow(expense, businessSettings.id)])
      .select()
      .single();
    if (error) { addToast(error.message, 'error'); return false; }
    else {
      setExpenses(prev => [...prev, mapExpenseRow(data as Record<string, unknown>)]);
      addToast(t('addExpense'), 'success');
      return true;
    }
  };

  const updateExpense = async (expense: Expense) => {
    if (isDemoBusiness) {
      setExpenses(prev => prev.map(e => e.id === expense.id ? expense : e));
      addToast(t('editExpense'), 'success');
      return true;
    }
    const { data, error } = await supabase
      .from('expenses')
      .update(expenseToRow(expense, businessSettings!.id))
      .eq('id', expense.id)
      .select()
      .single();
    if (error) { addToast(error.message, 'error'); return false; }
    else {
      setExpenses(prev => prev.map(e => e.id === expense.id ? mapExpenseRow(data as Record<string, unknown>) : e));
      addToast(t('editExpense'), 'success');
      return true;
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

  const saveRota = async (newRota: RotaShift[]) => { cloudSetRota(newRota); };

  // Persist ops locally so kitchen/stock survive refresh (all tenants)
  useEffect(() => {
    if (!businessSettings?.id || (!isDemoBusiness && loadedBusiness.current !== businessSettings.id)) return;
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
      cashSessions,
      floorPlan,
      wasteLogs,
      customers,
      updatedAt: Date.now(),
    });
  }, [
    businessSettings?.id,
    products, ingredients, preparedStock, sales, orders, expenses,
    workShifts, shiftLogs, users, categories, rota, staffAvailability, taxSettings, cashSessions, floorPlan,
    wasteLogs, customers,
  ]);

  const reportSaveError = (message: string) => addToast(message, 'error');
  const cloudSetProducts = useCloudCollection('products', businessSettings?.id, isDemoBusiness,
    products, setProducts, productToRow, reportSaveError);
  const cloudSetIngredients = useCloudCollection('ingredients', businessSettings?.id, isDemoBusiness,
    ingredients, setIngredients, (i, business_id) => ({ id: i.id, business_id, name: i.name, unit: i.unit, qty: i.qty, low_threshold: i.lowThreshold }), reportSaveError);
  const cloudSetPreparedStock = useCloudCollection('prepared_stock', businessSettings?.id, isDemoBusiness,
    preparedStock, setPreparedStock, (p, business_id) => ({ id: p.id, business_id, name: p.name, portions: p.portions, low_threshold: p.lowThreshold }), reportSaveError);
  const cloudSetOrders = useCloudCollection('orders', businessSettings?.id, isDemoBusiness,
    orders, setOrders, orderToRow, reportSaveError);

  const cloudSetRota = useCloudCollection('rota_shifts', businessSettings?.id, isDemoBusiness,
    rota, setRota, (r, business_id) => ({ id: r.id, business_id, userId: r.userId, username: r.username, fullName: r.fullName, date: r.date, startTime: r.startTime || null, endTime: r.endTime || null }), reportSaveError);

  const cloudSetUsers = useCloudCollection('app_users', businessSettings?.id, isDemoBusiness,
    users, setUsers, (u, business_id) => ({ id: u.authId || String(u.id), business_id, username: u.username, full_name: u.fullName, email: u.email || null, role: u.role, hourly_rate: u.hourlyRate ?? null }), reportSaveError);
  const cloudSetWorkShifts = useCloudCollection('work_shifts', businessSettings?.id, isDemoBusiness,
    workShifts, setWorkShifts, (w, business_id) => ({ id: w.id, ...workShiftToRow(w, business_id), pay_amount: w.payAmount ?? null, kind: w.kind || 'worked', leave_reason: w.leaveReason || null }), reportSaveError);

  // Merge online pre-orders from public order page inbox
  useEffect(() => {
    if (!businessSettings?.id) return;
    if (!normalizeEnabledModules(businessSettings.enabledModules).onlineOrders) return;
    const businessId = businessSettings.id;
    const pull = () => {
      const inbox = loadOnlineInbox(businessId);
      const ops = loadPersistedOps(businessId);
      const fromOps = (ops?.orders || []).filter(o => o.source === 'online');
      const byId = new Map<string, (typeof inbox)[0]>();
      [...fromOps, ...inbox].forEach(o => byId.set(o.id, o));
      const candidates = Array.from(byId.values());
      if (!candidates.length) return;
      setOrders(prev => {
        const ids = new Set(prev.map(o => o.id));
        const fresh = candidates.filter(o => !ids.has(o.id));
        if (!fresh.length) return prev;
        addToast(t('onlineOrdersReceived'), 'info');
        return [...fresh, ...prev];
      });
      if (inbox.length) clearOnlineInbox(businessId);
    };
    pull();
    const id = window.setInterval(pull, 2500);
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === `previsio_online_ping_${businessId}` || e.key === `previsio_online_inbox_${businessId}`) {
        pull();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('storage', onStorage);
    };
  }, [businessSettings?.id, businessSettings?.enabledModules, addToast, t]);

  // Publish menu snapshot for branded online ordering
  useEffect(() => {
    if (!businessSettings?.id) return;
    const modules = normalizeEnabledModules(businessSettings.enabledModules);
    savePublicMenuSnapshot({
      businessId: businessSettings.id,
      businessName: businessSettings.name,
      currencySymbol: businessSettings.currencySymbol || '€',
      onlineOrdersEnabled: modules.onlineOrders,
      products: products
        .filter(p => p.active !== false)
        .map(p => ({
          id: p.id,
          nameEN: p.nameEN,
          category: p.category,
          price: p.price,
          emoji: p.emoji,
          active: p.active,
          isFavourite: p.isFavourite,
          posColor: p.posColor,
          extraIds: p.extraIds,
        })),
      updatedAt: Date.now(),
    });
  }, [businessSettings?.id, businessSettings?.name, businessSettings?.currencySymbol, businessSettings?.enabledModules, products]);

  useEffect(() => {
    if (!businessSettings?.id || isDemoBusiness) return;
    const businessId = businessSettings.id;
    const channel = supabase
      .channel(`orders-${businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `business_id=eq.${businessId}` },
        payload => {
          const row = (payload.new || payload.old) as Record<string, unknown> | undefined;
          if (!row) return;
          if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== String(row.id)));
            return;
          }
          const mapped = mapOrderRow(row);
          setOrders(prev => {
            const idx = prev.findIndex(o => o.id === mapped.id);
            if (idx < 0) return [mapped, ...prev];
            const next = [...prev];
            next[idx] = { ...next[idx], ...mapped };
            return next;
          });
        }
      )
      .subscribe();

    const stockChannel = supabase
      .channel(`stock-${businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ingredients', filter: `business_id=eq.${businessId}` },
        payload => {
          const row = payload.new as Record<string, unknown> | undefined;
          if (!row || payload.eventType === 'DELETE') {
            if (payload.old) setIngredients(prev => prev.filter(i => i.id !== Number((payload.old as any).id)));
            return;
          }
          const mapped: Ingredient = {
            id: Number(row.id),
            revision: Number(row.revision ?? 0),
            name: String(row.name ?? ''),
            unit: String(row.unit ?? 'pcs'),
            qty: Number(row.qty ?? 0),
            lowThreshold: Number(row.low_threshold ?? 5),
          };
          setIngredients(prev => {
            const idx = prev.findIndex(i => i.id === mapped.id);
            if (idx < 0) return [...prev, mapped];
            const next = [...prev];
            next[idx] = mapped;
            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prepared_stock', filter: `business_id=eq.${businessId}` },
        payload => {
          const row = payload.new as Record<string, unknown> | undefined;
          if (!row || payload.eventType === 'DELETE') {
            if (payload.old) setPreparedStock(prev => prev.filter(p => p.id !== Number((payload.old as any).id)));
            return;
          }
          const mapped: PreparedStock = {
            id: Number(row.id),
            revision: Number(row.revision ?? 0),
            name: String(row.name ?? ''),
            portions: Number(row.portions ?? 0),
            lowThreshold: Number(row.low_threshold ?? 5),
          };
          setPreparedStock(prev => {
            const idx = prev.findIndex(p => p.id === mapped.id);
            if (idx < 0) return [...prev, mapped];
            const next = [...prev];
            next[idx] = mapped;
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(stockChannel);
    };
  }, [businessSettings?.id, isDemoBusiness]);

  return (
    <AppContext.Provider value={{
      accountAppearance, setAccountAppearance,
      lang, setLang, t, tp, tc, activeTab, setActiveTab,
      user, setUser, products, setProducts: cloudSetProducts, ingredients, setIngredients: cloudSetIngredients,
      preparedStock, setPreparedStock: cloudSetPreparedStock,
      sales, setSales, deleteSale, updateSale, addSale, recordSale, saveOrder, markSaleStatus, orders, setOrders: cloudSetOrders, users, setUsers: cloudSetUsers, categories, setCategories,
      expenses, addExpense, updateExpense, deleteExpense,
      workShifts, setWorkShifts: cloudSetWorkShifts, addWorkShift, updateWorkShift, deleteWorkShift,
      shiftLogs, setShiftLogs, clockIn, clockOut, openShiftLog,
      cashSessions, openTill, closeTill, openCashSession, refundSale,
      floorPlan, setFloorPlan, pendingTableSession, setPendingTableSession,
      wasteLogs, setWasteLogs, customers, setCustomers,
      rota, setRota: cloudSetRota, saveRota, staffAvailability, setStaffAvailability, isSessionLoading,
      taxSettings, setTaxSettings, landingPageConfig, setLandingPageConfig, hasLandingPage: !!landingPageConfig, isLoggingIn,
      toasts, addToast, logout, resetAllData, formatPrice,
      businessSettings, setBusinessSettings: setBusinessSettingsState, saveBusinessSettings,
      registerAccount, provisionBusinessProfile, login, inviteStaff, ensureLandingForDemo, isFirstTime, isBusinessSetupCompleted, setIsBusinessSetupCompleted,
      isOnboarding, startOnboarding, completeOnboarding, loadDemoData, startDemoSession, switchDemoRole, isPasswordRecovery, completePasswordRecovery, isDemoMode, cloudLoadError, refreshBusinessData: async () => { if (businessSettings?.id && !isDemoBusiness) await fetchBusinessData(businessSettings.id); }
    }}>
      {user && businessSettings?.id && !isDemoBusiness && <BrowserBackup key={`${businessSettings.id}:${user.authId || user.id}`} businessId={businessSettings.id} />}
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
