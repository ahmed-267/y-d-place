
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
  /** Addon product ids that can be added to this item. Empty/undefined falls back to addon-category extras. */
  extraIds?: number[];
  /** Pin to Cashier favourites row */
  isFavourite?: boolean;
  /** Optional POS tile colour (hex) */
  posColor?: string;
}

export interface SaleItem {
  productId: number;
  nameEN: string;
  translations?: Record<string, string>;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  extras?: { productId: number; nameEN: string; price: number }[];
  note?: string;
}

export type SaleStatus = 'completed' | 'refunded' | 'voided';

export interface Sale {
  id: string;
  timestamp: number;
  items: SaleItem[];
  /** Sum of line totals before discount/tip. */
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  tipAmount?: number;
  tenderedCash?: number;
  changeGiven?: number;
  paymentMethod: 'Cash' | 'Card' | 'Split';
  /** When paymentMethod is Split — cash portion of payable. */
  cashAmount?: number;
  /** When paymentMethod is Split — card-recorded portion of payable. */
  cardAmount?: number;
  cashierUsername: string;
  cashierFullName: string;
  status?: SaleStatus;
  voidReason?: string;
  refundedAt?: number;
  /** Manager/owner who approved a discount above staff limit. */
  discountApprovedByUsername?: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
}

export type OrderType = 'WalkIn' | 'PreOrder' | 'DineIn';
export type OrderStatus = 'Preparing' | 'Ready' | 'Completed' | 'Cancelled';

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
  discountPercent?: number;
  discountAmount?: number;
  tipAmount?: number;
  tenderedCash?: number;
  changeGiven?: number;
  paymentMethod: 'Cash' | 'Card' | 'Split';
  cashAmount?: number;
  cardAmount?: number;
  createdByUsername: string;
  createdByFullName: string;
  completedAt?: number;
  saleId?: string;
  voidReason?: string;
  kitchenPrintedAt?: number;
  tableId?: string;
  tableLabel?: string;
  covers?: number;
  discountApprovedByUsername?: string;
  customerId?: string;
  /** pos = cashier; online = branded pre-order page */
  source?: 'pos' | 'online';
}

export interface CashSession {
  id: string;
  openedAt: number;
  closedAt?: number;
  openingFloat: number;
  closingCounted?: number;
  openedBy: string;
  closedBy?: string;
  notes?: string;
}

export interface PreparedStock {
  id: number;
  name: string;
  portions: number;
  lowThreshold: number;
  /** Last receive unit cost (optional bookkeeping). */
  lastUnitCost?: number;
}

export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  qty: number;
  lowThreshold: number;
  /** Last receive unit cost (optional bookkeeping). */
  lastUnitCost?: number;
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
  /** Table service / floor map */
  tables: boolean;
  /** Customer directory & phone recall */
  customers: boolean;
  /** Tip entry on tickets + tips reporting */
  tips: boolean;
  /** Guest online pre-order link */
  onlineOrders: boolean;
  /** Park / recall tickets on the till */
  parkTickets: boolean;
}

export const DEFAULT_ENABLED_MODULES: EnabledModules = {
  orders: true,
  sales: true,
  stock: true,
  staff: true,
  finance: true,
  tables: false,
  customers: false,
  tips: false,
  onlineOrders: false,
  parkTickets: false,
};

export const normalizeEnabledModules = (
  value?: Partial<EnabledModules> | null
): EnabledModules => ({
  ...DEFAULT_ENABLED_MODULES,
  ...(value || {}),
});

export type DiscountPolicy = {
  staffMaxPercent: number;
  staffMaxAmount: number;
  requireManagerPinAboveLimit: boolean;
};

export const DEFAULT_DISCOUNT_POLICY: DiscountPolicy = {
  staffMaxPercent: 10,
  staffMaxAmount: 5,
  requireManagerPinAboveLimit: true,
};

export const normalizeDiscountPolicy = (
  value?: Partial<DiscountPolicy> | null
): DiscountPolicy => ({
  ...DEFAULT_DISCOUNT_POLICY,
  ...(value || {}),
});

export type BrandPaletteId =
  | 'espresso'
  | 'forest'
  | 'ocean'
  | 'wine'
  | 'midnight'
  | 'terracotta'
  | 'violet'
  | 'graphite'
  | 'sunrise'
  | 'arctic'
  // legacy ids (mapped in resolveBrandPalette)
  | 'olive'
  | 'slate'
  | 'navy'
  | 'cocoa';

export const BRAND_PALETTE_IDS: BrandPaletteId[] = [
  'espresso',
  'forest',
  'ocean',
  'wine',
  'midnight',
  'terracotta',
  'violet',
  'graphite',
  'sunrise',
  'arctic',
];

export type BrandTheme = {
  /** Curated palette id — preferred */
  paletteId?: BrandPaletteId;
  /** Legacy free-colour fields (migrated to nearest palette) */
  sidebar?: string;
  canvas?: string;
};

export const DEFAULT_BRAND_THEME: BrandTheme = {
  paletteId: 'espresso',
};

export const normalizeBrandTheme = (value?: Partial<BrandTheme> | Record<string, unknown> | null): BrandTheme => {
  const raw = (value || {}) as Record<string, unknown>;
  if (typeof raw.paletteId === 'string') {
    const id = raw.paletteId as BrandPaletteId;
    if (BRAND_PALETTE_IDS.includes(id)) return { paletteId: id };
    // Map legacy ids to current set
    const legacy: Record<string, BrandPaletteId> = {
      olive: 'forest',
      slate: 'graphite',
      navy: 'ocean',
      cocoa: 'terracotta',
    };
    if (legacy[id]) return { paletteId: legacy[id] };
  }
  const sidebar =
    (typeof raw.sidebar === 'string' && raw.sidebar) ||
    (typeof raw.primary === 'string' && raw.primary) ||
    undefined;
  const canvas =
    (typeof raw.canvas === 'string' && raw.canvas) ||
    (typeof raw.surface === 'string' && raw.surface) ||
    undefined;
  if (sidebar || canvas) return { sidebar, canvas };
  return { ...DEFAULT_BRAND_THEME };
};

export type FloorSection = {
  id: string;
  name: string;
};

export type FloorTable = {
  id: string;
  label: string;
  seats: number;
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: 'square' | 'round';
  sectionId?: string;
  /** Needs clearing after guests leave */
  dirty?: boolean;
  /** Assigned server username */
  serverUsername?: string;
  /** When guests were seated / check opened */
  seatedAt?: number;
};

export type FloorPlan = {
  tables: FloorTable[];
  sections: FloorSection[];
  useSections: boolean;
};

export type TableLiveStatus = 'free' | 'seated' | 'ordered' | 'bill' | 'dirty';

export const emptyFloorPlan = (): FloorPlan => ({
  tables: [],
  sections: [],
  useSections: false,
});

export const normalizeFloorPlan = (value?: Partial<FloorPlan> | Record<string, unknown> | null): FloorPlan => {
  const raw = (value || {}) as Partial<FloorPlan>;
  const tables = Array.isArray(raw.tables) ? raw.tables : [];
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  const useSections = !!raw.useSections;
  return { tables, sections, useSections };
};

export type WasteReason = 'spoilage' | 'breakage' | 'overproduction' | 'staff_meal' | 'other';

export type WasteLog = {
  id: string;
  timestamp: number;
  kind: 'ingredient' | 'prepped';
  itemId: number;
  itemName: string;
  qty: number;
  unit?: string;
  reason: WasteReason;
  note?: string;
  unitCost?: number;
  costImpact: number;
  recordedByUsername: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  allergies?: string;
  createdAt: number;
  lastOrderAt?: number;
  orderCount: number;
};

export type ParkedTicket = {
  id: string;
  parkedAt: number;
  cart: Array<SaleItem & { emoji?: string; transKey?: string; id?: number }>;
  orderType: OrderType;
  customerName: string;
  customerPhone: string;
  scheduledDate: string;
  scheduledTime: string;
  discountPercent: string;
  discountAmount: string;
  tipAmount: string;
  paymentMethod: 'Cash' | 'Card' | 'Split';
  cashReceived: string;
  splitCash: string;
  splitCard: string;
  tableId?: string;
  tableLabel?: string;
  covers?: string;
  resumeOrderId?: string;
  customerId?: string;
};

export type PendingTableSession = {
  tableId: string;
  tableLabel: string;
  covers?: number;
  resumeOrderId?: string;
};

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
  discountPolicy?: DiscountPolicy;
  brandTheme?: BrandTheme;
  /** Stripe-mirrored plan: trialing | pro | canceled | past_due | none */
  plan?: 'trialing' | 'pro' | 'canceled' | 'past_due' | 'none';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: number;
  currentPeriodEndsAt?: number;
  subscriptionStatus?: string;
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
  /** Gross pay for this shift (hours × rate, or manual override). */
  payAmount?: number;
  /** Default worked; leave marks unavailable days (sick, holiday, etc.). */
  kind?: 'worked' | 'leave';
  leaveReason?: 'sick' | 'holiday' | 'personal' | 'other';
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
