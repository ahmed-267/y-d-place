import {
  BusinessSettings,
  EnabledModules,
  Expense,
  Language,
  Order,
  Product,
  Role,
  Sale,
  SaleItem,
  User,
  WorkShift,
  normalizeEnabledModules,
  normalizeDiscountPolicy,
  normalizeBrandTheme,
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
export const mapBusinessRow = (row: Record<string, unknown>): BusinessSettings => {
  const trialRaw = row.trial_ends_at ?? row.trialEndsAt;
  const periodRaw = row.current_period_ends_at ?? row.currentPeriodEndsAt;
  const planRaw = String(row.plan ?? 'none');
  const plan =
    planRaw === 'trialing' ||
    planRaw === 'pro' ||
    planRaw === 'canceled' ||
    planRaw === 'past_due'
      ? planRaw
      : 'none';

  return {
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
    discountPolicy: normalizeDiscountPolicy(
      (row.discount_policy ?? row.discountPolicy) as Record<string, unknown> | null | undefined
    ),
    brandTheme: normalizeBrandTheme(
      (row.brand_theme ?? row.brandTheme) as Record<string, unknown> | null | undefined
    ),
    plan,
    stripeCustomerId: (row.stripe_customer_id as string) || (row.stripeCustomerId as string) || undefined,
    stripeSubscriptionId:
      (row.stripe_subscription_id as string) || (row.stripeSubscriptionId as string) || undefined,
    trialEndsAt: trialRaw ? new Date(String(trialRaw)).getTime() : undefined,
    currentPeriodEndsAt: periodRaw ? new Date(String(periodRaw)).getTime() : undefined,
    subscriptionStatus:
      (row.subscription_status as string) || (row.subscriptionStatus as string) || undefined,
  };
};

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
  discount_policy: normalizeDiscountPolicy(settings.discountPolicy),
  brand_theme: normalizeBrandTheme(settings.brandTheme),
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
  extraIds: Array.isArray(row.extra_ids)
    ? (row.extra_ids as number[])
    : Array.isArray(row.extraIds)
      ? (row.extraIds as number[])
      : undefined,
  isFavourite: row.is_favourite === true || row.isFavourite === true,
  posColor: (row.pos_color as string) || (row.posColor as string) || undefined,
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
    note: (item.note as string) || undefined,
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
    paymentMethod: (row.payment_method ?? row.paymentMethod ?? 'Cash') as Sale['paymentMethod'],
    cashierUsername: String(row.cashier_username ?? row.cashierUsername ?? ''),
    cashierFullName: String(row.cashier_fullname ?? row.cashierFullName ?? ''),
    discountPercent: row.discount_percent != null ? Number(row.discount_percent) : undefined,
    discountAmount: row.discount_amount != null ? Number(row.discount_amount) : undefined,
    tipAmount: row.tip_amount != null ? Number(row.tip_amount) : undefined,
    tenderedCash: row.tendered_cash != null ? Number(row.tendered_cash) : undefined,
    changeGiven: row.change_given != null ? Number(row.change_given) : undefined,
    cashAmount: row.cash_amount != null ? Number(row.cash_amount) : undefined,
    cardAmount: row.card_amount != null ? Number(row.card_amount) : undefined,
    status: (row.status as Sale['status']) || 'completed',
    voidReason: (row.void_reason as string) || undefined,
    refundedAt: row.refunded_at ? new Date(String(row.refunded_at)).getTime() : undefined,
    customerName: (row.customer_name as string) || (row.customerName as string) || undefined,
    customerPhone: (row.customer_phone as string) || (row.customerPhone as string) || undefined,
    customerId: (row.customer_id as string) || (row.customerId as string) || undefined,
  };
};

export const saleToRow = (sale: Sale, businessId: string) => ({
  id: sale.id,
  business_id: businessId,
  subtotal: sale.subtotal,
  payment_method: sale.paymentMethod,
  cashier_username: sale.cashierUsername,
  cashier_fullname: sale.cashierFullName,
  discount_percent: sale.discountPercent || 0,
  discount_amount: sale.discountAmount || 0,
  tip_amount: sale.tipAmount || 0,
  tendered_cash: sale.tenderedCash ?? null,
  change_given: sale.changeGiven ?? null,
  cash_amount: sale.cashAmount ?? null,
  card_amount: sale.cardAmount ?? null,
  status: sale.status || 'completed',
  void_reason: sale.voidReason || null,
  refunded_at: sale.refundedAt ? new Date(sale.refundedAt).toISOString() : null,
  customer_name: sale.customerName || null,
  customer_phone: sale.customerPhone || null,
  customer_id: sale.customerId || null,
  created_at: new Date(sale.timestamp).toISOString(),
  timestamp: sale.timestamp,
});

export const saleItemsToRows = (sale: Sale) =>
  sale.items.map(item => ({
    sale_id: sale.id,
    product_id: item.productId,
    qty: item.qty,
    unit_price: item.unitPrice,
    line_total: item.lineTotal,
    extras: item.extras || [],
    name_en: item.nameEN,
    translations: item.translations || {},
    note: item.note || null,
  }));

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
  payAmount:
    row.pay_amount != null || row.payAmount != null
      ? Number(row.pay_amount ?? row.payAmount)
      : undefined,
  kind: (row.kind as WorkShift['kind']) || undefined,
  leaveReason:
    (row.leave_reason as WorkShift['leaveReason']) ||
    (row.leaveReason as WorkShift['leaveReason']) ||
    undefined,
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
  // Keep core schema compatible; pay/leave live in client + local ops until DB columns exist.
  notes: shift.notes,
  business_id: businessId,
});

export const productToRow = (product: Product, businessId: string) => ({
  id: product.id,
  business_id: businessId,
  name_en: product.nameEN,
  translations: product.translations || {},
  category: product.category,
  price: product.price,
  emoji: product.emoji,
  active: product.active,
  trans_key: product.transKey,
  ingredient_links: product.ingredientLinks || [],
  prepared_stock_links: product.preparedStockLinks || [],
  extra_ids: product.extraIds || [],
  is_favourite: !!product.isFavourite,
  pos_color: product.posColor || null,
});

export const orderToRow = (order: Order, businessId: string) => ({
  id: order.id,
  business_id: businessId,
  type: order.type,
  status: order.status,
  created_at: new Date(order.createdAt).toISOString(),
  updated_at: new Date(order.lastUpdatedAt).toISOString(),
  scheduled_for: order.scheduledFor || null,
  customer_name: order.customerName || null,
  customer_phone: order.customerPhone || null,
  items: order.items,
  subtotal: order.subtotal,
  payment_method: order.paymentMethod,
  created_by_username: order.createdByUsername,
  created_by_fullname: order.createdByFullName,
  completed_at: order.completedAt ? new Date(order.completedAt).toISOString() : null,
  sale_id: order.saleId || null,
  discount_amount: order.discountAmount || 0,
  tip_amount: order.tipAmount || 0,
  void_reason: order.voidReason || null,
  kitchen_printed_at: order.kitchenPrintedAt ? new Date(order.kitchenPrintedAt).toISOString() : null,
  customer_id: order.customerId || null,
  source: order.source || 'pos',
  table_id: order.tableId || null,
  table_label: order.tableLabel || null,
  covers: order.covers ?? null,
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
  plan: 'pro',
  subscriptionStatus: 'active',
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
    parkTickets: false,
  },
});
