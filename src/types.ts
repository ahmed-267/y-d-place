
export type Role = 'owner' | 'manager' | 'staff';

export interface IngredientLink {
  ingredientId: number;
  quantityUsed: number;
  unit: string;
}

export interface PreparedStockLink {
  preparedStockId: number;
  portionsPerSale: number;
}

export interface Product {
  id: number;
  nameEN: string;
  translations: Record<string, string>;
  category: string;
  price: number;
  emoji: string;
  active: boolean;
  transKey: string;
  ingredientLinks?: IngredientLink[];
  preparedStockLinks?: PreparedStockLink[];
}

export interface SaleItem {
  productId: number;
  nameEN: string;
  translations?: Record<string, string>;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  extras?: { productId: number; nameEN: string; price: number }[];
}

export interface Sale {
  id: string;
  timestamp: number;
  items: SaleItem[];
  subtotal: number;
  paymentMethod: 'Cash' | 'Card';
  cashierUsername: string;
  cashierFullName: string;
}

export type OrderType = 'WalkIn' | 'PreOrder';
export type OrderStatus = 'Preparing' | 'Ready' | 'Completed';

export interface Order {
  id: string;
  type: OrderType;
  status: OrderStatus;
  createdAt: number;
  lastUpdatedAt: number;
  scheduledFor?: string;
  customerName?: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  paymentMethod: 'Cash' | 'Card';
  createdByUsername: string;
  createdByFullName: string;
  completedAt?: number;
  saleId?: string;
}

export interface PreparedStock {
  id: number;
  name: string;
  portions: number;
  lowThreshold: number;
}

export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  qty: number;
  lowThreshold: number;
}

export type ExpenseCategory = 'Utilities' | 'Rent' | 'Supplies' | 'Staff' | 'Transport' | 'Marketing' | 'Insurance' | 'Equipment' | 'Other';

export interface Expense {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  isRecurring: boolean;
  frequency?: 'Monthly' | 'Quarterly' | 'Yearly';
  receiptImage?: string;
}

export interface EnabledModules {
  /** Kitchen order flow (Orders tab) */
  orders: boolean;
  /** Sales history & reports */
  sales: boolean;
  /** Stock / inventory */
  stock: boolean;
  /** Team, rota, timesheets (and My Shifts for staff) */
  staff: boolean;
  /** Expenses & tax */
  finance: boolean;
}

export const DEFAULT_ENABLED_MODULES: EnabledModules = {
  orders: true,
  sales: true,
  stock: true,
  staff: true,
  finance: true,
};

export const normalizeEnabledModules = (
  value?: Partial<EnabledModules> | null
): EnabledModules => ({
  ...DEFAULT_ENABLED_MODULES,
  ...(value || {}),
});

export interface BusinessSettings {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  venueType: string;
  country: string;
  city: string;
  address?: string;
  openingHours?: string;
  currencyCode: string;
  currencySymbol: string;
  language: Language;
  enabledModules?: EnabledModules;
}

export interface TaxSettings {
  manualGrossRevenue?: number;
  manualExpenses?: number;
  socialSecurityPaid?: number;
  municipalTaxRate: number;
  vatRegime: 'SmallBusiness' | 'Standard';
  // New fields for country-specific tax rules
  countryCode?: string;
  customIncomeTaxRate?: number;
  customVatRate?: number;
  customSocialSecurityRate?: number;
}

export interface User {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  password?: string;
  role: Role;
  hourlyRate?: number;
}

export interface ShiftLog {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  loginTime: number;
  logoutTime: number | null;
  ordersProcessed: number;
}

export interface WorkShift {
  id: string;
  userId: number;
  username: string;
  fullName: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  totalHours: number;
  notes?: string;
}

export interface RotaShift {
  id: string;
  userId: number;
  username: string;
  fullName: string;
  date: string;
  startTime?: string;
  endTime?: string;
}

export interface StaffAvailability {
  userId: number;
  note: string;
}

export interface LandingPageConfig {
  cuisineType: string;
  colorTheme: 'Elegant Dark' | 'Vibrant Street' | 'Minimalist Cream' | 'Rustic Wood' | 'Neon Night' | 'Pastel Sweet';
  address?: string;
  openingHours: string;
  brandStoryRaw: string;
  refinedStory: string;
  logoImage?: string;
  galleryImages: string[];
  generatedAt: number;
}

export type Language = 'en' | 'fr' | 'nl' | 'fl' | 'es' | 'it' | 'de' | 'ar' | 'pt' | 'tr' | 'pl' | 'ro' | 'zh' | 'ja';
