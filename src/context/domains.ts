/**
 * Domain-oriented context modules.
 * AppContext.tsx remains the composed runtime; these files document ownership
 * and host helpers that keep AppProvider thinner over time.
 */
export { clearPersistedOps, loadPersistedOps, savePersistedOps } from '../utils/opsPersistence';
export {
  checkStockAvailability,
  deductStock,
  restoreStock,
  calculateStockNeeds,
} from '../utils/stock';
export {
  mapBusinessRow,
  mapProductRow,
  mapSaleRow,
  mapExpenseRow,
  mapWorkShiftRow,
  mapUserRow,
  businessToRow,
  DEMO_BUSINESS_ID,
} from '../utils/dbMappers';

/** Logical domains (for future nested providers): */
export type AppDomain = 'auth' | 'catalog' | 'ops' | 'staff' | 'settings';

export const DOMAIN_OWNERS: Record<AppDomain, string[]> = {
  auth: ['user', 'login', 'logout', 'registerAccount', 'inviteStaff', 'isDemoMode', 'isOnboarding'],
  catalog: ['products', 'ingredients', 'preparedStock', 'categories'],
  ops: ['sales', 'orders', 'expenses', 'taxSettings', 'addSale'],
  staff: ['users', 'workShifts', 'shiftLogs', 'rota', 'staffAvailability'],
  settings: ['businessSettings', 'lang', 'landingPageConfig', 'activeTab', 'toasts'],
};
