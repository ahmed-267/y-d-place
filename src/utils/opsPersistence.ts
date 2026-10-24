import { recoverySnapshot } from './browserBackup';

import {
  Ingredient,
  Order,
  PreparedStock,
  Product,
  Sale,
  ShiftLog,
  WorkShift,
  Expense,
  User,
  RotaShift,
  StaffAvailability,
  TaxSettings,
  CashSession,
  FloorPlan,
  WasteLog,
  Customer,
} from '../types';

const OPS_KEY = 'previsio_ops_v1';
const ONLINE_INBOX_PREFIX = 'previsio_online_inbox_';

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
  cashSessions?: CashSession[];
  floorPlan?: FloorPlan;
  wasteLogs?: WasteLog[];
  customers?: Customer[];
  updatedAt: number;
};

export const loadPersistedOps = (businessId: string): PersistedOps | null => {
  try {
    const raw = localStorage.getItem(`${OPS_KEY}:${businessId}`) || localStorage.getItem(OPS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedOps;
    if (data.businessId !== businessId) return null;
    // Remove retired local ticket drafts; never turn them into sales or orders.
    delete (data as unknown as Record<string, unknown>).parkedTickets;
    localStorage.removeItem(`previsio_parked_${businessId}`);
    sessionStorage.removeItem(`previsio_parked_${businessId}`);
    if (data.users) {
      data.users = data.users.map(u => {
        const { password: _p, ...rest } = u as User & { password?: string };
        return rest;
      });
    }
    return data;
  } catch {
    return null;
  }
};

export const savePersistedOps = (payload: PersistedOps) => {
  try {
    const users = (payload.users || []).map(u => {
      const { password: _p, ...rest } = u as User & { password?: string };
      return rest;
    });
    const previous = loadPersistedOps(payload.businessId);
    localStorage.setItem(`${OPS_KEY}:${payload.businessId}`, JSON.stringify({ ...payload, users, updatedAt: Date.now() }));
    if (JSON.stringify(previous && recoverySnapshot(previous)) !== JSON.stringify(recoverySnapshot(payload))) {
      window.dispatchEvent(new CustomEvent('previsio-local-data-changed', { detail: { businessId: payload.businessId } }));
    }
  } catch {
    window.dispatchEvent(new CustomEvent('previsio-local-save-failed', { detail: { businessId: payload.businessId } }));
  }
};

export const clearPersistedOps = () => {
  localStorage.removeItem(OPS_KEY);
  Object.keys(localStorage).filter(key => key.startsWith(`${OPS_KEY}:`)).forEach(key => localStorage.removeItem(key));
};

export const onlineInboxKey = (businessId: string) => `${ONLINE_INBOX_PREFIX}${businessId}`;

export const loadOnlineInbox = (businessId: string): Order[] => {
  try {
    return JSON.parse(localStorage.getItem(onlineInboxKey(businessId)) || '[]') || [];
  } catch {
    return [];
  }
};

export const pushOnlineOrder = (businessId: string, order: Order) => {
  const list = loadOnlineInbox(businessId);
  localStorage.setItem(onlineInboxKey(businessId), JSON.stringify([order, ...list].slice(0, 100)));

  // Also persist into ops so a refresh / reopen of the dashboard picks the order up.
  const ops = loadPersistedOps(businessId);
  if (ops) {
    const orders = [order, ...(ops.orders || []).filter(o => o.id !== order.id)];
    savePersistedOps({ ...ops, orders, updatedAt: Date.now() });
  }

  try {
    localStorage.setItem(`previsio_online_ping_${businessId}`, String(Date.now()));
  } catch {
    /* ignore */
  }
};

export const resolvePublicMenuSnapshot = (businessId: string): PublicMenuSnapshot | null => {
  const snap = loadPublicMenuSnapshot(businessId);
  if (snap?.products?.length) return snap;

  const ops = loadPersistedOps(businessId);
  if (!ops?.products?.length) return null;

  return {
    businessId,
    businessName: 'Pre-order',
    currencySymbol: '€',
    products: ops.products
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
    onlineOrdersEnabled: true,
    updatedAt: ops.updatedAt || Date.now(),
  };
};

export const clearOnlineInbox = (businessId: string) => {
  localStorage.removeItem(onlineInboxKey(businessId));
};

/** Public menu snapshot for online ordering (written by dashboard). */
export type PublicMenuSnapshot = {
  businessId: string;
  businessName: string;
  currencySymbol: string;
  products: Pick<
    Product,
    'id' | 'nameEN' | 'category' | 'price' | 'emoji' | 'active' | 'isFavourite' | 'posColor' | 'extraIds'
  >[];
  onlineOrdersEnabled?: boolean;
  updatedAt: number;
};

const publicMenuKey = (businessId: string) => `previsio_public_menu_${businessId}`;

export const savePublicMenuSnapshot = (snap: PublicMenuSnapshot) => {
  try {
    localStorage.setItem(publicMenuKey(snap.businessId), JSON.stringify(snap));
  } catch {
    /* ignore */
  }
};

export const loadPublicMenuSnapshot = (businessId: string): PublicMenuSnapshot | null => {
  try {
    const raw = localStorage.getItem(publicMenuKey(businessId));
    if (!raw) return null;
    return JSON.parse(raw) as PublicMenuSnapshot;
  } catch {
    return null;
  }
};
