import type { PersistedOps } from './opsPersistence';

// Never upload credentials, cached users, sales or other authoritative cloud records.
export const recoverySnapshot = (ops: PersistedOps) => ({
  version: 1,
  categories: ops.categories,
  staffAvailability: ops.staffAvailability,
  taxSettings: ops.taxSettings,
  cashSessions: ops.cashSessions,
  floorPlan: ops.floorPlan,
  wasteLogs: ops.wasteLogs,
  customers: ops.customers,
  shiftLogs: ops.shiftLogs,
});
