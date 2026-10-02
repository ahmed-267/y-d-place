import { Role, User } from '../types';

const ROSTER_KEY = 'previsio_staff_roster';

/** Password-free roster metadata (no credentials). Kept for display/caching only. */
export type RosterStaff = {
  id: number | string;
  username: string;
  fullName: string;
  email?: string;
  role: Role;
  hourlyRate?: number;
  businessId: string;
};

export const loadStaffRoster = (): RosterStaff[] => {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Array<RosterStaff & { password?: string }>;
    if (!Array.isArray(list)) return [];
    // Strip any legacy password fields on read
    return list.map(({ password: _p, ...rest }) => rest);
  } catch {
    return [];
  }
};

export const saveStaffRoster = (roster: RosterStaff[]) => {
  try {
    const sanitized = roster.map(({ password: _p, ...rest }: RosterStaff & { password?: string }) => rest);
    localStorage.setItem(ROSTER_KEY, JSON.stringify(sanitized));
  } catch {
    /* ignore */
  }
};

export const upsertStaffRosterEntry = (entry: RosterStaff) => {
  const { password: _p, ...safe } = entry as RosterStaff & { password?: string };
  const roster = loadStaffRoster().filter(
    u => !(u.username === safe.username && u.businessId === safe.businessId)
  );
  roster.push(safe);
  saveStaffRoster(roster);
};

export const clearStaffRoster = () => {
  try {
    localStorage.removeItem(ROSTER_KEY);
  } catch {
    /* ignore */
  }
};

/** @deprecated Forgeable staff sessions removed — use Supabase Auth. */
export const clearStaffSession = () => {
  try {
    localStorage.removeItem('previsio_staff_session');
  } catch {
    /* ignore */
  }
};

export const rosterToUser = (entry: RosterStaff): User => ({
  id: typeof entry.id === 'number' ? entry.id : Date.now(),
  username: entry.username,
  fullName: entry.fullName,
  email: entry.email,
  role: (entry.role === 'owner' ? 'staff' : entry.role) as Role,
  hourlyRate: entry.hourlyRate,
});
