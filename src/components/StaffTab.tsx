
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Plus, Trash2, ShieldAlert, Clock, Filter, Calendar, Edit2, Search } from 'lucide-react';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { Pagination } from './Pagination';
import { User, Role, WorkShift } from '../types';

export const StaffTab = () => {
  const { users, setUsers, shiftLogs, workShifts, setWorkShifts, t, addToast, resetAllData, formatPrice, businessSettings } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [shiftDeleteConfirm, setShiftDeleteConfirm] = useState<WorkShift | null>(null);
  const [shiftFilter, setShiftFilter] = useState({ staff: 'All', from: '', to: '' });
  
  const [staffPage, setStaffPage] = useState(1);
  const [shiftPage, setShiftPage] = useState(1);
  const [staffSearch, setStaffSearch] = useState('');
  const [editStaff, setEditStaff] = useState<User | null>(null);
  const [editShift, setEditShift] = useState<WorkShift | null>(null);
  const itemsPerPage = 10;

  // Shift Form State
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
    if (diff < 0) diff += 24; // Handle overnight shifts
    
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
      password: data.password as string,
      role: data.role as Role,
      hourlyRate: parseFloat(data.hourlyRate as string) || 0
    };

    setUsers([...users, newUser]);
    setShowAddModal(false);
    addToast("Staff member added!");
  };

  const handleEditStaffSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaff) return;
    setUsers(users.map(u => u.id === editStaff.id ? editStaff : u));
    addToast("Staff member updated!");
    setEditStaff(null);
  };

  const handleEditShiftSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editShift) return;
    
    // Recalculate hours for edited shift
    const start = new Date(`${editShift.date}T${editShift.startTime}`);
    const end = new Date(`${editShift.date}T${editShift.endTime}`);
    let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diff < 0) diff += 24;
    const actualHours = parseFloat(Math.max(0, diff - (editShift.breakMinutes / 60)).toFixed(2));
    
    const updatedShift = { ...editShift, totalHours: actualHours };
    setWorkShifts(workShifts.map(s => s.id === editShift.id ? updatedShift : s));
    addToast("Shift updated!");
    setEditShift(null);
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    setUsers(users.filter(u => u.id !== deleteConfirm.id));
    addToast(`${deleteConfirm.fullName} removed`, "info");
    setDeleteConfirm(null);
  };

  const handleDeleteShift = () => {
    if (!shiftDeleteConfirm) return;
    setWorkShifts(workShifts.filter(s => s.id !== shiftDeleteConfirm.id));
    setShiftDeleteConfirm(null);
    addToast("Shift deleted", "info");
  };

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = users.find(u => u.id === parseInt(shiftFormData.userId));
    if (!targetUser) {
      addToast("Please select a staff member", "error");
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
    addToast("Shift logged successfully!");
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.fullName.toLowerCase().includes(staffSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(staffSearch.toLowerCase())
    );
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

  return (
    <div className="space-y-12 animate-fade-in max-w-full overflow-hidden">
      <section>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 className="text-xl font-bold font-serif">{t('staff')}</h3>
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
                  <th className="p-4">Name</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Hourly Rate</th>
                  <th className="p-4">Last Login</th>
                  <th className="p-4">Total Orders</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bakery-beige">
                {paginatedUsers.map(u => {
                  const userLogs = shiftLogs.filter(l => l.username === u.username);
                  const lastLog = userLogs.length ? new Date(userLogs[userLogs.length - 1].loginTime).toLocaleString() : 'Never';
                  const totalOrders = userLogs.reduce((acc, l) => acc + l.ordersProcessed, 0);
                  
                  return (
                    <tr key={u.id} className="hover:bg-bakery-cream/30 transition-colors">
                      <td className="p-4">
                        <p className="font-bold leading-tight whitespace-nowrap">{u.fullName}</p>
                        <p className="text-[10px] text-bakery-brown/50">@{u.username}</p>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                          u.role === 'owner' ? 'bg-amber-100 text-amber-700' : 
                          u.role === 'manager' ? 'bg-blue-100 text-blue-700' : 
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {t(u.role === 'staff' ? 'staffRole' : u.role)}
                        </span>
                      </td>
                      <td className="p-4 font-bold">{u.hourlyRate ? formatPrice(u.hourlyRate) : '—'}</td>
                      <td className="p-4 text-bakery-brown/60 whitespace-nowrap">{lastLog}</td>
                      <td className="p-4 font-black">{totalOrders}</td>
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
                  );
                })}
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

      <section>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <h3 className="text-xl font-bold font-serif flex items-center gap-2 whitespace-nowrap">
              <Clock size={20} className="text-bakery-brown" />
              Work Shifts
            </h3>
            <button 
              onClick={() => setShowAddShiftModal(true)}
              className="flex-1 md:flex-none btn-primary flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold active:scale-95"
            >
              <Plus size={16} />
              Log Shift
            </button>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <select 
              value={shiftFilter.staff}
              onChange={e => setShiftFilter({ ...shiftFilter, staff: e.target.value })}
              className="flex-1 md:flex-none p-2 bg-white border border-bakery-beige rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-bakery-caramel"
            >
              <option value="All">All Staff</option>
              <option value="CurrentStaff">Current Staff</option>
              <option value="FormerStaff">Former Staff</option>
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
            <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">Total Hours</p>
            <p className="text-lg md:text-xl font-black text-bakery-brown">{totalFilteredHours.toFixed(2)}h</p>
          </div>
          <div className="card-bakery p-4 bg-bakery-beige/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">Total Shifts</p>
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
                  <th className="p-4">Staff</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Start</th>
                  <th className="p-4">End</th>
                  <th className="p-4">Break</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">{t('wageCost')}</th>
                  <th className="p-4 text-right">Actions</th>
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
                      <td className="p-4 font-bold whitespace-nowrap">{wage > 0 ? formatPrice(wage) : '—'}</td>
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
                    <td colSpan={8} className="p-10 text-center text-bakery-brown/40 italic">No shifts found for these filters.</td>
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

      <section className="p-6 md:p-8 bg-rose-50 rounded-3xl border border-rose-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black font-serif text-rose-700 mb-1">Danger Zone</h3>
            <p className="text-sm text-rose-600/70 max-w-md">
              Resetting will delete all sales, stock changes, and custom staff members. This action cannot be undone.
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
              <label className="block text-sm font-bold mb-2">Full Name</label>
              <input name="fullName" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel" placeholder="e.g. John Doe" required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">{t('username')}</label>
              <input name="username" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel" placeholder="e.g. jdoe" required />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">{t('password')}</label>
              <input name="password" type="password" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2">{t('role')}</label>
                <select name="role" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel">
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="owner">Owner</option>
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
        <Modal title="Edit Staff Member" onClose={() => setEditStaff(null)}>
          <form onSubmit={handleEditStaffSave} className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2">Full Name</label>
              <input 
                className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel" 
                value={editStaff.fullName}
                onChange={e => setEditStaff({ ...editStaff, fullName: e.target.value })}
                required 
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
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="owner">Owner</option>
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
            <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold text-lg">
              {t('save')}
            </button>
          </form>
        </Modal>
      )}

      {editShift && (
        <Modal title="Edit Work Shift" onClose={() => setEditShift(null)}>
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
                <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">Wage Cost</p>
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
        <Modal title="Log Work Shift" onClose={() => setShowAddShiftModal(false)}>
          <form onSubmit={handleAddShift} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">Staff Member</label>
                <select 
                  className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                  value={shiftFormData.userId}
                  onChange={e => setShiftFormData({ ...shiftFormData, userId: e.target.value })}
                  required
                >
                  <option value="">Select Staff...</option>
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
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">Wage Cost</p>
                  <p className="text-2xl font-black text-bakery-brown">{formatPrice(calculatedWage)}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('notes')}</label>
                <textarea 
                  className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel min-h-[100px] font-medium"
                  placeholder="Optional notes about the shift..."
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
          message="This will permanently delete all your data and restore defaults. Are you absolutely sure?"
          onConfirm={resetAllData}
          onClose={() => setShowResetConfirm(false)}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog 
          isOpen={!!deleteConfirm}
          title="Delete Staff Member"
          message={`Are you sure you want to delete ${deleteConfirm.fullName}? This action cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteConfirm(null)}
        />
      )}

      {shiftDeleteConfirm && (
        <ConfirmDialog 
          isOpen={!!shiftDeleteConfirm}
          title="Delete Shift"
          message={`Are you sure you want to delete the shift for ${shiftDeleteConfirm.fullName} on ${shiftDeleteConfirm.date}?`}
          onConfirm={handleDeleteShift}
          onClose={() => setShiftDeleteConfirm(null)}
        />
      )}
    </div>
  );
};
