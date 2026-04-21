
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Product, Ingredient, PreparedStock, Sale, ShiftLog, Language, Role, Expense, TaxSettings, WorkShift, BusinessSettings, Order, RotaShift, StaffAvailability } from './types';
import { DEFAULT_PRODUCTS, DEFAULT_INGREDIENTS, DEFAULT_USERS, TRANSLATIONS, DEFAULT_CATEGORIES } from './constants';
import { generateDemoData } from './utils/demoData';

interface AppContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
  tp: (product: Product | undefined) => string;
  tc: (category: string) => string;
  user: User | null;
  setUser: (u: User | null) => void;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  preparedStock: PreparedStock[];
  setPreparedStock: React.Dispatch<React.SetStateAction<PreparedStock[]>>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  shiftLogs: ShiftLog[];
  setShiftLogs: React.Dispatch<React.SetStateAction<ShiftLog[]>>;
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  workShifts: WorkShift[];
  setWorkShifts: React.Dispatch<React.SetStateAction<WorkShift[]>>;
  rota: RotaShift[];
  setRota: React.Dispatch<React.SetStateAction<RotaShift[]>>;
  staffAvailability: StaffAvailability[];
  setStaffAvailability: React.Dispatch<React.SetStateAction<StaffAvailability[]>>;
  taxSettings: TaxSettings;
  setTaxSettings: React.Dispatch<React.SetStateAction<TaxSettings>>;
  toasts: { id: number; message: string; type: 'success' | 'error' | 'info' }[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  logout: () => void;
  resetAllData: () => void;
  formatPrice: (amount: number, showCode?: boolean) => React.ReactNode;
  // Multi-business
  businessSettings: BusinessSettings | null;
  setBusinessSettings: (s: BusinessSettings) => void;
  registerBusiness: (s: BusinessSettings, owner: User) => void;
  loginToBusiness: (payload: { mode: 'owner' | 'staff'; restaurantName: string; identifier: string; password: string }) => boolean;
  isFirstTime: boolean;
  isOnboarding: boolean;
  completeOnboarding: () => void;
  loadDemoData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
export { AppContext };


export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentBizId, setCurrentBizId] = useState<string | null>(localStorage.getItem('current_biz_id'));
  const [businessSettings, setBusinessSettingsState] = useState<BusinessSettings | null>(null);
  
  const getPrefix = () => {
    if (!currentBizId || currentBizId === 'ydplace') return 'ydplace_';
    return `biz_${currentBizId}_`;
  };

  const getPrefixForBiz = (bizId: string) => {
    if (bizId === 'ydplace') return 'ydplace_';
    return `biz_${bizId}_`;
  };

  const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

  const [lang, setLangState] = useState<Language>('en');
  
  const setLang = (l: Language) => {
    setLangState(l);
    if (businessSettings) {
      const updated = { ...businessSettings, language: l };
      setBusinessSettingsState(updated);
      const prefix = getPrefix();
      localStorage.setItem(`${prefix}settings`, JSON.stringify(updated));
    }
  };
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [preparedStock, setPreparedStock] = useState<PreparedStock[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [shiftLogs, setShiftLogs] = useState<ShiftLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [rota, setRota] = useState<RotaShift[]>([]);
  const [staffAvailability, setStaffAvailability] = useState<StaffAvailability[]>([]);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({ municipalTaxRate: 7, vatRegime: 'Standard' });
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const [isOnboarding, setIsOnboarding] = useState(false);

  const t = (key: string) => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    return (dict as any)[key] || key;
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

  useEffect(() => {
    if (!currentBizId) {
      return;
    }

    const prefix = getPrefix();
    const storedSettings = localStorage.getItem(`${prefix}settings`);
    if (storedSettings) {
      const settings = JSON.parse(storedSettings);
      setBusinessSettingsState(settings);
      setLang(settings.language || 'en');
    } else if (currentBizId === 'ydplace') {
      // Legacy PreVisio settings
      const ydSettings: BusinessSettings = {
        id: 'ydplace',
        name: 'PreVisio',
        ownerName: 'PreVisio Owner',
        ownerEmail: 'owner@123.com',
        ownerPhone: '',
        venueType: 'Food Truck',
        country: 'Belgium',
        city: 'Brussels',
        currencyCode: 'EUR',
        currencySymbol: '€',
        language: (localStorage.getItem('ydplace_lang') as Language) || 'en'
      };
      setBusinessSettingsState(ydSettings);
      setLang(ydSettings.language);
    }

    const storedUser = localStorage.getItem(`${prefix}user`);
    setUser(storedUser ? JSON.parse(storedUser) : null);

    const storedProducts = localStorage.getItem(`${prefix}products`);
    const storedIngredients = localStorage.getItem(`${prefix}ingredients`);
    const storedPreparedStock = localStorage.getItem(`${prefix}preparedstock`);
    const storedUsers = localStorage.getItem(`${prefix}users`);
    const storedCategories = localStorage.getItem(`${prefix}categories`);
    const storedSales = localStorage.getItem(`${prefix}sales`);
    const storedOrders = localStorage.getItem(`${prefix}orders`);
    const storedShiftLogs = localStorage.getItem(`${prefix}shiftlogs`);
    const storedExpenses = localStorage.getItem(`${prefix}expenses`);
    const storedWorkShifts = localStorage.getItem(`${prefix}workshifts`);
    const storedRota = localStorage.getItem(`${prefix}rota`);
    const storedAvailability = localStorage.getItem(`${prefix}staff_availability`);
    const storedTaxSettings = localStorage.getItem(`${prefix}tax_settings`);

    if (currentBizId === 'ydplace') {
      const demo = generateDemoData();
      setProducts(storedProducts ? JSON.parse(storedProducts) : demo.products);
      setIngredients(storedIngredients ? JSON.parse(storedIngredients) : demo.ingredients);
      setPreparedStock(storedPreparedStock ? JSON.parse(storedPreparedStock) : demo.preparedStock);
      setUsers(storedUsers ? JSON.parse(storedUsers) : demo.users);
      setCategories(storedCategories ? JSON.parse(storedCategories) : DEFAULT_CATEGORIES);
      setSales(storedSales ? JSON.parse(storedSales) : demo.sales);
      setOrders(storedOrders ? JSON.parse(storedOrders) : []);
      setShiftLogs(storedShiftLogs ? JSON.parse(storedShiftLogs) : demo.shiftLogs);
      setExpenses(storedExpenses ? JSON.parse(storedExpenses) : demo.expenses);
      setWorkShifts(storedWorkShifts ? JSON.parse(storedWorkShifts) : demo.workShifts);
      setRota(storedRota ? JSON.parse(storedRota) : []);
      setStaffAvailability(storedAvailability ? JSON.parse(storedAvailability) : []);
      setTaxSettings(storedTaxSettings ? JSON.parse(storedTaxSettings) : { 
        municipalTaxRate: 7, 
        vatRegime: 'Standard',
        countryCode: 'BE'
      });
    } else {
      setProducts(storedProducts ? JSON.parse(storedProducts) : []);
      setIngredients(storedIngredients ? JSON.parse(storedIngredients) : []);
      setPreparedStock(storedPreparedStock ? JSON.parse(storedPreparedStock) : []);
      setUsers(storedUsers ? JSON.parse(storedUsers) : []);
      setCategories(storedCategories ? JSON.parse(storedCategories) : ['General']);
      setSales(storedSales ? JSON.parse(storedSales) : []);
      setOrders(storedOrders ? JSON.parse(storedOrders) : []);
      setShiftLogs(storedShiftLogs ? JSON.parse(storedShiftLogs) : []);
      setExpenses(storedExpenses ? JSON.parse(storedExpenses) : []);
      setWorkShifts(storedWorkShifts ? JSON.parse(storedWorkShifts) : []);
      setRota(storedRota ? JSON.parse(storedRota) : []);
      setStaffAvailability(storedAvailability ? JSON.parse(storedAvailability) : []);
      setTaxSettings(storedTaxSettings ? JSON.parse(storedTaxSettings) : { 
        municipalTaxRate: 7, 
        vatRegime: 'Standard',
        countryCode: undefined
      });
    }

    const onboardingComplete = localStorage.getItem(`${prefix}onboarding_complete`);
    if (currentBizId && currentBizId !== 'ydplace' && !onboardingComplete) {
      setIsOnboarding(true);
    } else {
      setIsOnboarding(false);
    }

  }, [currentBizId]);

  useEffect(() => {
    if (!currentBizId) return;
    const prefix = getPrefix();
    localStorage.setItem(`${prefix}products`, JSON.stringify(products));
    localStorage.setItem(`${prefix}ingredients`, JSON.stringify(ingredients));
    localStorage.setItem(`${prefix}preparedstock`, JSON.stringify(preparedStock));
    localStorage.setItem(`${prefix}users`, JSON.stringify(users));
    localStorage.setItem(`${prefix}categories`, JSON.stringify(categories));
    localStorage.setItem(`${prefix}sales`, JSON.stringify(sales));
    localStorage.setItem(`${prefix}orders`, JSON.stringify(orders));
    localStorage.setItem(`${prefix}shiftlogs`, JSON.stringify(shiftLogs));
    localStorage.setItem(`${prefix}expenses`, JSON.stringify(expenses));
    localStorage.setItem(`${prefix}workshifts`, JSON.stringify(workShifts));
    localStorage.setItem(`${prefix}rota`, JSON.stringify(rota));
    localStorage.setItem(`${prefix}staff_availability`, JSON.stringify(staffAvailability));
    localStorage.setItem(`${prefix}tax_settings`, JSON.stringify(taxSettings));
    localStorage.setItem(`${prefix}lang`, lang);
    localStorage.setItem(`${prefix}user`, JSON.stringify(user));
    if (businessSettings) {
      localStorage.setItem(`${prefix}settings`, JSON.stringify(businessSettings));
    }
  }, [products, ingredients, users, categories, sales, orders, shiftLogs, expenses, workShifts, rota, staffAvailability, taxSettings, lang, user, businessSettings, currentBizId]);

  const registerBusiness = (settings: BusinessSettings, owner: User) => {
    const registry = JSON.parse(localStorage.getItem('biz_registry') || '[]');
    registry.push({
      id: settings.id,
      name: settings.name,
      ownerEmail: settings.ownerEmail,
      ownerName: owner.fullName,
      username: owner.username,
      password: owner.password // In a real app, this would be hashed
    });
    localStorage.setItem('biz_registry', JSON.stringify(registry));
    
    const prefix = `biz_${settings.id}_`;
    localStorage.setItem(`${prefix}user`, JSON.stringify(owner));
    localStorage.setItem(`${prefix}settings`, JSON.stringify(settings));
    localStorage.setItem('current_biz_id', settings.id);
    
    // Set state
    setBusinessSettingsState(settings);
    setUsers([owner]);
    setUser(owner);
    setLang(settings.language);
    setCategories(['General']);
    setProducts([]);
    setIngredients([]);
    setPreparedStock([]);
    setSales([]);
    setOrders([]);
    setExpenses([]);
    setWorkShifts([]);
    setRota([]);
    setStaffAvailability([]);
    setTaxSettings({ 
      municipalTaxRate: 0, 
      vatRegime: 'Standard',
      countryCode: settings.country
    });
    setCurrentBizId(settings.id);
    setIsOnboarding(true);
    addToast(t('businessRegistered'));
  };

  const loginToBusiness = (payload: { mode: 'owner' | 'staff'; restaurantName: string; identifier: string; password: string }) => {
    const { mode, restaurantName, identifier, password } = payload;
    const normalizedRestaurant = normalizeName(restaurantName);

    const registry = JSON.parse(localStorage.getItem('biz_registry') || '[]');
    const matchedBiz = registry.find((b: any) => {
      if (!b?.name) return false;
      if (!normalizedRestaurant) return true;
      return normalizeName(b.name) === normalizedRestaurant;
    });

    const isYdPlace =
      normalizedRestaurant === normalizeName('PreVisio') ||
      normalizedRestaurant === normalizeName('Y&D Place') ||
      normalizedRestaurant === 'ydplace';

    if (mode === 'owner') {
      if (
        isYdPlace &&
        (identifier === 'owner@123.com' || identifier === 'owner') &&
        password === '123'
      ) {
        const ydOwner: User = {
          id: 1,
          username: 'owner@123.com',
          fullName: 'PreVisio Owner',
          password: '123',
          role: 'owner'
        };
        localStorage.setItem('ydplace_user', JSON.stringify(ydOwner));
        localStorage.setItem('current_biz_id', 'ydplace');
        setCurrentBizId('ydplace');
        setUser(ydOwner);
        return true;
      }

      const biz = registry.find((b: any) => {
        const nameMatch = !normalizedRestaurant || normalizeName(b.name || '') === normalizedRestaurant;
        const identifierMatch = b.ownerEmail === identifier || b.username === identifier;
        return nameMatch && identifierMatch && b.password === password;
      });
      if (biz) {
        const owner: User = {
          id: 1,
          username: biz.username,
          fullName: biz.ownerName || biz.username,
          password: biz.password,
          role: 'owner'
        };
        const prefix = getPrefixForBiz(biz.id);
        localStorage.setItem(`${prefix}user`, JSON.stringify(owner));
        localStorage.setItem('current_biz_id', biz.id);
        setCurrentBizId(biz.id);
        setUser(owner);
        return true;
      }
      return false;
    }

    const targetBizId = isYdPlace ? 'ydplace' : matchedBiz?.id;
    if (!targetBizId) return false;

    const prefix = getPrefixForBiz(targetBizId);
    const storedUsers = localStorage.getItem(`${prefix}users`);
    const availableUsers: User[] = storedUsers ? JSON.parse(storedUsers) : (targetBizId === 'ydplace' ? DEFAULT_USERS : []);
    const staffUser = availableUsers.find(u => u.username === identifier && u.password === password);
    if (!staffUser) return false;

    const storedShiftLogs = localStorage.getItem(`${prefix}shiftlogs`);
    const currentShiftLogs: ShiftLog[] = storedShiftLogs ? JSON.parse(storedShiftLogs) : [];
    const newLog: ShiftLog = {
      id: Date.now(),
      username: staffUser.username,
      fullName: staffUser.fullName,
      role: staffUser.role,
      loginTime: Date.now(),
      logoutTime: null,
      ordersProcessed: 0
    };

    const updatedLogs = [...currentShiftLogs, newLog];
    localStorage.setItem(`${prefix}shiftlogs`, JSON.stringify(updatedLogs));
    localStorage.setItem(`${prefix}user`, JSON.stringify(staffUser));
    localStorage.setItem('current_biz_id', targetBizId);
    setCurrentBizId(targetBizId);
    setShiftLogs(updatedLogs);
    setUser(staffUser);
    return true;
  };

  const setBusinessSettings = (s: BusinessSettings) => {
    setBusinessSettingsState(s);
    setLang(s.language);
  };

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const logout = () => {
    if (user) {
      const updatedLogs = shiftLogs.map(log => {
        if (log.username === user.username && !log.logoutTime) {
          return { ...log, logoutTime: Date.now() };
        }
        return log;
      });
      setShiftLogs(updatedLogs);
    }
    
    // Reset all business-specific state
    setProducts([]);
    setIngredients([]);
    setPreparedStock([]);
    setSales([]);
    setOrders([]);
    setUsers([]);
    setCategories([]);
    setShiftLogs([]);
    setExpenses([]);
    setWorkShifts([]);
    setRota([]);
    setStaffAvailability([]);
    setBusinessSettingsState(null);
    setUser(null);
    setCurrentBizId(null);
    localStorage.removeItem('current_biz_id');
    
    addToast(t('logout'), 'info');
  };

  const resetAllData = () => {
    localStorage.clear();
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

  const completeOnboarding = () => {
    setIsOnboarding(false);
    if (currentBizId) {
      const prefix = getPrefix();
      localStorage.setItem(`${prefix}onboarding_complete`, 'true');
    }
  };

  const loadDemoData = () => {
    const demo = generateDemoData();
    // Add hourly rates to demo users
    const usersWithRates = demo.users.map(u => ({
      ...u,
      hourlyRate: u.role === 'owner' ? 25 : u.role === 'manager' ? 18 : 14
    }));
    
    setProducts(demo.products);
    setIngredients(demo.ingredients);
    setPreparedStock(demo.preparedStock);
    setUsers(usersWithRates);
    setSales(demo.sales);
    setOrders([]);
    setShiftLogs(demo.shiftLogs);
    setExpenses(demo.expenses);
    setWorkShifts(demo.workShifts);
    setRota([]);
    setStaffAvailability([]);
    addToast(t('demoDataLoaded'));
  };

  return (
    <AppContext.Provider value={{
      lang, setLang, t, tp, tc, user, setUser, products, setProducts, ingredients, setIngredients,
      preparedStock, setPreparedStock,
      sales, setSales, orders, setOrders, users, setUsers, categories, setCategories, shiftLogs, setShiftLogs,
      expenses, setExpenses, workShifts, setWorkShifts, rota, setRota, staffAvailability, setStaffAvailability,
      taxSettings, setTaxSettings,
      toasts, addToast, logout, resetAllData, formatPrice,
      businessSettings, setBusinessSettings, registerBusiness, loginToBusiness, isFirstTime,
      isOnboarding, completeOnboarding, loadDemoData
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
