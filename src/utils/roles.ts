import { Role } from '../types';

/** Owner-level portal access. Managers share this for now. */
export const hasOwnerAccess = (role?: Role | null) =>
  role === 'owner' || role === 'manager';
