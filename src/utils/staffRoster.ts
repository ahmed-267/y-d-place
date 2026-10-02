import { Role, User } from '../types';

const ROSTER_KEY = 'previsio_staff_roster';
const STAFF_SESSION_KEY = 'previsio_staff_session';

export type RosterStaff = User & {
  businessId: string;
  password?: string;
};

export type StaffSession = {
  username: string;
  businessId: string;
};

export const loadStaffRoster = (): RosterStaff[] => {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RosterStaff[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const saveStaffRoster = (roster: RosterStaff[]) => {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
  } catch {
    /* ignore */
  }
};

export const upsertStaffRosterEntry = (entry: RosterStaff) => {
  const roster = loadStaffRoster().filter(
    u => !(u.username === entry.username && u.businessId === entry.businessId)
  );
  roster.push(entry);
  saveStaffRoster(roster);
};

export const findRosterStaff = (username: string, password: string): RosterStaff | null =>
  loadStaffRoster().find(u => u.username === username && u.password === password) || null;

export const updateRosterPassword = (username: string, businessId: string, password: string) => {
  const roster = loadStaffRoster().map(u =>
    u.username === username && u.businessId === businessId ? { ...u, password } : u
  );
  saveStaffRoster(roster);
};

export const saveStaffSession = (session: StaffSession) => {
  try {
    localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
};

export const loadStaffSession = (): StaffSession | null => {
  try {
    const raw = localStorage.getItem(STAFF_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StaffSession;
  } catch {
    return null;
  }
};

export const clearStaffSession = () => {
  try {
    localStorage.removeItem(STAFF_SESSION_KEY);
  } catch {
    /* ignore */
  }
};

export const rosterToUser = (entry: RosterStaff): User => ({
  id: entry.id,
  username: entry.username,
  fullName: entry.fullName,
  email: entry.email,
  password: entry.password,
  role: (entry.role === 'owner' ? 'staff' : entry.role) as Role,
  hourlyRate: entry.hourlyRate,
});
