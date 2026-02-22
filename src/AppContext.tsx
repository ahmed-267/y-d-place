
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Product, Ingredient, Sale, ShiftLog, Language, Role, Expense, TaxSettings, WorkShift } from './types';
import { DEFAULT_PRODUCTS, DEFAULT_INGREDIENTS, DEFAULT_USERS, TRANSLATIONS, DEFAULT_CATEGORIES } from './constants';

interface AppContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
  user: User | null;
  setUser: (u: User | null) => void;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
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
  taxSettings: TaxSettings;
  setTaxSettings: React.Dispatch<React.SetStateAction<TaxSettings>>;
  toasts: { id: number; message: string; type: 'success' | 'error' | 'info' }[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  logout: () => void;
  resetAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Language>((localStorage.getItem('keoks_lang') as Language) || 'en');
  const [user, setUser] = useState<User | null>(JSON.parse(localStorage.getItem('keoks_user') || 'null'));
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [shiftLogs, setShiftLogs] = useState<ShiftLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({ municipalTaxRate: 7, vatRegime: 'SmallBusiness' });
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);

  const t = (key: string) => {
    const dict = TRANSLATIONS[lang] as any;
    return dict[key] || key;
  };

  useEffect(() => {
    const loadData = () => {
      const storedProducts = localStorage.getItem('keoks_products');
      const storedIngredients = localStorage.getItem('keoks_ingredients');
      const storedUsers = localStorage.getItem('keoks_users');
      const storedCategories = localStorage.getItem('keoks_categories');
      const storedSales = localStorage.getItem('keoks_sales');
      const storedShiftLogs = localStorage.getItem('keoks_shiftlogs');
      const storedExpenses = localStorage.getItem('keoks_expenses');
      const storedWorkShifts = localStorage.getItem('keoks_workshifts');
      const storedTaxSettings = localStorage.getItem('keoks_tax_settings');

      if (!storedProducts || JSON.parse(storedProducts).length === 0) {
        setProducts(DEFAULT_PRODUCTS);
        localStorage.setItem('keoks_products', JSON.stringify(DEFAULT_PRODUCTS));
      } else {
        setProducts(JSON.parse(storedProducts));
      }

      if (!storedIngredients || JSON.parse(storedIngredients).length === 0) {
        setIngredients(DEFAULT_INGREDIENTS);
        localStorage.setItem('keoks_ingredients', JSON.stringify(DEFAULT_INGREDIENTS));
      } else {
        setIngredients(JSON.parse(storedIngredients));
      }

      if (!storedUsers || JSON.parse(storedUsers).length === 0) {
        setUsers(DEFAULT_USERS);
        localStorage.setItem('keoks_users', JSON.stringify(DEFAULT_USERS));
      } else {
        setUsers(JSON.parse(storedUsers));
      }

      if (!storedCategories || JSON.parse(storedCategories).length === 0) {
        setCategories(DEFAULT_CATEGORIES);
        localStorage.setItem('keoks_categories', JSON.stringify(DEFAULT_CATEGORIES));
      } else {
        setCategories(JSON.parse(storedCategories));
      }

      setSales(storedSales ? JSON.parse(storedSales) : []);
      setShiftLogs(storedShiftLogs ? JSON.parse(storedShiftLogs) : []);
      setExpenses(storedExpenses ? JSON.parse(storedExpenses) : []);
      setWorkShifts(storedWorkShifts ? JSON.parse(storedWorkShifts) : []);
      setTaxSettings(storedTaxSettings ? JSON.parse(storedTaxSettings) : { municipalTaxRate: 7, vatRegime: 'SmallBusiness' });
      
      localStorage.setItem('keoks_seeded', 'true');
    };

    loadData();
  }, []);

  useEffect(() => { localStorage.setItem('keoks_products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('keoks_ingredients', JSON.stringify(ingredients)); }, [ingredients]);
  useEffect(() => { localStorage.setItem('keoks_users', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('keoks_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('keoks_sales', JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem('keoks_shiftlogs', JSON.stringify(shiftLogs)); }, [shiftLogs]);
  useEffect(() => { localStorage.setItem('keoks_expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('keoks_workshifts', JSON.stringify(workShifts)); }, [workShifts]);
  useEffect(() => { localStorage.setItem('keoks_tax_settings', JSON.stringify(taxSettings)); }, [taxSettings]);
  useEffect(() => { localStorage.setItem('keoks_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('keoks_user', JSON.stringify(user)); }, [user]);

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
    setUser(null);
    addToast(t('logout'), 'info');
  };

  const resetAllData = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <AppContext.Provider value={{
      lang, setLang, t, user, setUser, products, setProducts, ingredients, setIngredients,
      sales, setSales, users, setUsers, categories, setCategories, shiftLogs, setShiftLogs,
      expenses, setExpenses, workShifts, setWorkShifts, taxSettings, setTaxSettings,
      toasts, addToast, logout, resetAllData
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
