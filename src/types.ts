
export type Role = 'owner' | 'manager' | 'staff';

export interface Product {
  id: number;
  nameEN: string;
  nameFR: string;
  nameNL: string;
  nameFL: string;
  category: string;
  price: number;
  stock: number;
  lowThreshold: number;
  emoji: string;
  active: boolean;
  transKey: string;
}

export interface SaleItem {
  productId: number;
  nameEN: string;
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

export interface TaxSettings {
  manualGrossRevenue?: number;
  manualExpenses?: number;
  socialSecurityPaid?: number;
  municipalTaxRate: number;
  vatRegime: 'SmallBusiness' | 'Standard';
}

export interface User {
  id: number;
  username: string;
  fullName: string;
  password?: string;
  role: Role;
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

export type Language = 'en' | 'fr' | 'nl' | 'fl';
