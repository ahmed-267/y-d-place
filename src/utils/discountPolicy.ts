import { DiscountPolicy, normalizeDiscountPolicy, Role, User } from '../types';
import { findRosterStaff, loadStaffRoster } from './staffRoster';
import { DEFAULT_USERS } from '../constants';

export type DiscountCheck =
  | { ok: true; needsApproval: false }
  | { ok: true; needsApproval: true }
  | { ok: false; reason: 'over_limit' };

export const evaluateDiscount = (
  role: Role | undefined,
  opts: { discountValue: number; discountPercent?: number },
  policyInput?: Partial<DiscountPolicy> | null
): DiscountCheck => {
  const discountValue = Math.max(0, opts.discountValue || 0);
  const discountPercent = Math.max(0, opts.discountPercent || 0);
  if (discountValue <= 0 && discountPercent <= 0) return { ok: true, needsApproval: false };
  if (role === 'owner' || role === 'manager') return { ok: true, needsApproval: false };

  const policy = normalizeDiscountPolicy(policyInput);
  const over =
    discountValue > policy.staffMaxAmount + 0.001 ||
    discountPercent > policy.staffMaxPercent + 0.001;

  if (!over) return { ok: true, needsApproval: false };

  if (policy.requireManagerPinAboveLimit) {
    return { ok: true, needsApproval: true };
  }
  return { ok: false, reason: 'over_limit' };
};

export const verifyManagerPassword = (
  username: string,
  password: string,
  users: User[]
): User | null => {
  const id = username.trim();
  const pass = password;

  const fromUsers = users.find(
    u =>
      (u.role === 'owner' || u.role === 'manager') &&
      (u.username === id || u.email === id) &&
      u.password === pass
  );
  if (fromUsers) return fromUsers;

  const demo = DEFAULT_USERS.find(
    u =>
      (u.role === 'owner' || u.role === 'manager') &&
      (u.username === id || u.email === id) &&
      u.password === pass
  );
  if (demo) return demo as User;

  const roster = findRosterStaff(id, pass);
  if (roster && (roster.role === 'owner' || roster.role === 'manager')) {
    return {
      id: roster.id,
      username: roster.username,
      fullName: roster.fullName,
      role: roster.role,
      email: roster.email,
      password: roster.password,
    };
  }

  // Roster may store managers with password; also allow any roster owner/manager match by username+password
  const rosterHit = loadStaffRoster().find(
    u =>
      (u.role === 'owner' || u.role === 'manager') &&
      u.username === id &&
      u.password === pass
  );
  if (rosterHit) {
    return {
      id: rosterHit.id,
      username: rosterHit.username,
      fullName: rosterHit.fullName,
      role: rosterHit.role,
      email: rosterHit.email,
      password: rosterHit.password,
    };
  }

  return null;
};
