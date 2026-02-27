
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Plus, Trash2, ShieldAlert, Clock, Filter, Calendar } from 'lucide-react';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { User, Role, WorkShift } from '../types';

export const StaffTab = () => {
  const { users, setUsers, shiftLogs, workShifts, setWorkShifts, t, addToast, resetAllData } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [shiftDeleteConfirm, setShiftDeleteConfirm] = useState<WorkShift | null>(null);
  const [shiftFilter, setShiftFilter] = useState({ staff: 'All', from: '', to: '' });

  // Shift Form State
  const [shiftFormData, setShiftFormData] = useState({
    userId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: '30',
    notes: ''
  });

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

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(fd);

    const newUser: User = {
      id: Date.now(),
      username: data.username as string,
      fullName: data.fullName as string,
      password: data.password as string,
      role: data.role as Role
    };

    setUsers([...users, newUser]);
    setShowAddModal(false);
    addToast("Staff member added!");
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

  const filteredShifts = workShifts.filter(s => {
    const matchesStaff = shiftFilter.staff === 'All' || s.username === shiftFilter.staff;
    const matchesFrom = !shiftFilter.from || s.date >= shiftFilter.from;
    const matchesTo = !shiftFilter.to || s.date <= shiftFilter.to;
    return matchesStaff && matchesFrom && matchesTo;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalFilteredHours = filteredShifts.reduce((acc, s) => acc + s.totalHours, 0);

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
    <div className="space-y-12 animate-fade-in">
      <section>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold font-serif">{t('staff')}</h3>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={18} />
            {t('addStaff')}
          </button>
        </div>
        <div className="card-bakery overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Role</th>
                <th className="p-4">Last Login</th>
                <th className="p-4">Total Orders</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bakery-beige">
              {users.map(u => {
                const userLogs = shiftLogs.filter(l => l.username === u.username);
                const lastLog = userLogs.length ? new Date(userLogs[userLogs.length - 1].loginTime).toLocaleString() : 'Never';
                const totalOrders = userLogs.reduce((acc, l) => acc + l.ordersProcessed, 0);
                
                return (
                  <tr key={u.id} className="hover:bg-bakery-cream/30 transition-colors">
                    <td className="p-4">
                      <p className="font-bold leading-tight">{u.fullName}</p>
                      <p className="text-[10px] text-bakery-brown/50">@{u.username}</p>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        u.role === 'owner' ? 'bg-amber-100 text-amber-700' : 
                        u.role === 'manager' ? 'bg-blue-100 text-blue-700' : 
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {t(u.role === 'staff' ? 'staffRole' : u.role)}
                      </span>
                    </td>
                    <td className="p-4 text-bakery-brown/60">{lastLog}</td>
                    <td className="p-4 font-black">{totalOrders}</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setDeleteConfirm(u)} 
                        disabled={u.username === 'owner'}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-bold font-serif mb-6">{t('staffActivity')}</h3>
        <div className="card-bakery overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="p-4">Staff</th>
                <th className="p-4">Login Time</th>
                <th className="p-4">Logout Time</th>
                <th className="p-4">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bakery-beige">
              {shiftLogs.slice(-10).reverse().map(l => (
                <tr key={l.id} className="hover:bg-bakery-cream/30 transition-colors">
                  <td className="p-4">
                    <p className="font-bold leading-tight">{l.fullName}</p>
                    <p className="text-[10px] text-bakery-brown/50">@{l.username}</p>
                  </td>
                  <td className="p-4 text-bakery-brown/60">{new Date(l.loginTime).toLocaleString()}</td>
                  <td className="p-4 text-bakery-brown/60">
                    {l.logoutTime ? new Date(l.logoutTime).toLocaleString() : (
                      <span className="text-emerald-500 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        Active
                      </span>
                    )}
                  </td>
                  <td className="p-4 font-black">{l.ordersProcessed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold font-serif flex items-center gap-2">
              <Clock size={20} className="text-bakery-brown" />
              Work Shifts
            </h3>
            <button 
              onClick={() => setShowAddShiftModal(true)}
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold active:scale-95"
            >
              <Plus size={16} />
              Log Shift
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select 
              value={shiftFilter.staff}
              onChange={e => setShiftFilter({ ...shiftFilter, staff: e.target.value })}
              className="p-2 bg-white border border-bakery-beige rounded-lg text-xs font-bold"
            >
              <option value="All">All Staff</option>
              {users.map(u => <option key={u.id} value={u.username}>{u.fullName}</option>)}
            </select>
            <input 
              type="date" 
              value={shiftFilter.from}
              onChange={e => setShiftFilter({ ...shiftFilter, from: e.target.value })}
              className="p-2 bg-white border border-bakery-beige rounded-lg text-xs font-bold"
            />
            <input 
              type="date" 
              value={shiftFilter.to}
              onChange={e => setShiftFilter({ ...shiftFilter, to: e.target.value })}
              className="p-2 bg-white border border-bakery-beige rounded-lg text-xs font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card-bakery p-4 bg-bakery-beige/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">Total Hours (Filtered)</p>
            <p className="text-xl font-black text-bakery-brown">{totalFilteredHours.toFixed(2)}h</p>
          </div>
          <div className="card-bakery p-4 bg-bakery-beige/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">Total Shifts</p>
            <p className="text-xl font-black text-bakery-brown">{filteredShifts.length}</p>
          </div>
        </div>

        {hoursPerPerson.length > 0 && shiftFilter.staff === 'All' && (
          <div className="flex flex-wrap gap-4 mb-6">
            {hoursPerPerson.map(p => (
              <div key={p.name} className="px-4 py-2 bg-white border border-bakery-beige rounded-xl shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-bakery-brown text-white flex items-center justify-center text-[10px] font-bold">
                  {p.name.charAt(0)}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-bakery-brown/40 uppercase leading-none mb-1">{p.name}</p>
                  <p className="text-sm font-black text-bakery-brown">{p.hours.toFixed(2)}h</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card-bakery overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  <th className="p-4">Staff</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Start</th>
                  <th className="p-4">End</th>
                  <th className="p-4">Break</th>
                  <th className="p-4">Total</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bakery-beige">
                {filteredShifts.map(s => (
                  <tr key={s.id} className="hover:bg-bakery-cream/30 transition-colors">
                    <td className="p-4">
                      <p className="font-bold leading-tight">{s.fullName}</p>
                      <p className="text-[10px] text-bakery-brown/50">@{s.username}</p>
                    </td>
                    <td className="p-4 font-medium">{s.date}</td>
                    <td className="p-4">{s.startTime}</td>
                    <td className="p-4">{s.endTime}</td>
                    <td className="p-4 text-bakery-brown/40">{s.breakMinutes}m</td>
                    <td className="p-4 font-black text-bakery-caramel">{s.totalHours}h</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setShiftDeleteConfirm(s)}
                        className="p-2 text-rose-400 hover:text-rose-600 transition-colors active:scale-90"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredShifts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-bakery-brown/40 italic">No shifts found for these filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="p-8 bg-rose-50 rounded-3xl border border-rose-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
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
          className="bg-rose-600 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-rose-700 transition-all active:scale-95"
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
            <div>
              <label className="block text-sm font-bold mb-2">{t('role')}</label>
              <select name="role" className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel">
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <button type="submit" className="btn-primary w-full p-4 rounded-2xl font-bold text-lg">
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
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">Calculated Hours</p>
                  <p className="text-2xl font-black text-bakery-brown">{calculatedHours}h</p>
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
          title={t('resetData')} 
          message="This will permanently delete all your data and restore defaults. Are you absolutely sure?"
          requireReset
          onConfirm={resetAllData}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog 
          title="Delete Staff Member"
          message={`Are you sure you want to delete ${deleteConfirm.fullName}? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {shiftDeleteConfirm && (
        <ConfirmDialog 
          title="Delete Shift"
          message={`Are you sure you want to delete the shift for ${shiftDeleteConfirm.fullName} on ${shiftDeleteConfirm.date}?`}
          onConfirm={handleDeleteShift}
          onCancel={() => setShiftDeleteConfirm(null)}
        />
      )}
    </div>
  );
};