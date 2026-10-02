import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Plus, Trash2, Clock, Edit2, Search, Calendar, ChevronLeft, ChevronRight, Sparkles, Save, X, Target, Users } from 'lucide-react';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { DataTablePagination, useTablePagination } from './DataTablePagination';
import { User, Role, WorkShift, RotaShift } from '../types';
import { toSearchValue } from '../utils/search';
import { SortableTh, useColumnSort, sortByColumn } from '../utils/tableSort';
import { isPasswordStrongEnough } from '../utils/passwordStrength';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { hasOwnerAccess } from '../utils/roles';

type TimeOffRange = {
  id: string;
  from: string;
  to: string;
};

type AvailabilityConfig = {
  days: number[];
  startTime: string;
  endTime: string;
  timeOffs: TimeOffRange[];
};

const defaultAvailability = (): AvailabilityConfig => ({
  days: [0, 1, 2, 3, 4, 5, 6],
  startTime: '09:00',
  endTime: '17:00',
  timeOffs: [],
});

export const StaffTab = () => {
  const { users, setUsers, workShifts, setWorkShifts, t, addToast, formatPrice, businessSettings, user, rota, setRota, staffAvailability, setStaffAvailability, lang, inviteStaff } = useApp();
  const [lastInviteCreds, setLastInviteCreds] = useState<{ username: string; password: string } | null>(null);
  const [invitePassword, setInvitePassword] = useState('');
  const [activeSection, setActiveSection] = useState<'staff' | 'shifts' | 'rota' | 'timeoff'>('staff');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [shiftDeleteConfirm, setShiftDeleteConfirm] = useState<WorkShift | null>(null);
  const [shiftFilter, setShiftFilter] = useState(() => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const key = (d: Date) => d.toISOString().split('T')[0];
    return { staff: 'All', from: key(start), to: key(end) };
  });
  const [rotaView, setRotaView] = useState<'weekly' | 'monthly'>('weekly');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [editingCell, setEditingCell] = useState<{ userId: number; date: string } | null>(null);
  const [cellStart, setCellStart] = useState('09:00');
  const [cellEnd, setCellEnd] = useState('17:00');
  const [monthDayFocus, setMonthDayFocus] = useState<string | null>(null);
  const [monthAddUserId, setMonthAddUserId] = useState('');
  const [availabilityFocusId, setAvailabilityFocusId] = useState<number | null>(null);
  const [rotaPreview, setRotaPreview] = useState<RotaShift[] | null>(null);
  const [pendingGenerated, setPendingGenerated] = useState<RotaShift[] | null>(null);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [showCoverageTargets, setShowCoverageTargets] = useState(false);
  const [timeOffMonthOffset, setTimeOffMonthOffset] = useState(0);
  const [timeOffForm, setTimeOffForm] = useState({ userId: '', from: '', to: '' });
  const [showAddTimeOff, setShowAddTimeOff] = useState(false);
  const [draggingShiftId, setDraggingShiftId] = useState<string | null>(null);
  const [staffNeeded, setStaffNeeded] = useState<Record<number, number>>({
    0: 2,
    1: 2,
    2: 2,
    3: 2,
    4: 2,
    5: 3,
    6: 3
  });

  const [staffSearch, setStaffSearch] = useState('');
  const [editStaff, setEditStaff] = useState<User | null>(null);
  const [editShift, setEditShift] = useState<WorkShift | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');

  const canResetPassword = (viewer: User | null, target: User) => {
    if (!viewer) return false;
    if (viewer.id === target.id) return false;
    if (hasOwnerAccess(viewer.role)) return target.role !== 'owner';
    return false;
  };

  const canEditRota = hasOwnerAccess(user?.role);

  useEffect(() => {
    if (editStaff) {
      setResetPassword('');
      setResetPasswordConfirm('');
    }
  }, [editStaff]);

  const [shiftFormData, setShiftFormData] = useState({
    userId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: '30',
    notes: ''
  });

  const getHourlyRate = (userId: number) => {
    return users.find(u => u.id === userId)?.hourlyRate || 0;
  };

  const calculateWage = (hours: number, userId: number) => {
    const rate = getHourlyRate(userId);
    return rate > 0 ? hours * rate : 0;
  };

  const calculatedHours = useMemo(() => {
    const { date, startTime, endTime, breakMinutes } = shiftFormData;
    if (!date || !startTime || !endTime) return 0;

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    const brk = parseInt(breakMinutes) || 0;

    let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diff < 0) diff += 24;
    
    const actualHours = Math.max(0, diff - (brk / 60));
    return parseFloat(actualHours.toFixed(2));
  }, [shiftFormData]);

  const calculatedWage = useMemo(() => {
    if (!shiftFormData.userId) return 0;
    return calculateWage(calculatedHours, parseInt(shiftFormData.userId));
  }, [calculatedHours, shiftFormData.userId, users]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(fd);

    const result = await inviteStaff({
      username: data.username as string,
      fullName: data.fullName as string,
      email: (data.email as string || '').trim() || undefined,
      password: data.password as string,
      role: data.role as Role,
    });

    if (result.error) {
      addToast(result.error, 'error');
      return;
    }

    if (result.credentials) {
      setLastInviteCreds({ username: result.credentials.username, password: '' });
      const rate = parseFloat(data.hourlyRate as string) || 0;
      if (rate > 0) {
        setUsers(prev =>
          prev.map(u =>
            u.email === result.credentials!.username || u.username === (data.username as string)
              ? { ...u, hourlyRate: rate }
              : u
          )
        );
      }
    }

    setShowAddModal(false);
    setInvitePassword('');
    addToast(
      `${t('staffAdded')} Staff sign in with email ${result.credentials?.username || data.email || ''}.`,
      'success'
    );
  };

  const handleEditStaffSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaff) return;
    const canReset = canResetPassword(user, editStaff);
    if (canReset && (resetPassword || resetPasswordConfirm)) {
      if (!isPasswordStrongEnough(resetPassword)) {
        addToast(t('passwordTooWeak') || t('passwordTooShort'), 'error');
        return;
      }
      if (resetPassword !== resetPasswordConfirm) {
        addToast(t('passwordsDontMatch') || t('passwordsDoNotMatch'), 'error');
        return;
      }
      addToast('Ask the staff member to use Forgot password on the login page to set a new password.', 'info');
      setResetPassword('');
      setResetPasswordConfirm('');
    }

    const updatedUsers = users.map(u => {
      if (u.id !== editStaff.id) return u;
      const { password: _p, ...rest } = { ...u, ...editStaff } as User & { password?: string };
      return rest;
    });
    setUsers(updatedUsers);
    addToast(t('staffUpdated'));
    setEditStaff(null);
    setResetPassword('');
    setResetPasswordConfirm('');
  };

  const handleEditShiftSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShift) return;
    
    const start = new Date(`${editShift.date}T${editShift.startTime}`);
    const end = new Date(`${editShift.date}T${editShift.endTime}`);
    let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diff < 0) diff += 24;
    const actualHours = parseFloat(Math.max(0, diff - (editShift.breakMinutes / 60)).toFixed(2));
    
    const updatedShift = { ...editShift, totalHours: actualHours };
    setWorkShifts(workShifts.map(s => s.id === editShift.id ? updatedShift : s));
    addToast(t('shiftUpdated'));
    setEditShift(null);
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    setUsers(users.filter(u => u.id !== deleteConfirm.id));
    addToast(t('staffRemoved'), 'info');
    setDeleteConfirm(null);
  };

  const handleDeleteShift = () => {
    if (!shiftDeleteConfirm) return;
    setWorkShifts(workShifts.filter(s => s.id !== shiftDeleteConfirm.id));
    setShiftDeleteConfirm(null);
    addToast(t('shiftDeleted'), 'info');
  };

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = users.find(u => u.id === parseInt(shiftFormData.userId));
    if (!targetUser) {
      addToast(t('selectStaffMember'), 'error');
      return;
    }

    const newShift: WorkShift = {
      id: `SHIFT-${Date.now()}`,
      userId: targetUser.id,
      username: targetUser.username,
      fullName: targetUser.fullName,
      date: shiftFormData.date,
      startTime: shiftFormData.startTime,
      endTime: shiftFormData.endTime,
      breakMinutes: parseInt(shiftFormData.breakMinutes) || 0,
      totalHours: calculatedHours,
      notes: shiftFormData.notes
    };

    setWorkShifts([...workShifts, newShift]);
    setShowAddShiftModal(false);
    setShiftFormData({
      userId: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '17:00',
      breakMinutes: '30',
      notes: ''
    });
    addToast(t('shiftLogged'));
  };

  type StaffSort = 'name' | 'username' | 'role' | 'hourlyRate';
  type ShiftSort = 'staff' | 'date' | 'start' | 'end' | 'break' | 'total' | 'wage';
  const { sortKey: staffSortKey, sortDirection: staffSortDir, toggleSort: toggleStaffSort } = useColumnSort<StaffSort>('name');
  const { sortKey: shiftSortKey, sortDirection: shiftSortDir, toggleSort: toggleShiftSort } = useColumnSort<ShiftSort>('date', 'desc');

  const filteredUsers = useMemo(() => {
    const query = staffSearch.trim().toLowerCase();
    let list = users;
    if (query) {
      list = users.filter(u => {
        const nameMatch = toSearchValue(u?.fullName).includes(query);
        const usernameMatch = toSearchValue(u?.username).includes(query);
        const roleMatch = toSearchValue(u?.role).includes(query);
        const emailMatch = toSearchValue(u?.email).includes(query);
        return nameMatch || usernameMatch || roleMatch || emailMatch;
      });
    }
    return sortByColumn(list, staffSortKey, staffSortDir, (u: User, key) => {
      if (key === 'name') return u.fullName;
      if (key === 'username') return u.username;
      if (key === 'role') return u.role;
      return u.hourlyRate ?? 0;
    });
  }, [users, staffSearch, staffSortKey, staffSortDir]);

  const staffPaging = useTablePagination(filteredUsers.length, 10, staffSearch);
  const paginatedUsers = useMemo(
    () => staffPaging.slice(filteredUsers),
    [filteredUsers, staffPaging.page, staffPaging.pageSize, staffPaging.start]
  );

  const filteredShifts = useMemo(() => {
    const list = workShifts.filter(s => {
      const isCurrentStaff = users.some(u => u.username === s.username);
      const matchesStaff = shiftFilter.staff === 'All' ||
                           (shiftFilter.staff === 'CurrentStaff'
                             ? isCurrentStaff
                             : shiftFilter.staff === 'FormerStaff'
                               ? !isCurrentStaff
                               : s.username === shiftFilter.staff);
      const matchesFrom = !shiftFilter.from || s.date >= shiftFilter.from;
      const matchesTo = !shiftFilter.to || s.date <= shiftFilter.to;
      return matchesStaff && matchesFrom && matchesTo;
    });
    return sortByColumn(list, shiftSortKey, shiftSortDir, (s: WorkShift, key) => {
      if (key === 'staff') return s.fullName || s.username;
      if (key === 'date') return s.date;
      if (key === 'start') return s.startTime;
      if (key === 'end') return s.endTime;
      if (key === 'break') return s.breakMinutes ?? 0;
      if (key === 'total') return s.totalHours;
      return calculateWage(s.totalHours, s.userId);
    });
  }, [workShifts, users, shiftFilter, shiftSortKey, shiftSortDir]);

  const shiftsPaging = useTablePagination(filteredShifts.length, 10, `${shiftFilter.staff}|${shiftFilter.from}|${shiftFilter.to}`);
  const paginatedShifts = useMemo(
    () => shiftsPaging.slice(filteredShifts),
    [filteredShifts, shiftsPaging.page, shiftsPaging.pageSize, shiftsPaging.start]
  );

  const totalFilteredHours = filteredShifts.reduce((acc, s) => acc + s.totalHours, 0);
  const totalWageCost = filteredShifts.reduce((acc, s) => acc + calculateWage(s.totalHours, s.userId), 0);

  const hoursPerPerson = useMemo(() => {
    const summary: Record<string, { name: string, hours: number }> = {};
    filteredShifts.forEach(s => {
      if (!summary[s.username]) {
        summary[s.username] = { name: s.fullName, hours: 0 };
      }
      summary[s.username].hours += s.totalHours;
    });
    return Object.values(summary).sort((a, b) => b.hours - a.hours);
  }, [filteredShifts]);

  const staffForRota = useMemo(() => users.filter(u => u.role !== 'owner'), [users]);

  const availabilityMap = useMemo(() => {
    const map = new Map<number, string>();
    staffAvailability.forEach(a => map.set(a.userId, a.note));
    return map;
  }, [staffAvailability]);

  const setAvailabilityNote = (userId: number, note: string) => {
    setStaffAvailability(prev => {
      const exists = prev.find(a => a.userId === userId);
      if (exists) {
        return prev.map(a => a.userId === userId ? { ...a, note } : a);
      }
      return [...prev, { userId, note }];
    });
  };

  const dayLabels = [t('dayMon'), t('dayTue'), t('dayWed'), t('dayThu'), t('dayFri'), t('daySat'), t('daySun')];

  const getAvailabilityConfig = (userId: number): AvailabilityConfig => {
    const raw = availabilityMap.get(userId) || '';
    if (!raw) return defaultAvailability();
    try {
      const parsed = JSON.parse(raw) as Partial<AvailabilityConfig> & {
        exceptionFrom?: string;
        exceptionTo?: string;
      };
      let timeOffs: TimeOffRange[] = [];
      if (Array.isArray(parsed.timeOffs)) {
        timeOffs = parsed.timeOffs
          .filter((r): r is TimeOffRange => Boolean(r && r.from && r.to))
          .map(r => ({ id: r.id || `to-${r.from}-${r.to}`, from: r.from, to: r.to }));
      } else if (parsed.exceptionFrom && parsed.exceptionTo) {
        timeOffs = [{
          id: `legacy-${parsed.exceptionFrom}-${parsed.exceptionTo}`,
          from: parsed.exceptionFrom,
          to: parsed.exceptionTo,
        }];
      }
      return {
        days: Array.isArray(parsed.days) && parsed.days.length ? parsed.days : [0, 1, 2, 3, 4, 5, 6],
        startTime: parsed.startTime || '09:00',
        endTime: parsed.endTime || '17:00',
        timeOffs,
      };
    } catch {
      return defaultAvailability();
    }
  };

  const setAvailabilityConfig = (userId: number, patch: Partial<AvailabilityConfig>) => {
    const current = getAvailabilityConfig(userId);
    const next = { ...current, ...patch };
    setAvailabilityNote(userId, JSON.stringify(next));
  };

  const addTimeOffRange = (userId: number, from: string, to: string) => {
    if (!from || !to || from > to) {
      addToast(t('timeOffInvalid'), 'error');
      return false;
    }
    const cfg = getAvailabilityConfig(userId);
    const overlaps = cfg.timeOffs.some(r => !(to < r.from || from > r.to));
    if (overlaps) {
      addToast(t('timeOffOverlap'), 'error');
      return false;
    }
    setAvailabilityConfig(userId, {
      timeOffs: [...cfg.timeOffs, { id: `to-${userId}-${from}-${to}-${Date.now()}`, from, to }],
    });
    return true;
  };

  const removeTimeOffRange = (userId: number, rangeId: string) => {
    const cfg = getAvailabilityConfig(userId);
    setAvailabilityConfig(userId, {
      timeOffs: cfg.timeOffs.filter(r => r.id !== rangeId),
    });
  };

  const locale = lang === 'fl' ? 'nl-BE' : lang;
  const toDateKey = (date: Date) => date.toLocaleDateString('en-CA');

  const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const displayDates = useMemo(() => {
    if (rotaView === 'weekly') {
      const base = startOfWeek(new Date());
      base.setDate(base.getDate() + weekOffset * 7);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        return d;
      });
    }
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + monthOffset);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(base);
      d.setDate(i + 1);
      return d;
    });
  }, [rotaView, weekOffset, monthOffset]);

  const effectiveRota = rotaPreview || rota;

  const findShift = (userId: number, dateKey: string) => {
    return effectiveRota.find(s => s.userId === userId && s.date === dateKey);
  };

  const todayKey = toDateKey(new Date());

  const weekRangeLabel = useMemo(() => {
    if (!displayDates.length) return '';
    const a = displayDates[0];
    const b = displayDates[displayDates.length - 1];
    if (rotaView === 'weekly') {
      return `Week of ${a.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;
    }
    return a.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }, [displayDates, rotaView, locale]);

  const monthCalendarCells = useMemo(() => {
    if (rotaView !== 'monthly' || !displayDates.length) return [] as (Date | null)[];
    const first = displayDates[0];
    const startPad = (first.getDay() + 6) % 7;
    const cells: (Date | null)[] = [...Array.from({ length: startPad }, () => null), ...displayDates];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [displayDates, rotaView]);

  const openMonthDay = (dateKey: string) => {
    setMonthDayFocus(dateKey);
    setEditingCell(null);
    setMonthAddUserId('');
    setCellStart('09:00');
    setCellEnd('17:00');
  };

  const coverageByDate = useMemo(() => {
    const map: Record<string, { filled: number; needed: number }> = {};
    displayDates.forEach(date => {
      const key = toDateKey(date);
      const dayIdx = (date.getDay() + 6) % 7;
      const filled = effectiveRota.filter(s => s.date === key).length;
      map[key] = { filled, needed: staffNeeded[dayIdx] ?? 0 };
    });
    return map;
  }, [displayDates, effectiveRota, staffNeeded]);

  const roleTileClass = (role: Role) => {
    if (role === 'manager') return 'bg-blue-100 border-blue-200 text-blue-900';
    return 'bg-bakery-caramel/25 border-bakery-caramel/40 text-bakery-brown';
  };

  const editingStaff = editingCell ? staffForRota.find(u => u.id === editingCell.userId) : null;

  const updateRotaList = (next: RotaShift[]) => {
    if (rotaPreview) {
      setRotaPreview(next);
      return;
    }
    setRota(next);
    syncRotaToWorkShifts(next);
  };

  const handleCellClick = (staffMember: User, dateKey: string) => {
    if (!canEditRota) return;
    if (isStaffOnTimeOff(staffMember.id, dateKey)) {
      addToast(t('staffOnLeave'), 'info');
      return;
    }
    const existing = findShift(staffMember.id, dateKey);
    setMonthDayFocus(dateKey);
    setEditingCell({ userId: staffMember.id, date: dateKey });
    setCellStart(existing?.startTime || '09:00');
    setCellEnd(existing?.endTime || '17:00');
  };

  const assignStaffToMonthDay = () => {
    if (!monthDayFocus || !monthAddUserId || !canEditRota) return;
    const staffMember = staffForRota.find(u => String(u.id) === monthAddUserId);
    if (!staffMember) return;
    if (isStaffOnTimeOff(staffMember.id, monthDayFocus)) {
      addToast(t('staffOnLeave'), 'info');
      return;
    }
    if (findShift(staffMember.id, monthDayFocus)) {
      handleCellClick(staffMember, monthDayFocus);
      return;
    }
    const cfg = getAvailabilityConfig(staffMember.id);
    const updatedShift: RotaShift = {
      id: `ROTA-${Date.now()}`,
      userId: staffMember.id,
      username: staffMember.username,
      fullName: staffMember.fullName,
      date: monthDayFocus,
      startTime: cfg.startTime || '09:00',
      endTime: cfg.endTime || '17:00',
    };
    updateRotaList([...effectiveRota, updatedShift]);
    setMonthAddUserId('');
    setEditingCell({ userId: staffMember.id, date: monthDayFocus });
    setCellStart(updatedShift.startTime || '09:00');
    setCellEnd(updatedShift.endTime || '17:00');
  };

  const handleSaveCell = () => {
    if (!editingCell) return;
    const staffMember = staffForRota.find(u => u.id === editingCell.userId);
    if (!staffMember) return;

    const existing = findShift(editingCell.userId, editingCell.date);
    const updatedShift: RotaShift = {
      id: existing?.id || `ROTA-${Date.now()}`,
      userId: staffMember.id,
      username: staffMember.username,
      fullName: staffMember.fullName,
      date: editingCell.date,
      startTime: cellStart,
      endTime: cellEnd
    };

    const next = existing
      ? effectiveRota.map(s => s.id === existing.id ? updatedShift : s)
      : [...effectiveRota, updatedShift];

    updateRotaList(next);
    setEditingCell(null);
  };

  const handleRemoveCell = () => {
    if (!editingCell) return;
    const existing = findShift(editingCell.userId, editingCell.date);
    if (!existing) {
      setEditingCell(null);
      return;
    }
    const next = effectiveRota.filter(s => s.id !== existing.id);
    updateRotaList(next);
    setEditingCell(null);
  };

  const isDateWithinException = (date: Date, config: AvailabilityConfig) => {
    const target = toDateKey(date);
    return config.timeOffs.some(r => r.from && r.to && target >= r.from && target <= r.to);
  };

  const isStaffOnTimeOff = (userId: number, dateKey: string) => {
    const cfg = getAvailabilityConfig(userId);
    return cfg.timeOffs.some(r => dateKey >= r.from && dateKey <= r.to);
  };

  const hasAvailabilityConflict = (userId: number, date: Date, shift?: RotaShift) => {
    if (!shift) return false;
    const cfg = getAvailabilityConfig(userId);
    const dayIndex = (date.getDay() + 6) % 7;
    if (!cfg.days.includes(dayIndex)) return true;
    if (isDateWithinException(date, cfg)) return true;
    if (!shift.startTime || !shift.endTime) return false;
    if (shift.startTime < cfg.startTime || shift.endTime > cfg.endTime) return true;
    return false;
  };

  const computeShiftHours = (date: string, startTime?: string, endTime?: string) => {
    if (!startTime || !endTime) return 0;
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diff < 0) diff += 24;
    return parseFloat(Math.max(0, diff).toFixed(2));
  };

  const syncRotaToWorkShifts = (sourceRota: RotaShift[]) => {
    const generated = sourceRota.map((r) => ({
      id: `ROTA-SHIFT-${r.id}`,
      userId: r.userId,
      username: r.username,
      fullName: r.fullName,
      date: r.date,
      startTime: r.startTime || '09:00',
      endTime: r.endTime || '17:00',
      breakMinutes: 0,
      totalHours: computeShiftHours(r.date, r.startTime || '09:00', r.endTime || '17:00'),
      notes: 'Synced from Rota',
    })) as WorkShift[];
    setWorkShifts(prev => {
      const nonRota = prev.filter(s => !s.id.startsWith('ROTA-SHIFT-'));
      return [...nonRota, ...generated];
    });
  };

  const generateRotaForVisibleRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const candidateDates = displayDates.filter(date => {
      if (rotaView === 'weekly' && weekOffset === 0) return date >= today;
      if (rotaView === 'monthly' && monthOffset === 0) return date >= today;
      return true;
    });

    if (candidateDates.length === 0) {
      addToast(t('noShiftsFound'), 'info');
      return;
    }
    const staffPool = staffForRota;
    const assignmentCounts = new Map<number, number>();
    staffPool.forEach(s => assignmentCounts.set(s.id, 0));

    const generated: RotaShift[] = [];

    candidateDates.forEach(date => {
      const dayIndex = (date.getDay() + 6) % 7;
      const needed = staffNeeded[dayIndex] || 0;
      if (needed === 0) return;

      const availableStaff = staffPool.filter(s => {
        const config = getAvailabilityConfig(s.id);
        if (!config.days.includes(dayIndex)) return false;
        if (isDateWithinException(date, config)) return false;
        return true;
      });

      const ranked = [...availableStaff].sort((a, b) => (assignmentCounts.get(a.id) || 0) - (assignmentCounts.get(b.id) || 0));
      ranked.slice(0, needed).forEach(staffMember => {
        assignmentCounts.set(staffMember.id, (assignmentCounts.get(staffMember.id) || 0) + 1);
        generated.push({
          id: `ROTA-${staffMember.id}-${toDateKey(date)}`,
          userId: staffMember.id,
          username: staffMember.username,
          fullName: staffMember.fullName,
          date: toDateKey(date),
          startTime: getAvailabilityConfig(staffMember.id).startTime || '09:00',
          endTime: getAvailabilityConfig(staffMember.id).endTime || '17:00'
        });
      });
    });

    const generatedDates = new Set(generated.map(g => g.date));
    const hasOverlap = rota.some(r => generatedDates.has(r.date));
    if (hasOverlap) {
      setPendingGenerated(generated);
      setShowOverwriteConfirm(true);
      return;
    }
    setRotaPreview(generated);
  };

  const applyGeneratedRota = () => {
    if (!pendingGenerated) return;
    setRotaPreview(pendingGenerated);
    setPendingGenerated(null);
    setShowOverwriteConfirm(false);
  };

  const savePreviewRota = () => {
    if (!rotaPreview) return;
    const previewDates = new Set(rotaPreview.map(r => r.date));
    const retained = rota.filter(r => !previewDates.has(r.date));
    const merged = [...retained, ...rotaPreview];
    setRota(merged);
    syncRotaToWorkShifts(merged);
    setRotaPreview(null);
    addToast(t('rotaSaved'));
  };

  const discardPreview = () => {
    setRotaPreview(null);
  };

  return (
    <div className="space-y-5 max-w-full overflow-hidden">
      <div className="inline-flex flex-wrap gap-1 bg-bakery-beige/50 p-1 rounded-xl">
        {[
          { id: 'staff', label: t('staffDetails') },
          { id: 'shifts', label: t('workShifts') },
          { id: 'rota', label: t('rota') },
          { id: 'timeoff', label: t('timeOffTab') },
        ].map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as 'staff' | 'shifts' | 'rota' | 'timeoff')}
            className={`px-3.5 py-1.5 rounded-lg font-bold text-sm transition-colors ${
              activeSection === section.id
                ? 'bg-bakery-brown text-white shadow-sm'
                : 'text-bakery-brown/60 hover:bg-white/70'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'staff' && (
        <section>
          {lastInviteCreds && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p>
                Staff can sign in with email <span className="font-mono font-bold">{lastInviteCreds.username}</span> (Staff Login). Share the password securely — it is not stored in this browser.
              </p>
              <button type="button" className="text-xs font-bold underline" onClick={() => setLastInviteCreds(null)}>Dismiss</button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
            <div>
              <h3 className="text-base font-bold font-serif text-bakery-brown">{t('staffDetails')}</h3>
              <p className="text-xs text-bakery-brown/50">{t('teamSubtitle')}</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-brown/40" size={16} />
                <input 
                  type="text"
                  placeholder={t('search')}
                  value={staffSearch}
                  onChange={e => setStaffSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm"
                />
              </div>
              <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center justify-center gap-2 text-sm px-6 py-3 rounded-xl active:scale-95 whitespace-nowrap">
                <Plus size={18} />
                {t('addStaff')}
              </button>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="mt-8 py-16 text-center border border-dashed border-bakery-beige rounded-2xl">
              <Users className="mx-auto text-bakery-brown/30 mb-3" size={40} />
              <p className="text-bakery-brown/60 mb-4">{t('inviteFirstStaff')}</p>
              <button onClick={() => setShowAddModal(true)} className="btn-primary px-6 py-3 rounded-xl text-sm font-bold">
                {t('addStaff')}
              </button>
            </div>
          ) : (
            <>
              <div className="card-bakery overflow-hidden mt-4">
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-left text-sm min-w-[600px]">
                    <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
                      <tr>
                        <SortableTh label={t('name')} column="name" sortKey={staffSortKey} sortDirection={staffSortDir} onSort={toggleStaffSort} />
                        <SortableTh label={t('username')} column="username" sortKey={staffSortKey} sortDirection={staffSortDir} onSort={toggleStaffSort} />
                        <SortableTh label={t('role')} column="role" sortKey={staffSortKey} sortDirection={staffSortDir} onSort={toggleStaffSort} />
                        {hasOwnerAccess(user?.role) && (
                          <SortableTh label={t('hourlyRate')} column="hourlyRate" sortKey={staffSortKey} sortDirection={staffSortDir} onSort={toggleStaffSort} />
                        )}
                        <th className="p-4 text-right">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bakery-beige">
                      {paginatedUsers.map(u => (
                        <tr key={u.id} className="hover:bg-bakery-cream/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-bakery-brown text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                {u.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <p className="font-bold leading-tight whitespace-nowrap">{u.fullName}</p>
                            </div>
                          </td>
                          <td className="p-4 text-[10px] text-bakery-brown/50 whitespace-nowrap">@{u.username}</td>
                          <td className="p-4">
                            <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                              u.role === 'owner' ? 'bg-amber-100 text-amber-700' : 
                              u.role === 'manager' ? 'bg-blue-100 text-blue-700' : 
                              'bg-bakery-beige text-bakery-brown'
                            }`}>
                              {t(u.role === 'staff' ? 'staffRole' : u.role)}
                            </span>
                          </td>
                          {hasOwnerAccess(user?.role) && (
                            <td className="p-4 font-bold">{u.hourlyRate ? formatPrice(u.hourlyRate) : t('dash')}</td>
                          )}
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1">
                              <button 
                                onClick={() => setEditStaff(u)}
                                className="p-2 text-bakery-brown hover:bg-bakery-beige rounded-lg transition-colors active:scale-90"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => setDeleteConfirm(u)} 
                                disabled={u.username === 'owner'}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed active:scale-90"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <DataTablePagination
                page={staffPaging.page}
                pageSize={staffPaging.pageSize}
                totalItems={filteredUsers.length}
                onPageChange={staffPaging.setPage}
                onPageSizeChange={staffPaging.setPageSize}
              />
            </>
          )}
        </section>
      )}

      {activeSection === 'shifts' && (
        <section>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3">
            <div>
              <h3 className="text-base font-bold font-serif flex items-center gap-2 text-bakery-brown">
                <Clock size={18} />
                {t('workShifts')}
              </h3>
              <p className="text-xs text-bakery-brown/50">{t('timesheetsSubtitle')}</p>
              <p className="text-[11px] text-bakery-brown/40 mt-0.5">{t('loggedHoursHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setShowAddShiftModal(true)}
                className="btn-primary flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold active:scale-95"
              >
                <Plus size={16} />
                {t('logShift')}
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('rota')}
                className="px-4 py-2 rounded-xl border border-bakery-beige text-xs font-bold text-bakery-brown/70 hover:bg-bakery-beige/40"
              >
                {t('viewPlannedRota')}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4 mt-4">
            <select 
              value={shiftFilter.staff}
              onChange={e => setShiftFilter({ ...shiftFilter, staff: e.target.value })}
              className="flex-1 md:flex-none p-2 bg-white border border-bakery-beige rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-bakery-caramel"
            >
              <option value="All">{t('allStaff')}</option>
              <option value="CurrentStaff">{t('currentStaff')}</option>
              <option value="FormerStaff">{t('formerStaff')}</option>
              {users.map(u => <option key={u.id} value={u.username}>{u.fullName}</option>)}
            </select>
            <input 
              type="date" 
              value={shiftFilter.from}
              onChange={e => setShiftFilter({ ...shiftFilter, from: e.target.value })}
              className="flex-1 md:flex-none p-2 bg-white border border-bakery-beige rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-bakery-caramel"
            />
            <input 
              type="date" 
              value={shiftFilter.to}
              onChange={e => setShiftFilter({ ...shiftFilter, to: e.target.value })}
              className="flex-1 md:flex-none p-2 bg-white border border-bakery-beige rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-bakery-caramel"
            />
            <button
              type="button"
              className="px-3 py-2 rounded-lg border border-bakery-beige text-xs font-bold text-bakery-brown/70"
              onClick={() => {
                const now = new Date();
                const day = (now.getDay() + 6) % 7;
                const start = new Date(now);
                start.setDate(now.getDate() - day);
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                setShiftFilter(f => ({ ...f, from: toDateKey(start), to: toDateKey(end) }));
              }}
            >
              {t('thisWeek')}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card-bakery p-4 bg-bakery-beige/20">
              <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">{t('totalHours')}</p>
              <p className="text-lg md:text-xl font-black text-bakery-brown">{totalFilteredHours.toFixed(2)}h</p>
            </div>
            <div className="card-bakery p-4 bg-bakery-beige/20">
              <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">{t('totalShifts')}</p>
              <p className="text-lg md:text-xl font-black text-bakery-brown">{filteredShifts.length}</p>
            </div>
            <div className="card-bakery p-4 bg-bakery-beige/20 col-span-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">{t('totalWageCost')}</p>
              <p className="text-lg md:text-xl font-black text-bakery-brown">{formatPrice(totalWageCost)}</p>
            </div>
          </div>

          {hoursPerPerson.length > 0 && shiftFilter.staff === 'All' && (
            <div className="flex flex-wrap gap-3 mb-6">
              {hoursPerPerson.map(p => (
                <div key={p.name} className="px-3 py-2 bg-white border border-bakery-beige rounded-xl shadow-sm flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-bakery-brown text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-bakery-brown/40 uppercase leading-none mb-1 whitespace-nowrap">{p.name}</p>
                    <p className="text-xs font-black text-bakery-brown">{p.hours.toFixed(2)}h</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {paginatedShifts.map(s => {
              const wage = calculateWage(s.totalHours, s.userId);
              return (
                <div key={s.id} className="bg-white border border-bakery-beige rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-bold">{s.fullName}</p>
                      <p className="text-xs text-bakery-brown/50">{s.date}</p>
                    </div>
                    <p className="font-black text-bakery-caramel">{s.totalHours}h</p>
                  </div>
                  <p className="text-xs text-bakery-brown/60">{s.startTime} – {s.endTime} · break {s.breakMinutes}m</p>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-sm font-bold">{wage > 0 ? formatPrice(wage) : t('dash')}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setEditShift(s)} className="p-2 text-bakery-brown hover:bg-bakery-beige rounded-lg"><Edit2 size={16} /></button>
                      <button onClick={() => setShiftDeleteConfirm(s)} className="p-2 text-rose-400 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredShifts.length === 0 && (
              <p className="p-8 text-center text-bakery-brown/40 italic">{t('noShiftsFound')}</p>
            )}
          </div>

          <div className="hidden md:block card-bakery overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <SortableTh label={t('staffMember')} column="staff" sortKey={shiftSortKey} sortDirection={shiftSortDir} onSort={toggleShiftSort} />
                    <SortableTh label={t('date')} column="date" sortKey={shiftSortKey} sortDirection={shiftSortDir} onSort={toggleShiftSort} />
                    <SortableTh label={t('startTime')} column="start" sortKey={shiftSortKey} sortDirection={shiftSortDir} onSort={toggleShiftSort} />
                    <SortableTh label={t('endTime')} column="end" sortKey={shiftSortKey} sortDirection={shiftSortDir} onSort={toggleShiftSort} />
                    <SortableTh label={t('break')} column="break" sortKey={shiftSortKey} sortDirection={shiftSortDir} onSort={toggleShiftSort} />
                    <SortableTh label={t('total')} column="total" sortKey={shiftSortKey} sortDirection={shiftSortDir} onSort={toggleShiftSort} />
                    <SortableTh label={t('wageCost')} column="wage" sortKey={shiftSortKey} sortDirection={shiftSortDir} onSort={toggleShiftSort} />
                    <th className="p-4 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bakery-beige">
                  {paginatedShifts.map(s => {
                    const wage = calculateWage(s.totalHours, s.userId);
                    return (
                      <tr key={s.id} className="hover:bg-bakery-cream/30 transition-colors">
                        <td className="p-4">
                          <p className="font-bold leading-tight whitespace-nowrap">{s.fullName}</p>
                          <p className="text-[10px] text-bakery-brown/50">@{s.username}</p>
                        </td>
                        <td className="p-4 font-medium whitespace-nowrap">{s.date}</td>
                        <td className="p-4 whitespace-nowrap">{s.startTime}</td>
                        <td className="p-4 whitespace-nowrap">{s.endTime}</td>
                        <td className="p-4 text-bakery-brown/40 whitespace-nowrap">{s.breakMinutes}m</td>
                        <td className="p-4 font-black text-bakery-caramel whitespace-nowrap">{s.totalHours}h</td>
                        <td className="p-4 font-bold whitespace-nowrap">{wage > 0 ? formatPrice(wage) : t('dash')}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setEditShift(s)} className="p-2 text-bakery-brown hover:bg-bakery-beige rounded-lg"><Edit2 size={18} /></button>
                            <button onClick={() => setShiftDeleteConfirm(s)} className="p-2 text-rose-400 hover:text-rose-600"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredShifts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-bakery-brown/40 italic">{t('noShiftsFound')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <DataTablePagination
            page={shiftsPaging.page}
            pageSize={shiftsPaging.pageSize}
            totalItems={filteredShifts.length}
            onPageChange={shiftsPaging.setPage}
            onPageSizeChange={shiftsPaging.setPageSize}
          />
        </section>
      )}


      {activeSection === 'rota' && (
        <section className="space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold font-serif text-bakery-brown">{t('rota')}</h3>
              <p className="text-xs text-bakery-brown/50">{t('rotaHint')}</p>
              <p className="text-sm font-bold text-bakery-brown mt-1">{weekRangeLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-bakery-beige/40 p-1 rounded-xl">
                <button type="button" onClick={() => { setRotaView('weekly'); setMonthDayFocus(null); }} className={`h-8 px-3 rounded-lg text-xs font-bold ${rotaView === 'weekly' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'}`}>{t('weekly')}</button>
                <button type="button" onClick={() => { setRotaView('monthly'); setEditingCell(null); }} className={`h-8 px-3 rounded-lg text-xs font-bold ${rotaView === 'monthly' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'}`}>{t('monthly')}</button>
              </div>
              <button type="button" onClick={() => { if (rotaView === 'weekly') setWeekOffset(0); else setMonthOffset(0); }} className="h-8 px-3 rounded-xl border border-bakery-beige text-xs font-bold text-bakery-brown/70">{rotaView === 'weekly' ? t('thisWeek') : t('thisMonth')}</button>
              <button type="button" onClick={() => rotaView === 'weekly' ? setWeekOffset(weekOffset - 1) : setMonthOffset(monthOffset - 1)} className="h-8 w-8 rounded-xl bg-white border border-bakery-beige flex items-center justify-center"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => rotaView === 'weekly' ? setWeekOffset(weekOffset + 1) : setMonthOffset(monthOffset + 1)} className="h-8 w-8 rounded-xl bg-white border border-bakery-beige flex items-center justify-center"><ChevronRight size={16} /></button>
              {canEditRota && (
                <>
                  <button type="button" onClick={() => setShowCoverageTargets(true)} className="h-8 px-3 rounded-xl border border-bakery-beige bg-white text-xs font-bold inline-flex items-center gap-1.5 text-bakery-brown/70"><Target size={14} />{t('staffNeededPerDay')}</button>
                  <button type="button" onClick={() => setShowAvailabilityModal(true)} className="h-8 px-3 rounded-xl border border-bakery-beige bg-white text-xs font-bold inline-flex items-center gap-1.5 text-bakery-brown/70"><Calendar size={14} />{t('availabilityExceptions')}</button>
                  <button type="button" onClick={generateRotaForVisibleRange} className="h-8 px-3 rounded-xl border border-bakery-beige text-xs font-bold inline-flex items-center gap-1.5 text-bakery-brown hover:bg-bakery-beige/40"><Sparkles size={14} />{rotaView === 'monthly' ? t('autoGenerateMonth') : t('autoGenerateRota')}</button>
                </>
              )}
            </div>
          </div>

          {rotaPreview && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-emerald-50 border border-dashed border-emerald-300 rounded-2xl">
              <div>
                <p className="font-bold text-emerald-800">{t('previewingRota')}</p>
                <p className="text-xs text-emerald-700/70">{t('previewHint')}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={savePreviewRota} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"><Save size={16} />{t('saveRota')}</button>
                <button type="button" onClick={discardPreview} className="px-4 py-2 rounded-xl text-xs font-bold border border-emerald-200 text-emerald-800"><X size={16} className="inline mr-1" />{t('discardPreview')}</button>
              </div>
            </div>
          )}

          <div className="flex gap-4 items-start">
            <div className={`flex-1 min-w-0 card-bakery overflow-hidden ${(editingCell && rotaView === 'weekly') || (rotaView === 'monthly' && monthDayFocus) ? 'lg:max-w-[calc(100%-20rem)]' : ''}`}>
              {rotaView === 'weekly' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[780px] border-collapse">
                    <thead>
                      <tr>
                        <th className="p-3 sticky left-0 z-10 bg-bakery-beige/50 border-b border-bakery-beige w-44">{t('staffMember')}</th>
                        {displayDates.map(date => {
                          const key = toDateKey(date);
                          const cov = coverageByDate[key] || { filled: 0, needed: 0 };
                          const ok = cov.needed === 0 || cov.filled >= cov.needed;
                          const isToday = key === todayKey;
                          return (
                            <th key={key} className={`p-2 text-center border-b border-bakery-beige ${isToday ? 'bg-bakery-accent/20' : 'bg-bakery-beige/30'}`}>
                              <div className="font-black text-bakery-brown">{date.toLocaleDateString(locale, { weekday: 'short' })}</div>
                              <div className="text-[11px] text-bakery-brown/50">{date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</div>
                              <div className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                                {cov.filled}/{cov.needed}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {staffForRota.map(staffMember => (
                        <tr key={staffMember.id} className="border-b border-bakery-beige/60">
                          <td className="p-2 sticky left-0 z-10 bg-white border-r border-bakery-beige/60">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${staffMember.role === 'manager' ? 'bg-blue-600 text-white' : 'bg-bakery-brown text-white'}`}>
                                {staffMember.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="leading-tight min-w-0">
                                <p className="font-bold text-xs truncate">{staffMember.fullName}</p>
                                <p className="text-[10px] text-bakery-brown/45 uppercase">{t(staffMember.role === 'staff' ? 'staffRole' : staffMember.role)}</p>
                              </div>
                            </div>
                          </td>
                          {displayDates.map(date => {
                            const dateKey = toDateKey(date);
                            const shift = findShift(staffMember.id, dateKey);
                            const onLeave = isStaffOnTimeOff(staffMember.id, dateKey);
                            const isConflict = hasAvailabilityConflict(staffMember.id, date, shift) || onLeave;
                            const isToday = dateKey === todayKey;
                            const isPreviewShift = !!(shift && rotaPreview?.some(s => s.id === shift.id));
                            return (
                              <td key={`${staffMember.id}-${dateKey}`} className={`p-1.5 align-top ${isToday ? 'bg-bakery-accent/10' : ''}`}>
                                <div
                                  onClick={() => handleCellClick(staffMember, dateKey)}
                                  onDragOver={(e) => { if (canEditRota && !onLeave) e.preventDefault(); }}
                                  onDrop={(e) => {
                                    if (!canEditRota) return;
                                    e.preventDefault();
                                    if (onLeave || isStaffOnTimeOff(staffMember.id, dateKey)) {
                                      addToast(t('staffOnLeave'), 'info');
                                      return;
                                    }
                                    const payload = e.dataTransfer.getData('text/plain');
                                    const parts = payload.split('|');
                                    if (parts.length !== 4) return;
                                    const [shiftId, fromUserIdStr, start, end] = parts;
                                    const fromUserId = parseInt(fromUserIdStr, 10);
                                    if (!shiftId || Number.isNaN(fromUserId) || fromUserId === staffMember.id) return;
                                    const moved = effectiveRota.find(s => s.id === shiftId && s.userId === fromUserId && s.date === dateKey);
                                    if (!moved) return;
                                    const removed = effectiveRota.filter(s => s.id !== shiftId);
                                    const target = staffForRota.find(u => u.id === staffMember.id);
                                    if (!target) return;
                                    updateRotaList([...removed, { ...moved, userId: target.id, username: target.username, fullName: target.fullName, startTime: start, endTime: end }]);
                                  }}
                                  className={`group relative min-h-[64px] rounded-xl border px-1.5 py-1.5 transition-colors ${
                                    onLeave && !shift
                                      ? 'border-rose-200 bg-rose-50/70'
                                      : shift
                                      ? `${roleTileClass(staffMember.role)} ${isPreviewShift ? 'border-dashed' : ''} ${isConflict ? 'border-l-4 border-l-rose-500' : ''}`
                                      : 'border-bakery-beige/80 bg-bakery-cream/10 hover:bg-bakery-beige/30'
                                  } ${!canEditRota ? 'cursor-default' : 'cursor-pointer'} ${editingCell?.userId === staffMember.id && editingCell.date === dateKey ? 'ring-2 ring-bakery-brown' : ''}`}
                                >
                                  {shift ? (
                                    <div
                                      draggable={canEditRota}
                                      onDragStart={(e) => {
                                        if (!canEditRota) return;
                                        setDraggingShiftId(shift.id);
                                        e.dataTransfer.setData('text/plain', `${shift.id}|${staffMember.id}|${shift.startTime || '09:00'}|${shift.endTime || '17:00'}`);
                                      }}
                                      onDragEnd={() => setDraggingShiftId(null)}
                                      className={`${draggingShiftId === shift.id ? 'opacity-40' : ''}`}
                                    >
                                      <p className="text-[11px] font-black leading-tight">{(shift.startTime || '09:00').slice(0,5)}–{(shift.endTime || '17:00').slice(0,5)}</p>
                                      <p className="text-[9px] opacity-70 mt-0.5 truncate">{staffMember.role === 'manager' ? t('manager') : t('staffRole')}</p>
                                    </div>
                                  ) : onLeave ? (
                                    <div className="h-full min-h-[52px] flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-rose-600/80">{t('staffOnLeave')}</span>
                                    </div>
                                  ) : (
                                    <div className="h-full min-h-[52px] flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-bakery-brown/25 group-hover:hidden">{t('dayOff')}</span>
                                      <span className="hidden group-hover:inline text-bakery-brown/50 text-lg font-black">+</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {staffForRota.length === 0 && (
                        <tr><td colSpan={8} className="p-10 text-center text-bakery-brown/40 italic">{t('inviteFirstStaff')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 sm:p-4">
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
                    {dayLabels.map(label => (
                      <div key={label} className="text-center text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 py-1">
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {monthCalendarCells.map((date, idx) => {
                      if (!date) {
                        return <div key={`pad-${idx}`} className="min-h-[100px] sm:min-h-[118px] rounded-xl bg-bakery-cream/40 border border-transparent" />;
                      }
                      const key = toDateKey(date);
                      const cov = coverageByDate[key] || { filled: 0, needed: 0 };
                      const ok = cov.needed === 0 || cov.filled >= cov.needed;
                      const short = cov.needed > 0 && cov.filled < cov.needed;
                      const people = effectiveRota.filter(s => s.date === key);
                      const isToday = key === todayKey;
                      const isFocused = monthDayFocus === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => openMonthDay(key)}
                          className={`min-h-[100px] sm:min-h-[118px] rounded-xl border p-1.5 sm:p-2 text-left transition-all hover:shadow-sm hover:border-bakery-caramel/50 ${
                            isFocused
                              ? 'ring-2 ring-bakery-brown border-bakery-brown bg-white'
                              : isToday
                                ? 'border-bakery-caramel bg-bakery-accent/20'
                                : short
                                  ? 'border-amber-200 bg-amber-50/40'
                                  : 'border-bakery-beige bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1 mb-1.5">
                            <span className={`text-xs font-black ${isToday || isFocused ? 'text-bakery-brown' : 'text-bakery-brown/80'}`}>
                              {date.getDate()}
                            </span>
                            <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                              cov.needed === 0 && people.length === 0
                                ? 'bg-bakery-beige text-bakery-brown/40'
                                : ok
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-800'
                            }`}>
                              {cov.filled}/{cov.needed}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {people.slice(0, 3).map(shift => {
                              const staffMember = staffForRota.find(u => u.id === shift.userId);
                              const role = staffMember?.role || 'staff';
                              return (
                                <div
                                  key={shift.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={e => {
                                    e.stopPropagation();
                                    if (canEditRota && staffMember) handleCellClick(staffMember, key);
                                    else openMonthDay(key);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.stopPropagation();
                                      if (canEditRota && staffMember) handleCellClick(staffMember, key);
                                    }
                                  }}
                                  className={`rounded-md border px-1 py-0.5 ${roleTileClass(role)} ${canEditRota ? 'hover:brightness-95' : ''}`}
                                  title={`${shift.fullName} ${(shift.startTime || '09:00').slice(0, 5)}–${(shift.endTime || '17:00').slice(0, 5)}`}
                                >
                                  <p className="text-[9px] font-black truncate leading-tight">{shift.fullName.split(' ')[0]}</p>
                                  <p className="text-[8px] opacity-70 leading-tight">
                                    {(shift.startTime || '09:00').slice(0, 5)}–{(shift.endTime || '17:00').slice(0, 5)}
                                  </p>
                                </div>
                              );
                            })}
                            {people.length > 3 && (
                              <p className="text-[9px] font-bold text-bakery-brown/40 px-0.5">+{people.length - 3}</p>
                            )}
                            {people.length === 0 && canEditRota && (
                              <p className="text-[9px] font-bold text-bakery-brown/30 pt-2 text-center">+</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] text-bakery-brown/40 text-center">
                    {t('monthDayHint')}
                  </p>
                </div>
              )}
            </div>

            {rotaView === 'weekly' && editingCell && editingStaff && (
              <aside className="w-full lg:w-72 shrink-0 bg-white border border-bakery-beige rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{findShift(editingCell.userId, editingCell.date) ? t('editShiftPanel') : t('addShiftPanel')}</p>
                    <p className="font-bold text-bakery-brown">{editingStaff.fullName}</p>
                    <p className="text-xs text-bakery-brown/50">{editingCell.date}</p>
                  </div>
                  <button type="button" onClick={() => setEditingCell(null)} className="p-1 text-bakery-brown/40 hover:text-bakery-brown"><X size={16} /></button>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-bakery-brown/40 mb-1">{t('startTime')}</label>
                  <input type="time" className="w-full p-2.5 border border-bakery-beige rounded-xl text-sm font-bold" value={cellStart} onChange={e => setCellStart(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-bakery-brown/40 mb-1">{t('endTime')}</label>
                  <input type="time" className="w-full p-2.5 border border-bakery-beige rounded-xl text-sm font-bold" value={cellEnd} onChange={e => setCellEnd(e.target.value)} />
                </div>
                <button type="button" onClick={handleSaveCell} className="w-full bg-bakery-brown text-white rounded-xl py-2.5 text-sm font-bold">{t('save')}</button>
                {findShift(editingCell.userId, editingCell.date) && (
                  <button type="button" onClick={handleRemoveCell} className="w-full border border-bakery-beige rounded-xl py-2.5 text-sm font-bold text-bakery-brown/60">{t('remove')}</button>
                )}
              </aside>
            )}

            {rotaView === 'monthly' && monthDayFocus && (
              <aside className="w-full lg:w-80 shrink-0 bg-white border border-bakery-beige rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('rota')}</p>
                    <p className="font-bold text-bakery-brown">
                      {new Date(`${monthDayFocus}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs text-bakery-brown/50 mt-0.5">
                      {(coverageByDate[monthDayFocus]?.filled || 0)}/{(coverageByDate[monthDayFocus]?.needed || 0)} coverage
                    </p>
                  </div>
                  <button type="button" onClick={() => { setMonthDayFocus(null); setEditingCell(null); }} className="p-1 text-bakery-brown/40 hover:text-bakery-brown"><X size={16} /></button>
                </div>

                <div className="space-y-2">
                  {effectiveRota.filter(s => s.date === monthDayFocus).length === 0 && (
                    <p className="text-xs text-bakery-brown/45 italic py-2">{t('noStaffAssigned')}</p>
                  )}
                  {effectiveRota.filter(s => s.date === monthDayFocus).map(shift => {
                    const staffMember = staffForRota.find(u => u.id === shift.userId);
                    const isEditing = editingCell?.userId === shift.userId && editingCell.date === monthDayFocus;
                    return (
                      <div key={shift.id} className={`rounded-xl border p-2.5 ${isEditing ? 'border-bakery-brown bg-bakery-beige/30' : 'border-bakery-beige'}`}>
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => staffMember && canEditRota && handleCellClick(staffMember, monthDayFocus)}
                        >
                          <p className="text-sm font-bold text-bakery-brown">{shift.fullName}</p>
                          <p className="text-[11px] text-bakery-brown/50">
                            {(shift.startTime || '09:00').slice(0, 5)}–{(shift.endTime || '17:00').slice(0, 5)}
                          </p>
                        </button>
                        {isEditing && (
                          <div className="mt-2 space-y-2 border-t border-bakery-beige pt-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input type="time" className="w-full p-2 border border-bakery-beige rounded-lg text-xs font-bold" value={cellStart} onChange={e => setCellStart(e.target.value)} />
                              <input type="time" className="w-full p-2 border border-bakery-beige rounded-lg text-xs font-bold" value={cellEnd} onChange={e => setCellEnd(e.target.value)} />
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={handleSaveCell} className="flex-1 bg-bakery-brown text-white rounded-lg py-2 text-xs font-bold">{t('save')}</button>
                              <button type="button" onClick={handleRemoveCell} className="px-3 border border-bakery-beige rounded-lg text-xs font-bold text-rose-500">{t('remove')}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {canEditRota && (
                  <div className="space-y-2 border-t border-bakery-beige pt-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('assignStaff')}</p>
                    <select
                      className="w-full p-2.5 border border-bakery-beige rounded-xl text-sm font-bold bg-white"
                      value={monthAddUserId}
                      onChange={e => setMonthAddUserId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {staffForRota
                        .filter(s => !findShift(s.id, monthDayFocus))
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.fullName}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!monthAddUserId}
                      onClick={assignStaffToMonthDay}
                      className="w-full bg-bakery-brown text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40"
                    >
                      {t('addToDay')}
                    </button>
                  </div>
                )}
              </aside>
            )}
          </div>

          {canEditRota && showCoverageTargets && (
            <Modal title={t('staffNeededPerDay')} onClose={() => setShowCoverageTargets(false)}>
              <p className="text-sm text-bakery-brown/65 mb-1">{t('coverageTargetsHint')}</p>
              <p className="text-xs text-bakery-brown/45 mb-5">{t('coverageTargetsExample')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {dayLabels.map((label, idx) => (
                  <div key={label} className="space-y-2">
                    <p className="text-xs font-bold text-bakery-brown/60 text-center">{label}</p>
                    <label className="sr-only">{label} — {t('staffNeededPerDay')}</label>
                    <input type="number" min={0} className="w-full p-3 border border-bakery-beige rounded-xl text-center font-bold" value={staffNeeded[idx] ?? 0} onChange={e => setStaffNeeded(prev => ({ ...prev, [idx]: Math.max(0, parseInt(e.target.value) || 0) }))} />
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setShowCoverageTargets(false)} className="btn-primary w-full mt-6 py-3 rounded-xl font-bold">{t('save')}</button>
            </Modal>
          )}

          {canEditRota && showAvailabilityModal && (
            <Modal
              title={t('availabilityExceptions')}
              onClose={() => { setShowAvailabilityModal(false); setAvailabilityFocusId(null); }}
              size="lg"
            >
              <div className="flex flex-col lg:flex-row gap-5">
                <div className="lg:w-56 shrink-0 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 px-1">{t('staff')}</p>
                  <div className="space-y-1 max-h-[50vh] lg:max-h-[60vh] overflow-y-auto pr-1">
                    {staffForRota.map(staffMember => {
                      const active = (availabilityFocusId ?? staffForRota[0]?.id) === staffMember.id;
                      const cfg = getAvailabilityConfig(staffMember.id);
                      return (
                        <button
                          key={staffMember.id}
                          type="button"
                          onClick={() => setAvailabilityFocusId(staffMember.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                            active ? 'bg-bakery-brown text-white' : 'bg-bakery-cream/80 hover:bg-bakery-beige/60 text-bakery-brown'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                            active ? 'bg-white/15 text-white' : staffMember.role === 'manager' ? 'bg-blue-600 text-white' : 'bg-bakery-brown text-white'
                          }`}>
                            {staffMember.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{staffMember.fullName}</p>
                            <p className={`text-[10px] ${active ? 'text-white/60' : 'text-bakery-brown/45'}`}>
                              {cfg.days.length} days · {cfg.startTime.slice(0, 5)}–{cfg.endTime.slice(0, 5)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {staffForRota.length === 0 && (
                      <p className="text-sm text-bakery-brown/50 italic px-1">{t('inviteFirstStaff')}</p>
                    )}
                  </div>
                </div>

                {(() => {
                  const focused = staffForRota.find(s => s.id === (availabilityFocusId ?? staffForRota[0]?.id));
                  if (!focused) return null;
                  const cfg = getAvailabilityConfig(focused.id);
                  const toggleDay = (dayIdx: number) => {
                    const next = cfg.days.includes(dayIdx)
                      ? cfg.days.filter(d => d !== dayIdx)
                      : [...cfg.days, dayIdx].sort((a, b) => a - b);
                    setAvailabilityConfig(focused.id, { days: next });
                  };
                  return (
                    <div className="flex-1 rounded-2xl border border-bakery-beige bg-bakery-cream/40 p-4 sm:p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full text-xs font-black flex items-center justify-center ${
                          focused.role === 'manager' ? 'bg-blue-600 text-white' : 'bg-bakery-brown text-white'
                        }`}>
                          {focused.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-bakery-brown text-base">{focused.fullName}</p>
                          <p className="text-xs text-bakery-brown/45 uppercase tracking-wider">
                            {t(focused.role === 'staff' ? 'staffRole' : focused.role)}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('workingDays')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {dayLabels.map((day, idx) => {
                            const on = cfg.days.includes(idx);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(idx)}
                                className={`min-w-[2.75rem] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  on
                                    ? 'bg-bakery-brown text-white shadow-sm'
                                    : 'bg-white border border-bakery-beige text-bakery-brown/50 hover:border-bakery-caramel'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1.5">{t('usualHours')}</p>
                          <div className="inline-flex items-center gap-2 bg-white border border-bakery-beige rounded-xl px-2.5 py-1.5">
                            <input
                              type="time"
                              className="w-[7.5rem] p-1.5 text-sm font-bold bg-transparent outline-none"
                              value={cfg.startTime}
                              onChange={e => setAvailabilityConfig(focused.id, { startTime: e.target.value })}
                              aria-label={t('startTime')}
                            />
                            <span className="text-bakery-brown/35 font-bold text-sm">–</span>
                            <input
                              type="time"
                              className="w-[7.5rem] p-1.5 text-sm font-bold bg-transparent outline-none"
                              value={cfg.endTime}
                              onChange={e => setAvailabilityConfig(focused.id, { endTime: e.target.value })}
                              aria-label={t('endTime')}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAvailabilityModal(false)}
                        className="btn-primary w-full sm:w-auto px-8 py-2.5 rounded-xl font-bold"
                      >
                        {t('save')}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </Modal>
          )}
        </section>
      )}

      {activeSection === 'timeoff' && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold font-serif text-bakery-brown">{t('timeOffTab')}</h3>
              <p className="text-xs text-bakery-brown/50">{t('timeOffCalendarHint')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTimeOffMonthOffset(o => o - 1)}
                className="p-2 rounded-xl border border-bakery-beige bg-white text-bakery-brown/70 hover:bg-bakery-beige/50"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="text-sm font-bold min-w-[9rem] text-center">
                {(() => {
                  const d = new Date();
                  d.setDate(1);
                  d.setMonth(d.getMonth() + timeOffMonthOffset);
                  return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
                })()}
              </p>
              <button
                type="button"
                onClick={() => setTimeOffMonthOffset(o => o + 1)}
                className="p-2 rounded-xl border border-bakery-beige bg-white text-bakery-brown/70 hover:bg-bakery-beige/50"
              >
                <ChevronRight size={16} />
              </button>
              {canEditRota && (
                <button
                  type="button"
                  onClick={() => {
                    setTimeOffForm({
                      userId: staffForRota[0] ? String(staffForRota[0].id) : '',
                      from: '',
                      to: '',
                    });
                    setShowAddTimeOff(true);
                  }}
                  className="btn-primary h-9 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  {t('addTimeOff')}
                </button>
              )}
            </div>
          </div>

          {(() => {
            const base = new Date();
            base.setDate(1);
            base.setMonth(base.getMonth() + timeOffMonthOffset);
            base.setHours(0, 0, 0, 0);
            const year = base.getFullYear();
            const month = base.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthDates = Array.from({ length: daysInMonth }, (_, i) => {
              const d = new Date(year, month, i + 1);
              return d;
            });
            const startPad = (monthDates[0].getDay() + 6) % 7;
            const cells: (Date | null)[] = [
              ...Array.from({ length: startPad }, () => null),
              ...monthDates,
            ];
            while (cells.length % 7 !== 0) cells.push(null);

            const monthStart = toDateKey(monthDates[0]);
            const monthEnd = toDateKey(monthDates[monthDates.length - 1]);

            const entries = staffForRota.flatMap(staffMember => {
              const cfg = getAvailabilityConfig(staffMember.id);
              return cfg.timeOffs
                .filter(r => !(r.to < monthStart || r.from > monthEnd))
                .map(r => ({ staffMember, range: r }));
            });

            const offByDate = new Map<string, { id: number; name: string; role: Role }[]>();
            monthDates.forEach(date => {
              const key = toDateKey(date);
              const off = staffForRota
                .filter(s => isStaffOnTimeOff(s.id, key))
                .map(s => ({ id: s.id, name: s.fullName, role: s.role }));
              if (off.length) offByDate.set(key, off);
            });

            return (
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
                <div className="bg-white border border-bakery-beige rounded-2xl p-3 sm:p-4 overflow-hidden">
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {dayLabels.map(d => (
                      <p key={d} className="text-[10px] font-black uppercase tracking-wider text-bakery-brown/40 text-center py-1">
                        {d}
                      </p>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((date, idx) => {
                      if (!date) return <div key={`pad-${idx}`} className="min-h-[5.5rem] rounded-xl bg-bakery-cream/40" />;
                      const key = toDateKey(date);
                      const off = offByDate.get(key) || [];
                      const isToday = key === todayKey;
                      return (
                        <div
                          key={key}
                          className={`min-h-[5.5rem] rounded-xl border p-1.5 ${
                            isToday
                              ? 'border-bakery-caramel bg-bakery-accent/10'
                              : off.length
                                ? 'border-rose-200 bg-rose-50/50'
                                : 'border-bakery-beige/70 bg-bakery-cream/30'
                          }`}
                        >
                          <p className={`text-[11px] font-bold mb-1 ${isToday ? 'text-bakery-caramel' : 'text-bakery-brown/60'}`}>
                            {date.getDate()}
                          </p>
                          <div className="space-y-0.5">
                            {off.slice(0, 3).map(person => (
                              <p
                                key={person.id}
                                className={`text-[9px] font-bold truncate px-1 py-0.5 rounded ${
                                  person.role === 'manager'
                                    ? 'bg-blue-100 text-blue-900'
                                    : 'bg-bakery-brown/10 text-bakery-brown'
                                }`}
                                title={person.name}
                              >
                                {person.name.split(' ')[0]}
                              </p>
                            ))}
                            {off.length > 3 && (
                              <p className="text-[9px] font-bold text-bakery-brown/45 px-1">+{off.length - 3}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white border border-bakery-beige rounded-2xl p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">
                    {t('timeOffRange')}
                  </p>
                  {entries.length === 0 ? (
                    <p className="text-sm text-bakery-brown/45 italic">{t('noTimeOff')}</p>
                  ) : (
                    <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                      {entries
                        .sort((a, b) => a.range.from.localeCompare(b.range.from))
                        .map(({ staffMember, range }) => (
                          <div
                            key={`${staffMember.id}-${range.id}`}
                            className="flex items-start gap-3 p-3 rounded-xl border border-bakery-beige bg-bakery-cream/40"
                          >
                            <div className={`w-8 h-8 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                              staffMember.role === 'manager' ? 'bg-blue-600 text-white' : 'bg-bakery-brown text-white'
                            }`}>
                              {staffMember.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold truncate">{staffMember.fullName}</p>
                              <p className="text-xs text-bakery-brown/50">
                                {range.from} → {range.to}
                              </p>
                            </div>
                            {canEditRota && (
                              <button
                                type="button"
                                onClick={() => removeTimeOffRange(staffMember.id, range.id)}
                                className="text-[10px] font-bold text-rose-600 hover:underline shrink-0"
                              >
                                {t('removeTimeOff')}
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {showAddTimeOff && canEditRota && (
            <Modal title={t('addTimeOff')} onClose={() => setShowAddTimeOff(false)}>
              <form
                className="space-y-4"
                onSubmit={e => {
                  e.preventDefault();
                  const userId = parseInt(timeOffForm.userId, 10);
                  if (!userId || !timeOffForm.from || !timeOffForm.to) return;
                  if (addTimeOffRange(userId, timeOffForm.from, timeOffForm.to)) {
                    setShowAddTimeOff(false);
                    addToast(t('save'), 'success');
                  }
                }}
              >
                <div>
                  <label className="block text-sm font-bold mb-2">{t('staffMember')}</label>
                  <select
                    className="w-full p-3 border border-bakery-beige rounded-xl font-bold bg-white"
                    value={timeOffForm.userId}
                    onChange={e => setTimeOffForm(prev => ({ ...prev, userId: e.target.value }))}
                    required
                  >
                    {staffForRota.map(s => (
                      <option key={s.id} value={s.id}>{s.fullName}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-bold mb-2">{t('timeOffFrom')}</label>
                    <input
                      type="date"
                      className="w-full p-3 border border-bakery-beige rounded-xl font-bold"
                      value={timeOffForm.from}
                      onChange={e => setTimeOffForm(prev => ({ ...prev, from: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">{t('timeOffTo')}</label>
                    <input
                      type="date"
                      className="w-full p-3 border border-bakery-beige rounded-xl font-bold"
                      value={timeOffForm.to}
                      onChange={e => setTimeOffForm(prev => ({ ...prev, to: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full py-3 rounded-xl font-bold">
                  {t('save')}
                </button>
              </form>
            </Modal>
          )}
        </section>
      )}

      {showAddModal && (
        <Modal title={t('addStaff')} onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddStaff} className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2">{t('fullName')}</label>
              <input name="fullName" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel" placeholder={t('fullNamePlaceholder')} required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">{t('username')}</label>
              <input name="username" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel" placeholder={t('usernamePlaceholder')} required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">{t('email')}</label>
              <input name="email" type="email" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel" placeholder={t('emailPlaceholder')} required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">{t('password')}</label>
              <input
                name="password"
                type="password"
                minLength={8}
                className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                required
                value={invitePassword}
                onChange={e => setInvitePassword(e.target.value)}
              />
              <PasswordStrengthMeter password={invitePassword} t={t} />
              <p className="mt-1 text-[11px] text-bakery-brown/45">{t('passwordMinHint')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">{t('role')}</label>
                <select name="role" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel">
                  <option value="staff">{t('staffRole')}</option>
                  <option value="manager">{t('manager')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">{t('hourlyRate')} ({businessSettings?.currencySymbol || '€'})</label>
                <input name="hourlyRate" type="number" step="0.01" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel" placeholder="0.00" />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold text-lg">
              {t('save')}
            </button>
          </form>
        </Modal>
      )}

      {editStaff && (
        <Modal title={t('editStaffMember')} onClose={() => setEditStaff(null)}>
          <form onSubmit={handleEditStaffSave} className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2">{t('fullName')}</label>
              <input 
                className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel" 
                value={editStaff.fullName}
                onChange={e => setEditStaff({ ...editStaff, fullName: e.target.value })}
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">{t('email')}</label>
              <input
                type="email"
                className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                value={editStaff.email || ''}
                onChange={e => setEditStaff({ ...editStaff, email: e.target.value })}
                placeholder={t('emailPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">{t('role')}</label>
                <select 
                  className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                  value={editStaff.role}
                  onChange={e => setEditStaff({ ...editStaff, role: e.target.value as Role })}
                >
                  <option value="staff">{t('staffRole')}</option>
                  <option value="manager">{t('manager')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">{t('hourlyRate')} ({businessSettings?.currencySymbol || '€'})</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                  value={editStaff.hourlyRate || ''}
                  onChange={e => setEditStaff({ ...editStaff, hourlyRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            {editStaff && canResetPassword(user, editStaff) && (
              <div className="space-y-3 border-t border-bakery-beige pt-4">
                <p className="text-xs font-black uppercase tracking-widest text-bakery-brown/40">{t('resetPassword')}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">{t('newPassword')}</label>
                    <input
                      type="password"
                      className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                      value={resetPassword}
                      onChange={e => setResetPassword(e.target.value)}
                      placeholder={t('newPasswordPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">{t('confirmPassword')}</label>
                    <input
                      type="password"
                      className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel"
                      value={resetPasswordConfirm}
                      onChange={e => setResetPasswordConfirm(e.target.value)}
                      placeholder={t('confirmPasswordPlaceholder')}
                    />
                  </div>
                </div>
              </div>
            )}
            <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold text-lg">
              {t('save')}
            </button>
          </form>
        </Modal>
      )}

      {editShift && (
        <Modal title={t('editWorkShift')} onClose={() => setEditShift(null)}>
          <form onSubmit={handleEditShiftSave} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('date')}</label>
                <input 
                  type="date" 
                  className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                  value={editShift.date}
                  onChange={e => setEditShift({ ...editShift, date: e.target.value })}
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('startTime')}</label>
                  <input 
                    type="time" 
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                    value={editShift.startTime}
                    onChange={e => setEditShift({ ...editShift, startTime: e.target.value })}
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('endTime')}</label>
                  <input 
                    type="time" 
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                    value={editShift.endTime}
                    onChange={e => setEditShift({ ...editShift, endTime: e.target.value })}
                    required 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('break')} (min)</label>
                <input 
                  type="number" 
                  className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                  value={editShift.breakMinutes}
                  onChange={e => setEditShift({ ...editShift, breakMinutes: parseInt(e.target.value) || 0 })}
                  required 
                />
              </div>
              <div className="bg-bakery-accent/20 p-4 rounded-2xl border border-bakery-accent/30 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">{t('wageCost')}</p>
                <p className="text-2xl font-black text-bakery-brown">
                  {formatPrice(calculateWage(editShift.totalHours, editShift.userId))}
                </p>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full p-5 rounded-2xl font-bold text-lg shadow-lg active:scale-95">
              {t('save')}
            </button>
          </form>
        </Modal>
      )}

      {showAddShiftModal && (
        <Modal title={t('logWorkShift')} onClose={() => setShowAddShiftModal(false)}>
          <form onSubmit={handleAddShift} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('staffMember')}</label>
                <select 
                  className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                  value={shiftFormData.userId}
                  onChange={e => setShiftFormData({ ...shiftFormData, userId: e.target.value })}
                  required
                >
                  <option value="">{t('selectStaff')}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName} (@{u.username})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('date')}</label>
                <input 
                  type="date" 
                  className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                  value={shiftFormData.date}
                  onChange={e => setShiftFormData({ ...shiftFormData, date: e.target.value })}
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('startTime')}</label>
                  <input 
                    type="time" 
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                    value={shiftFormData.startTime}
                    onChange={e => setShiftFormData({ ...shiftFormData, startTime: e.target.value })}
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('endTime')}</label>
                  <input 
                    type="time" 
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                    value={shiftFormData.endTime}
                    onChange={e => setShiftFormData({ ...shiftFormData, endTime: e.target.value })}
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('break')} (min)</label>
                  <input 
                    type="number" 
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                    value={shiftFormData.breakMinutes}
                    onChange={e => setShiftFormData({ ...shiftFormData, breakMinutes: e.target.value })}
                    required 
                  />
                </div>
                <div className="bg-bakery-accent/20 p-4 rounded-2xl border border-bakery-accent/30 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">{t('wageCost')}</p>
                  <p className="text-2xl font-black text-bakery-brown">{formatPrice(calculatedWage)}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('notes')}</label>
                <textarea 
                  className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel min-h-[100px] font-medium"
                  placeholder={t('notesPlaceholder')}
                  value={shiftFormData.notes}
                  onChange={e => setShiftFormData({ ...shiftFormData, notes: e.target.value })}
                ></textarea>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full p-5 rounded-2xl font-bold text-lg shadow-lg active:scale-95">
              {t('save')}
            </button>
          </form>
        </Modal>
      )}

      {deleteConfirm && (
        <ConfirmDialog 
          isOpen={!!deleteConfirm}
          title={t('deleteStaffMember')}
          message={t('deleteStaffConfirm').replace('{name}', deleteConfirm.fullName)}
          onConfirm={handleDelete}
          onClose={() => setDeleteConfirm(null)}
        />
      )}

      {shiftDeleteConfirm && (
        <ConfirmDialog 
          isOpen={!!shiftDeleteConfirm}
          title={t('deleteShift')}
          message={t('deleteShiftConfirm').replace('{name}', shiftDeleteConfirm.fullName).replace('{date}', shiftDeleteConfirm.date)}
          onConfirm={handleDeleteShift}
          onClose={() => setShiftDeleteConfirm(null)}
        />
      )}

      {showOverwriteConfirm && (
        <ConfirmDialog
          isOpen={showOverwriteConfirm}
          title={t('overwriteRotaTitle')}
          message={t('overwriteRotaMessage')}
          onConfirm={applyGeneratedRota}
          onClose={() => { setShowOverwriteConfirm(false); setPendingGenerated(null); }}
        />
      )}
    </div>
  );
};
