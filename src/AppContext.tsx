
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
  const [lang, setLang] = useState<Language>((localStorage.getItem('ydplace_lang') as Language) || 'en');
  const [user, setUser] = useState<User | null>(JSON.parse(localStorage.getItem('ydplace_user') || 'null'));
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
      const storedProducts = localStorage.getItem('ydplace_products');
      const storedIngredients = localStorage.getItem('ydplace_ingredients');
      const storedUsers = localStorage.getItem('ydplace_users');
      const storedCategories = localStorage.getItem('ydplace_categories');
      const storedSales = localStorage.getItem('ydplace_sales');
      const storedShiftLogs = localStorage.getItem('ydplace_shiftlogs');
      const storedExpenses = localStorage.getItem('ydplace_expenses');
      const storedWorkShifts = localStorage.getItem('ydplace_workshifts');
      const storedTaxSettings = localStorage.getItem('ydplace_tax_settings');

      if (!storedProducts || JSON.parse(storedProducts).length === 0) {
        setProducts(DEFAULT_PRODUCTS);
        localStorage.setItem('ydplace_products', JSON.stringify(DEFAULT_PRODUCTS));
      } else {
        setProducts(JSON.parse(storedProducts));
      }

      if (!storedIngredients || JSON.parse(storedIngredients).length === 0) {
        setIngredients(DEFAULT_INGREDIENTS);
        localStorage.setItem('ydplace_ingredients', JSON.stringify(DEFAULT_INGREDIENTS));
      } else {
        setIngredients(JSON.parse(storedIngredients));
      }

      if (!storedUsers || JSON.parse(storedUsers).length === 0) {
        setUsers(DEFAULT_USERS);
        localStorage.setItem('ydplace_users', JSON.stringify(DEFAULT_USERS));
      } else {
        setUsers(JSON.parse(storedUsers));
      }

      if (!storedCategories || JSON.parse(storedCategories).length === 0) {
        setCategories(DEFAULT_CATEGORIES);
        localStorage.setItem('ydplace_categories', JSON.stringify(DEFAULT_CATEGORIES));
      } else {
        setCategories(JSON.parse(storedCategories));
      }

      setSales(storedSales ? JSON.parse(storedSales) : []);
      setShiftLogs(storedShiftLogs ? JSON.parse(storedShiftLogs) : []);
      setExpenses(storedExpenses ? JSON.parse(storedExpenses) : []);
      setWorkShifts(storedWorkShifts ? JSON.parse(storedWorkShifts) : []);
      setTaxSettings(storedTaxSettings ? JSON.parse(storedTaxSettings) : { municipalTaxRate: 7, vatRegime: 'SmallBusiness' });
      
      localStorage.setItem('ydplace_seeded', 'true');
    };

    loadData();
  }, []);

  useEffect(() => { localStorage.setItem('ydplace_products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('ydplace_ingredients', JSON.stringify(ingredients)); }, [ingredients]);
  useEffect(() => { localStorage.setItem('ydplace_users', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('ydplace_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('ydplace_sales', JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem('ydplace_shiftlogs', JSON.stringify(shiftLogs)); }, [shiftLogs]);
  useEffect(() => { localStorage.setItem('ydplace_expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('ydplace_workshifts', JSON.stringify(workShifts)); }, [workShifts]);
  useEffect(() => { localStorage.setItem('ydplace_tax_settings', JSON.stringify(taxSettings)); }, [taxSettings]);
  useEffect(() => { localStorage.setItem('ydplace_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('ydplace_user', JSON.stringify(user)); }, [user]);

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