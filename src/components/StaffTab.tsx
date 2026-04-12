import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Plus, Trash2, ShieldAlert, Clock, Edit2, Search, Calendar, ChevronLeft, ChevronRight, Sparkles, Save, X } from 'lucide-react';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { Pagination } from './Pagination';
import { User, Role, WorkShift, RotaShift } from '../types';
import { toSearchValue } from '../utils/search';

export const StaffTab = () => {
  const { users, setUsers, workShifts, setWorkShifts, t, addToast, resetAllData, formatPrice, businessSettings, user, rota, setRota, staffAvailability, setStaffAvailability, lang } = useApp();
  const [activeSection, setActiveSection] = useState<'staff' | 'shifts' | 'rota'>('staff');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [shiftDeleteConfirm, setShiftDeleteConfirm] = useState<WorkShift | null>(null);
  const [shiftFilter, setShiftFilter] = useState({ staff: 'All', from: '', to: '' });
  const [rotaView, setRotaView] = useState<'weekly' | 'monthly'>('weekly');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [editingCell, setEditingCell] = useState<{ userId: number; date: string } | null>(null);
  const [cellStart, setCellStart] = useState('09:00');
  const [cellEnd, setCellEnd] = useState('17:00');
  const [rotaPreview, setRotaPreview] = useState<RotaShift[] | null>(null);
  const [pendingGenerated, setPendingGenerated] = useState<RotaShift[] | null>(null);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [staffNeeded, setStaffNeeded] = useState<Record<number, number>>({
    0: 2,
    1: 2,
    2: 2,
    3: 2,
    4: 2,
    5: 3,
    6: 3
  });

  const [staffPage, setStaffPage] = useState(1);
  const [shiftPage, setShiftPage] = useState(1);
  const [staffSearch, setStaffSearch] = useState('');
  const [editStaff, setEditStaff] = useState<User | null>(null);
  const [editShift, setEditShift] = useState<WorkShift | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const itemsPerPage = 10;

  const canResetPassword = (viewer: User | null, target: User) => {
    if (!viewer) return false;
    if (viewer.id === target.id) return false;
    if (viewer.role === 'owner') return target.role !== 'owner';
    if (viewer.role === 'manager') return target.role === 'staff';
    return false;
  };

  const canEditRota = user?.role === 'owner' || user?.role === 'manager';

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

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(fd);

    const newUser: User = {
      id: Date.now(),
      username: data.username as string,
      fullName: data.fullName as string,
      email: (data.email as string || '').trim() || undefined,
      password: data.password as string,
      role: data.role as Role,
      hourlyRate: parseFloat(data.hourlyRate as string) || 0
    };

    setUsers([...users, newUser]);
    setShowAddModal(false);
    addToast(t('staffAdded'));
  };

  const handleEditStaffSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaff) return;
    const canReset = canResetPassword(user, editStaff);
    if (canReset && (resetPassword || resetPasswordConfirm)) {
      if (resetPassword.length < 4) {
        addToast(t('passwordTooShort'), 'error');
        return;
      }
      if (resetPassword !== resetPasswordConfirm) {
        addToast(t('passwordsDontMatch'), 'error');
        return;
      }
    }

    const updatedUsers = users.map(u => {
      if (u.id !== editStaff.id) return u;
      const updated = { ...u, ...editStaff, password: u.password };
      if (canReset && resetPassword) {
        updated.password = resetPassword;
      }
      return updated;
    });
    setUsers(updatedUsers);
    addToast(t('staffUpdated'));
    setEditStaff(null);
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

  const filteredUsers = useMemo(() => {
    const query = staffSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter(u => {
      const nameMatch = toSearchValue(u?.fullName).includes(query);
      const usernameMatch = toSearchValue(u?.username).includes(query);
      const roleMatch = toSearchValue(u?.role).includes(query);
      const emailMatch = toSearchValue(u?.email).includes(query);
      return nameMatch || usernameMatch || roleMatch || emailMatch;
    });
  }, [users, staffSearch]);

  const paginatedUsers = useMemo(() => {
    const start = (staffPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, staffPage]);

  const totalStaffPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const filteredShifts = workShifts.filter(s => {
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
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const paginatedShifts = useMemo(() => {
    const start = (shiftPage - 1) * itemsPerPage;
    return filteredShifts.slice(start, start + itemsPerPage);
  }, [filteredShifts, shiftPage]);

  const totalShiftPages = Math.ceil(filteredShifts.length / itemsPerPage);

  useEffect(() => setStaffPage(1), [staffSearch]);
  useEffect(() => setShiftPage(1), [shiftFilter]);

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

  const updateRotaList = (next: RotaShift[]) => {
    if (rotaPreview) {
      setRotaPreview(next);
      return;
    }
    setRota(next);
  };

  const handleCellClick = (staffMember: User, dateKey: string) => {
    if (!canEditRota) return;
    const existing = findShift(staffMember.id, dateKey);
    setEditingCell({ userId: staffMember.id, date: dateKey });
    setCellStart(existing?.startTime || '09:00');
    setCellEnd(existing?.endTime || '17:00');
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

  const parseAvailability = (note: string) => {
    const lower = note.toLowerCase();
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const mentioned = days.filter(day => lower.includes(day));
    const availability = new Set<number>([0, 1, 2, 3, 4, 5, 6]);

    if (mentioned.length && lower.includes('only')) {
      availability.clear();
      mentioned.forEach(day => availability.add(days.indexOf(day)));
    }

    mentioned.forEach(day => {
      const idx = days.indexOf(day);
      const slice = lower.slice(Math.max(0, lower.indexOf(day) - 20), lower.indexOf(day) + 20);
      if (slice.includes('not') || slice.includes('unavailable')) {
        availability.delete(idx);
      }
    });

    return availability;
  };

  const generateNextWeekRota = () => {
    const baseWeekStart = startOfWeek(new Date());
    baseWeekStart.setDate(baseWeekStart.getDate() + 7);
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(baseWeekStart);
      d.setDate(baseWeekStart.getDate() + i);
      return d;
    });

    const staffPool = staffForRota;
    const assignmentCounts = new Map<number, number>();
    staffPool.forEach(s => assignmentCounts.set(s.id, 0));

    const generated: RotaShift[] = [];

    weekDates.forEach(date => {
      const dayIndex = (date.getDay() + 6) % 7;
      const needed = staffNeeded[dayIndex] || 0;
      if (needed === 0) return;

      const availableStaff = staffPool.filter(s => {
        const note = availabilityMap.get(s.id) || '';
        if (!note.trim()) return true;
        const allowedDays = parseAvailability(note);
        return allowedDays.has(dayIndex);
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
          startTime: '09:00',
          endTime: '17:00'
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
    setRota([...retained, ...rotaPreview]);
    setRotaPreview(null);
    addToast(t('rotaSaved'));
  };

  const discardPreview = () => {
    setRotaPreview(null);
  };

  return (
    <div className="space-y-10 animate-fade-in max-w-full overflow-hidden">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2 bg-bakery-beige/40 p-2 rounded-2xl">
          {[
            { id: 'staff', label: t('staffDetails') },
            { id: 'shifts', label: t('workShifts') },
            { id: 'rota', label: t('rota') }
          ].map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as 'staff' | 'shifts' | 'rota')}
              className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
                activeSection === section.id ? 'bg-bakery-brown text-white shadow-sm' : 'text-bakery-brown/60 hover:text-bakery-brown'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === 'staff' && (
        <section>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-xl font-bold font-serif">{t('staffDetails')}</h3>
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
          <div className="card-bakery overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="p-4">{t('name')}</th>
                    <th className="p-4">{t('username')}</th>
                    <th className="p-4">{t('role')}</th>
                    <th className="p-4">{t('hourlyRate')}</th>
                    <th className="p-4 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bakery-beige">
                  {paginatedUsers.map(u => (
                    <tr key={u.id} className="hover:bg-bakery-cream/30 transition-colors">
                      <td className="p-4">
                        <p className="font-bold leading-tight whitespace-nowrap">{u.fullName}</p>
                      </td>
                      <td className="p-4 text-[10px] text-bakery-brown/50 whitespace-nowrap">@{u.username}</td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                          u.role === 'owner' ? 'bg-amber-100 text-amber-700' : 
                          u.role === 'manager' ? 'bg-blue-100 text-blue-700' : 
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {t(u.role === 'staff' ? 'staffRole' : u.role)}
                        </span>
                      </td>
                      <td className="p-4 font-bold">{u.hourlyRate ? formatPrice(u.hourlyRate) : t('dash')}</td>
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
          {filteredUsers.length > itemsPerPage && (
            <Pagination 
              currentPage={staffPage}
              totalPages={totalStaffPages}
              onPageChange={setStaffPage}
              t={t}
            />
          )}
        </section>
      )}

      {activeSection === 'shifts' && (
        <section>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <h3 className="text-xl font-bold font-serif flex items-center gap-2 whitespace-nowrap">
                <Clock size={20} className="text-bakery-brown" />
                {t('workShifts')}
              </h3>
              <button 
                onClick={() => setShowAddShiftModal(true)}
                className="flex-1 md:flex-none btn-primary flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold active:scale-95"
              >
                <Plus size={16} />
                {t('logShift')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
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
            </div>
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
            <div className="card-bakery p-4 bg-bakery-beige/20">
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

          <div className="card-bakery overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="p-4">{t('staffMember')}</th>
                    <th className="p-4">{t('date')}</th>
                    <th className="p-4">{t('startTime')}</th>
                    <th className="p-4">{t('endTime')}</th>
                    <th className="p-4">{t('break')}</th>
                    <th className="p-4">{t('total')}</th>
                    <th className="p-4">{t('wageCost')}</th>
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
                            <button 
                              onClick={() => setEditShift(s)}
                              className="p-2 text-bakery-brown hover:bg-bakery-beige rounded-lg transition-colors active:scale-90"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => setShiftDeleteConfirm(s)}
                              className="p-2 text-rose-400 hover:text-rose-600 transition-colors active:scale-90"
                            >
                              <Trash2 size={18} />
                            </button>
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
          {filteredShifts.length > itemsPerPage && (
            <Pagination 
              currentPage={shiftPage}
              totalPages={totalShiftPages}
              onPageChange={setShiftPage}
              t={t}
            />
          )}
        </section>
      )}

      {activeSection === 'rota' && (
        <section className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold font-serif">{t('rota')}</h3>
              <p className="text-xs text-bakery-brown/60">{t('rotaHint')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-bakery-beige/40 p-1 rounded-2xl">
                <button
                  onClick={() => setRotaView('weekly')}
                  className={`h-9 px-4 rounded-xl text-xs font-bold ${rotaView === 'weekly' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'}`}
                >
                  {t('weekly')}
                </button>
                <button
                  onClick={() => setRotaView('monthly')}
                  className={`h-9 px-4 rounded-xl text-xs font-bold ${rotaView === 'monthly' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/60'}`}
                >
                  {t('monthly')}
                </button>
              </div>
              <button
                onClick={() => rotaView === 'weekly' ? setWeekOffset(weekOffset - 1) : setMonthOffset(monthOffset - 1)}
                className="h-9 w-9 rounded-xl bg-white border border-bakery-beige text-bakery-brown hover:bg-bakery-beige/40 flex items-center justify-center"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => rotaView === 'weekly' ? setWeekOffset(weekOffset + 1) : setMonthOffset(monthOffset + 1)}
                className="h-9 w-9 rounded-xl bg-white border border-bakery-beige text-bakery-brown hover:bg-bakery-beige/40 flex items-center justify-center"
              >
                <ChevronRight size={16} />
              </button>
              {canEditRota && (
                <button
                  onClick={generateNextWeekRota}
                  className="btn-primary flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-bold"
                >
                  <Sparkles size={16} />
                  {t('autoGenerateRota')}
                </button>
              )}
            </div>
          </div>

          <div className="card-bakery p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-bakery-brown" />
              <h4 className="font-bold">{t('availabilityExceptions')}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {staffForRota.map(staffMember => (
                <div key={staffMember.id} className="space-y-2">
                  <p className="text-xs font-bold text-bakery-brown/60">{staffMember.fullName}</p>
                  {canEditRota ? (
                    <textarea
                      className="w-full p-3 border border-bakery-beige rounded-xl outline-none focus:ring-2 focus:ring-bakery-caramel text-sm min-h-[70px]"
                      placeholder={t('availabilityPlaceholder')}
                      value={availabilityMap.get(staffMember.id) || ''}
                      onChange={e => setAvailabilityNote(staffMember.id, e.target.value)}
                    />
                  ) : (
                    <div className="p-3 bg-bakery-beige/30 rounded-xl text-sm text-bakery-brown/70 min-h-[70px]">
                      {availabilityMap.get(staffMember.id) || t('noAvailability')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {canEditRota && (
            <div className="card-bakery p-4 sm:p-6 space-y-4">
              <h4 className="text-sm font-black uppercase tracking-widest text-bakery-brown/40">{t('staffNeededPerDay')}</h4>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, idx) => (
                  <div key={label} className="space-y-2">
                    <p className="text-xs font-bold text-bakery-brown/60">{t(`day${label}`)}</p>
                    <input
                      type="number"
                      min={0}
                      className="w-full p-2 border border-bakery-beige rounded-xl text-center font-bold"
                      value={staffNeeded[idx] ?? 0}
                      onChange={e => setStaffNeeded(prev => ({ ...prev, [idx]: Math.max(0, parseInt(e.target.value) || 0) }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {rotaPreview && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <div>
                <p className="font-bold text-emerald-700">{t('previewingRota')}</p>
                <p className="text-xs text-emerald-600/70">{t('previewHint')}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={savePreviewRota} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold">
                  <Save size={16} />
                  {t('saveRota')}
                </button>
                <button onClick={discardPreview} className="px-4 py-2 rounded-xl text-xs font-bold border border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  <X size={16} className="inline mr-1" />
                  {t('discardPreview')}
                </button>
              </div>
            </div>
          )}

          <div className="card-bakery overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-bakery-beige/30 text-bakery-brown/50 uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="p-3 sticky left-0 bg-bakery-beige/30">{t('staffMember')}</th>
                    {displayDates.map(date => (
                      <th key={toDateKey(date)} className="p-3 text-center whitespace-nowrap">
                        <div className="font-black">{date.toLocaleDateString(locale, { day: '2-digit' })}</div>
                        <div className="text-[10px] text-bakery-brown/40">{date.toLocaleDateString(locale, { weekday: 'short' })}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-bakery-beige">
                  {staffForRota.map(staffMember => (
                    <tr key={staffMember.id}>
                      <td className="p-3 font-bold sticky left-0 bg-white">{staffMember.fullName}</td>
                      {displayDates.map(date => {
                        const dateKey = toDateKey(date);
                        const shift = findShift(staffMember.id, dateKey);
                        return (
                          <td key={`${staffMember.id}-${dateKey}`} className="p-2 text-center">
                            <div
                              onClick={() => handleCellClick(staffMember, dateKey)}
                              className={`relative cursor-pointer rounded-xl border px-2 py-3 text-[10px] font-bold transition-all ${
                                shift ? 'border-bakery-brown bg-bakery-beige/40 text-bakery-brown' : 'border-bakery-beige text-bakery-brown/40 hover:bg-bakery-cream/40'
                              } ${!canEditRota ? 'cursor-default' : ''}`}
                            >
                              {shift ? (
                                <div>
                                  <div>{t('scheduled')}</div>
                                  {shift.startTime && shift.endTime && (
                                    <div className="text-[9px] text-bakery-brown/60">{shift.startTime} - {shift.endTime}</div>
                                  )}
                                </div>
                              ) : (
                                <div>{t('notScheduled')}</div>
                              )}

                              {editingCell && editingCell.userId === staffMember.id && editingCell.date === dateKey && (
                                <div className="absolute z-20 left-1/2 top-full mt-2 -translate-x-1/2 w-48 bg-white border border-bakery-beige rounded-xl shadow-xl p-3 space-y-2">
                                  <div>
                                    <label className="block text-[10px] font-black uppercase text-bakery-brown/40 mb-1">{t('startTime')}</label>
                                    <input
                                      type="time"
                                      className="w-full p-2 border border-bakery-beige rounded-lg text-xs"
                                      value={cellStart}
                                      onChange={e => setCellStart(e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-black uppercase text-bakery-brown/40 mb-1">{t('endTime')}</label>
                                    <input
                                      type="time"
                                      className="w-full p-2 border border-bakery-beige rounded-lg text-xs"
                                      value={cellEnd}
                                      onChange={e => setCellEnd(e.target.value)}
                                    />
                                  </div>
                                  <div className="flex gap-2 pt-2">
                                    <button onClick={handleSaveCell} className="flex-1 bg-bakery-brown text-white rounded-lg py-2 text-[10px] font-bold">{t('save')}</button>
                                    <button onClick={handleRemoveCell} className="flex-1 border border-bakery-beige rounded-lg py-2 text-[10px] font-bold text-bakery-brown/60">{t('remove')}</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="p-6 md:p-8 bg-rose-50 rounded-3xl border border-rose-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black font-serif text-rose-700 mb-1">{t('dangerZone')}</h3>
            <p className="text-sm text-rose-600/70 max-w-md">
              {t('resetWarning')}
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowResetConfirm(true)}
          className="w-full md:w-auto bg-rose-600 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-rose-700 transition-all active:scale-95"
        >
          {t('resetData')}
        </button>
      </section>

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
              <input name="email" type="email" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel" placeholder={t('emailPlaceholder')} />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">{t('password')}</label>
              <input name="password" type="password" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">{t('role')}</label>
                <select name="role" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel">
                  <option value="staff">{t('staffRole')}</option>
                  <option value="manager">{t('manager')}</option>
                  <option value="owner">{t('owner')}</option>
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
                  <option value="owner">{t('owner')}</option>
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

      {showResetConfirm && (
        <ConfirmDialog 
          isOpen={showResetConfirm}
          title={t('resetData')} 
          message={t('resetConfirmMessage')}
          onConfirm={resetAllData}
          onClose={() => setShowResetConfirm(false)}
        />
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
