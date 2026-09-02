import {
  BusinessSettings,
  EnabledModules,
  Expense,
  Language,
  Product,
  Role,
  Sale,
  SaleItem,
  User,
  WorkShift,
  normalizeEnabledModules,
} from '../types';

const parseEnabledModules = (raw: unknown): EnabledModules => {
  if (!raw) return normalizeEnabledModules();
  if (typeof raw === 'string') {
    try {
      return normalizeEnabledModules(JSON.parse(raw));
    } catch {
      return normalizeEnabledModules();
    }
  }
  if (typeof raw === 'object') return normalizeEnabledModules(raw as Partial<EnabledModules>);
  return normalizeEnabledModules();
};

/** Map a Supabase `businesses` row (snake_case) to BusinessSettings. */
export const mapBusinessRow = (row: Record<string, unknown>): BusinessSettings => ({
  id: String(row.id ?? ''),
  name: String(row.name ?? ''),
  ownerName: String(row.owner_name ?? row.ownerName ?? ''),
  ownerEmail: String(row.owner_email ?? row.ownerEmail ?? ''),
  ownerPhone: String(row.owner_phone ?? row.ownerPhone ?? ''),
  venueType: String(row.venue_type ?? row.venueType ?? ''),
  country: String(row.country ?? ''),
  city: String(row.city ?? ''),
  address: (row.address as string | undefined) || undefined,
  openingHours: (row.opening_hours ?? row.openingHours) as string | undefined,
  currencyCode: String(row.currency_code ?? row.currencyCode ?? 'EUR'),
  currencySymbol: String(row.currency_symbol ?? row.currencySymbol ?? '€'),
  language: (row.language as Language) || 'en',
  enabledModules: parseEnabledModules(row.enabled_modules ?? row.enabledModules),
});

export const businessToRow = (settings: BusinessSettings) => ({
  name: settings.name,
  owner_name: settings.ownerName,
  owner_email: settings.ownerEmail,
  owner_phone: settings.ownerPhone,
  venue_type: settings.venueType,
  country: settings.country,
  city: settings.city,
  address: settings.address,
  opening_hours: settings.openingHours,
  currency_code: settings.currencyCode,
  currency_symbol: settings.currencySymbol,
  language: settings.language,
  enabled_modules: normalizeEnabledModules(settings.enabledModules),
});

export const mapUserRow = (row: Record<string, unknown>): User => ({
  id: typeof row.id === 'number' ? row.id : Number(row.numeric_id ?? Date.now()),
  username: String(row.username ?? ''),
  fullName: String(row.full_name ?? row.fullName ?? ''),
  email: (row.email as string) || undefined,
  role: (row.role as Role) || 'staff',
  hourlyRate: row.hourly_rate != null ? Number(row.hourly_rate) : undefined,
});

export const mapProductRow = (row: Record<string, unknown>): Product => ({
  id: Number(row.id),
  nameEN: String(row.name_en ?? row.nameEN ?? ''),
  translations: (row.translations as Record<string, string>) || {},
  category: String(row.category ?? 'General'),
  price: Number(row.price ?? 0),
  emoji: String(row.emoji ?? '🍽️'),
  active: row.active !== false,
  transKey: String(row.trans_key ?? row.transKey ?? ''),
  ingredientLinks: (row.ingredient_links ?? row.ingredientLinks) as Product['ingredientLinks'],
  preparedStockLinks: (row.prepared_stock_links ?? row.preparedStockLinks) as Product['preparedStockLinks'],
});

export const mapSaleRow = (row: Record<string, unknown>): Sale => {
  const rawItems = (row.sale_items ?? row.items ?? []) as Record<string, unknown>[];
  const items: SaleItem[] = rawItems.map((item) => ({
    productId: Number(item.product_id ?? item.productId ?? 0),
    nameEN: String(item.name_en ?? item.nameEN ?? ''),
    translations: (item.translations as Record<string, string>) || undefined,
    qty: Number(item.qty ?? 0),
    unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
    lineTotal: Number(item.line_total ?? item.lineTotal ?? 0),
    extras: item.extras as SaleItem['extras'],
  }));

  const timestampRaw = row.timestamp ?? row.created_at;
  const timestamp =
    typeof timestampRaw === 'number'
      ? timestampRaw
      : timestampRaw
        ? new Date(String(timestampRaw)).getTime()
        : Date.now();

  return {
    id: String(row.id),
    timestamp,
    items,
    subtotal: Number(row.subtotal ?? 0),
    paymentMethod: (row.payment_method ?? row.paymentMethod ?? 'Cash') as 'Cash' | 'Card',
    cashierUsername: String(row.cashier_username ?? row.cashierUsername ?? ''),
    cashierFullName: String(row.cashier_fullname ?? row.cashierFullName ?? ''),
  };
};

export const mapExpenseRow = (row: Record<string, unknown>): Expense => ({
  id: String(row.id),
  name: String(row.name ?? ''),
  category: (row.category as Expense['category']) || 'Other',
  amount: Number(row.amount ?? 0),
  date: String(row.date ?? new Date().toISOString().slice(0, 10)),
  isRecurring: Boolean(row.is_recurring ?? row.isRecurring ?? false),
  frequency: (row.frequency as Expense['frequency']) || undefined,
  receiptImage: (row.receipt_image ?? row.receiptImage) as string | undefined,
});

export const expenseToRow = (expense: Omit<Expense, 'id'> | Expense, businessId: string) => ({
  name: expense.name,
  category: expense.category,
  amount: expense.amount,
  date: expense.date,
  is_recurring: expense.isRecurring,
  frequency: expense.frequency,
  receipt_image: expense.receiptImage,
  business_id: businessId,
});

export const mapWorkShiftRow = (row: Record<string, unknown>): WorkShift => ({
  id: String(row.id),
  userId: Number(row.user_id ?? row.userId ?? 0),
  username: String(row.username ?? ''),
  fullName: String(row.full_name ?? row.fullName ?? ''),
  date: String(row.date ?? ''),
  startTime: String(row.start_time ?? row.startTime ?? ''),
  endTime: String(row.end_time ?? row.endTime ?? ''),
  breakMinutes: Number(row.break_minutes ?? row.breakMinutes ?? 0),
  totalHours: Number(row.total_hours ?? row.totalHours ?? 0),
  notes: (row.notes as string) || undefined,
});

export const workShiftToRow = (shift: Omit<WorkShift, 'id'> | WorkShift, businessId: string) => ({
  user_id: shift.userId,
  username: shift.username,
  full_name: shift.fullName,
  date: shift.date,
  start_time: shift.startTime,
  end_time: shift.endTime,
  break_minutes: shift.breakMinutes,
  total_hours: shift.totalHours,
  notes: shift.notes,
  business_id: businessId,
});

export const DEMO_BUSINESS_ID = 'ydplace';

export const createDemoBusiness = (): BusinessSettings => ({
  id: DEMO_BUSINESS_ID,
  name: "Y'D Place",
  ownerName: 'PreVisio Owner',
  ownerEmail: 'owner@123.com',
  ownerPhone: '+32 000 000 000',
  venueType: 'Café',
  country: 'BE',
  city: 'Brussels',
  openingHours: '10:00 – 20:00',
  currencyCode: 'EUR',
  currencySymbol: '€',
  language: 'en',
  enabledModules: {
    orders: true,
    sales: true,
    stock: true,
    staff: true,
    finance: true,
  },
});
