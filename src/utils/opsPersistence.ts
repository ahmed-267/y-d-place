import { Ingredient, Order, PreparedStock, Product, Sale, ShiftLog, WorkShift, Expense, User, RotaShift, StaffAvailability, TaxSettings } from '../types';

const OPS_KEY = 'previsio_ops_v1';

export type PersistedOps = {
  businessId: string;
  products?: Product[];
  ingredients?: Ingredient[];
  preparedStock?: PreparedStock[];
  sales?: Sale[];
  orders?: Order[];
  expenses?: Expense[];
  workShifts?: WorkShift[];
  shiftLogs?: ShiftLog[];
  users?: User[];
  categories?: string[];
  rota?: RotaShift[];
  staffAvailability?: StaffAvailability[];
  taxSettings?: TaxSettings;
  updatedAt: number;
};

export const loadPersistedOps = (businessId: string): PersistedOps | null => {
  try {
    const raw = localStorage.getItem(OPS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedOps;
    if (data.businessId !== businessId) return null;
    return data;
  } catch {
    return null;
  }
};

export const savePersistedOps = (payload: PersistedOps) => {
  try {
    localStorage.setItem(OPS_KEY, JSON.stringify({ ...payload, updatedAt: Date.now() }));
  } catch {
    /* ignore quota */
  }
};

export const clearPersistedOps = () => {
  localStorage.removeItem(OPS_KEY);
};
