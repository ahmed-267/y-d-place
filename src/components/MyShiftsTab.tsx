import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Clock, Plus, Trash2, Calendar } from 'lucide-react';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { WorkShift } from '../types';
import { SortableTh, useColumnSort, sortByColumn } from '../utils/tableSort';

export const MyShiftsTab = () => {
  const { user, workShifts, setWorkShifts, t, addToast } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<WorkShift | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: '30',
    notes: '',
  });

  type MyShiftSort = 'date' | 'start' | 'end' | 'break' | 'total' | 'notes';
  const { sortKey, sortDirection, toggleSort } = useColumnSort<MyShiftSort>('date', 'desc');

  const calculatedHours = useMemo(() => {
    const { date, startTime, endTime, breakMinutes } = formData;
    if (!date || !startTime || !endTime) return 0;

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    const brk = parseInt(breakMinutes) || 0;

    let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diff < 0) diff += 24;

    const actualHours = Math.max(0, diff - brk / 60);
    return parseFloat(actualHours.toFixed(2));
  }, [formData]);

  const myShifts = useMemo(() => {
    const list = workShifts.filter(s => s.userId === user?.id);
    return sortByColumn(list, sortKey, sortDirection, (s: WorkShift, key) => {
      if (key === 'date') return s.date;
      if (key === 'start') return s.startTime;
      if (key === 'end') return s.endTime;
      if (key === 'break') return s.breakMinutes ?? 0;
      if (key === 'total') return s.totalHours;
      return s.notes || '';
    });
  }, [workShifts, user?.id, sortKey, sortDirection]);

  const totalHours = myShifts.reduce((acc, s) => acc + s.totalHours, 0);

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const newShift: WorkShift = {
      id: `SHIFT-${Date.now()}`,
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      breakMinutes: parseInt(formData.breakMinutes) || 0,
      totalHours: calculatedHours,
      notes: formData.notes,
    };

    setWorkShifts([...workShifts, newShift]);
    setShowAddModal(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '17:00',
      breakMinutes: '30',
      notes: '',
    });
    addToast(t('shiftLogged'));
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    setWorkShifts(workShifts.filter(s => s.id !== deleteConfirm.id));
    setDeleteConfirm(null);
    addToast(t('shiftDeleted'), 'info');
  };

  return (
    <div className="space-y-5 animate-fade-in pb-8 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold font-serif text-bakery-brown">{t('myShifts')}</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold active:scale-95 text-sm"
        >
          <Plus size={18} />
          {t('addShift')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card-bakery p-4 sm:p-6 flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-bakery-beige flex items-center justify-center text-bakery-brown shrink-0">
            <Clock size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('totalHours')}</p>
            <p className="text-xl sm:text-2xl font-black text-bakery-brown">{totalHours.toFixed(2)}h</p>
          </div>
        </div>
        <div className="card-bakery p-4 sm:p-6 flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-bakery-beige flex items-center justify-center text-bakery-brown shrink-0">
            <Calendar size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('shifts')}</p>
            <p className="text-xl sm:text-2xl font-black text-bakery-brown">{myShifts.length}</p>
          </div>
        </div>
      </div>

      <div className="card-bakery overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-bakery-beige/30 text-bakery-brown/40 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <SortableTh label={t('date')} column="date" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('startTime')} column="start" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('endTime')} column="end" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('break')} column="break" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('totalHours')} column="total" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <SortableTh label={t('notes')} column="notes" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                <th className="p-4 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bakery-beige">
              {myShifts.map(s => (
                <tr key={s.id} className="hover:bg-bakery-cream/30 transition-colors">
                  <td className="p-4 font-bold whitespace-nowrap">{s.date}</td>
                  <td className="p-4 whitespace-nowrap">{s.startTime}</td>
                  <td className="p-4 whitespace-nowrap">{s.endTime}</td>
                  <td className="p-4 text-bakery-brown/40 whitespace-nowrap">{s.breakMinutes}m</td>
                  <td className="p-4 font-black text-bakery-caramel whitespace-nowrap">{s.totalHours}h</td>
                  <td className="p-4 text-xs max-w-[200px] truncate" title={s.notes}>
                    {s.notes || t('dash')}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setDeleteConfirm(s)}
                      className="p-2 text-rose-400 hover:text-rose-600 transition-colors active:scale-90"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {myShifts.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-bakery-brown/40 italic">
                    {t('noShiftsLogged')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <Modal title={t('addShift')} onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddShift} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('date')}</label>
                <input
                  type="date"
                  className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('startTime')}</label>
                  <input
                    type="time"
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                    value={formData.startTime}
                    onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('endTime')}</label>
                  <input
                    type="time"
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                    value={formData.endTime}
                    onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                    {t('break')} (min)
                  </label>
                  <input
                    type="number"
                    className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel font-bold"
                    value={formData.breakMinutes}
                    onChange={e => setFormData({ ...formData, breakMinutes: e.target.value })}
                    required
                  />
                </div>
                <div className="bg-bakery-accent/20 p-4 rounded-2xl border border-bakery-accent/30 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">{t('calculatedHours')}</p>
                  <p className="text-2xl font-black text-bakery-brown">{calculatedHours}h</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">{t('notes')}</label>
                <textarea
                  className="w-full p-4 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel min-h-[100px] font-medium"
                  placeholder={t('optionalShiftNotes')}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
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
          title={t('deleteShift')}
          message={t('deleteShiftConfirm').replace('{date}', deleteConfirm.date)}
          onConfirm={handleDelete}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};
