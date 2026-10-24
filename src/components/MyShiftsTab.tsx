import { LeaveRequests } from './LeaveRequests';
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { ChevronLeft, ChevronRight, Clock, Plus, Umbrella, Wallet } from 'lucide-react';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { WorkShift } from '../types';

type CalendarMode = 'week' | 'month';
type DayModalMode = 'worked' | 'leave' | null;

const toDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseDateKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const startOfWeekMonday = (d: Date) => {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
};

const addDays = (d: Date, n: number) => {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + n);
  return copy;
};

const calcHours = (date: string, startTime: string, endTime: string, breakMinutes: number) => {
  if (!date || !startTime || !endTime) return 0;
  const start = new Date(`${date}T${startTime}`);
  const end = new Date(`${date}T${endTime}`);
  let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (diff < 0) diff += 24;
  return parseFloat(Math.max(0, diff - (breakMinutes || 0) / 60).toFixed(2));
};

const leaveLabelKey = (reason?: WorkShift['leaveReason']) => {
  if (reason === 'sick') return 'leaveSick';
  if (reason === 'holiday') return 'leaveHoliday';
  if (reason === 'personal') return 'leavePersonal';
  return 'leaveOther';
};

export const MyShiftsTab = () => {
  const { user, workShifts, setWorkShifts, t, addToast, formatPrice } = useApp();
  const readOnly = user?.role === 'staff';
  const hourlyRate = user?.hourlyRate ?? 0;

  const [mode, setMode] = useState<CalendarMode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayModal, setDayModal] = useState<DayModalMode>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<WorkShift | null>(null);

  const [formData, setFormData] = useState({
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: '30',
    payAmount: '',
    notes: '',
    leaveReason: 'sick' as NonNullable<WorkShift['leaveReason']>,
  });

  const myShifts = useMemo(
    () => workShifts.filter(s => s.userId === user?.id),
    [workShifts, user?.id]
  );

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, WorkShift[]>();
    myShifts.forEach(s => {
      const list = map.get(s.date) || [];
      list.push(s);
      map.set(s.date, list);
    });
    return map;
  }, [myShifts]);

  const weekStart = useMemo(() => startOfWeekMonday(anchor), [anchor]);
  const monthStart = useMemo(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1), [anchor]);

  const visibleDays = useMemo(() => {
    if (mode === 'week') {
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }
    const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
    const gridStart = startOfWeekMonday(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [mode, weekStart, monthStart]);

  const periodShifts = useMemo(() => {
    const keys = new Set(visibleDays.map(toDateKey));
    if (mode === 'month') {
      // Only count days in the displayed month for totals
      return myShifts.filter(s => {
        const d = parseDateKey(s.date);
        return d.getMonth() === anchor.getMonth() && d.getFullYear() === anchor.getFullYear();
      });
    }
    return myShifts.filter(s => keys.has(s.date));
  }, [myShifts, visibleDays, mode, anchor]);

  const totalHours = periodShifts
    .filter(s => (s.kind || 'worked') === 'worked')
    .reduce((a, s) => a + (s.totalHours || 0), 0);
  const totalPay = periodShifts
    .filter(s => (s.kind || 'worked') === 'worked')
    .reduce((a, s) => a + (s.payAmount ?? (s.totalHours || 0) * hourlyRate), 0);
  const leaveDays = periodShifts.filter(s => s.kind === 'leave').length;

  const calculatedHours = useMemo(() => {
    if (!selectedDate) return 0;
    return calcHours(
      selectedDate,
      formData.startTime,
      formData.endTime,
      parseInt(formData.breakMinutes) || 0
    );
  }, [selectedDate, formData]);

  const suggestedPay = useMemo(
    () => parseFloat((calculatedHours * hourlyRate).toFixed(2)),
    [calculatedHours, hourlyRate]
  );

  const openDay = (date: Date) => {
    const key = toDateKey(date);
    setSelectedDate(key);
    if (readOnly) { setDayModal('worked'); return; }
    const existing = (shiftsByDate.get(key) || []).find(s => (s.kind || 'worked') === 'worked');
    const leave = (shiftsByDate.get(key) || []).find(s => s.kind === 'leave');
    if (existing) {
      setFormData({
        startTime: existing.startTime || '09:00',
        endTime: existing.endTime || '17:00',
        breakMinutes: String(existing.breakMinutes ?? 30),
        payAmount: existing.payAmount != null ? String(existing.payAmount) : '',
        notes: existing.notes || '',
        leaveReason: leave?.leaveReason || 'sick',
      });
      setDayModal('worked');
    } else if (leave) {
      setFormData(prev => ({
        ...prev,
        notes: leave.notes || '',
        leaveReason: leave.leaveReason || 'sick',
        payAmount: '',
      }));
      setDayModal('leave');
    } else {
      setFormData({
        startTime: '09:00',
        endTime: '17:00',
        breakMinutes: '30',
        payAmount: '',
        notes: '',
        leaveReason: 'sick',
      });
      setDayModal('worked');
    }
  };

  const existingForSelected = useMemo(() => {
    if (!selectedDate) return { worked: null as WorkShift | null, leave: null as WorkShift | null };
    const list = shiftsByDate.get(selectedDate) || [];
    return {
      worked: list.find(s => (s.kind || 'worked') === 'worked') || null,
      leave: list.find(s => s.kind === 'leave') || null,
    };
  }, [selectedDate, shiftsByDate]);

  const saveWorked = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDate || readOnly) return;
    const hours = calculatedHours;
    const pay =
      formData.payAmount.trim() === ''
        ? suggestedPay
        : Math.max(0, parseFloat(formData.payAmount) || 0);

    const payload: WorkShift = {
      id: existingForSelected.worked?.id || `SHIFT-${Date.now()}`,
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      date: selectedDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
      breakMinutes: parseInt(formData.breakMinutes) || 0,
      totalHours: hours,
      notes: formData.notes,
      payAmount: pay,
      kind: 'worked',
    };

    if (existingForSelected.leave) { addToast('Approved leave already exists on this day. Ask your manager to review it.', 'error'); return; }
    // Keep approved leave unchanged.
    let next = workShifts.filter(
      s => !(s.userId === user.id && s.date === selectedDate && s.kind === 'leave')
    );
    if (existingForSelected.worked) {
      next = next.map(s => (s.id === existingForSelected.worked!.id ? payload : s));
    } else {
      next = [...next, payload];
    }
    if (!await setWorkShifts(next)) return;
    setDayModal(null);
    setSelectedDate(null);
    addToast(t('shiftLogged'));
  };

  const handleDelete = async () => {
    if (!deleteConfirm || readOnly) return;
    if (deleteConfirm.kind === 'leave' && user?.role === 'staff') { addToast('Ask your manager to change approved leave.', 'error'); return false; }
    if (!await setWorkShifts(workShifts.filter(s => s.id !== deleteConfirm.id))) return;
    setDeleteConfirm(null);
    setDayModal(null);
    setSelectedDate(null);
    addToast(t('shiftDeleted'), 'info');
  };

  const periodLabel =
    mode === 'week'
      ? `${toDateKey(weekStart)} → ${toDateKey(addDays(weekStart, 6))}`
      : anchor.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const weekdayLabels = [
    t('dayMon') || 'Mon',
    t('dayTue') || 'Tue',
    t('dayWed') || 'Wed',
    t('dayThu') || 'Thu',
    t('dayFri') || 'Fri',
    t('daySat') || 'Sat',
    t('daySun') || 'Sun',
  ];

  const renderDayCell = (date: Date) => {
    const key = toDateKey(date);
    const entries = shiftsByDate.get(key) || [];
    const worked = entries.filter(s => (s.kind || 'worked') === 'worked');
    const leave = entries.find(s => s.kind === 'leave');
    const hours = worked.reduce((a, s) => a + (s.totalHours || 0), 0);
    const pay = worked.reduce(
      (a, s) => a + (s.payAmount ?? (s.totalHours || 0) * hourlyRate),
      0
    );
    const inMonth = date.getMonth() === anchor.getMonth();
    const isToday = key === toDateKey(new Date());

    return (
      <button
        key={key}
        type="button"
        onClick={() => openDay(date)}
        className={`min-h-[92px] sm:min-h-[110px] rounded-2xl border p-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
          leave
            ? 'border-amber-200 bg-amber-50/80'
            : worked.length
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-bakery-beige bg-white'
        } ${mode === 'month' && !inMonth ? 'opacity-35' : ''} ${
          isToday ? 'ring-2 ring-bakery-caramel/50' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <span className="text-sm font-black text-bakery-brown">{date.getDate()}</span>
          {leave && <Umbrella size={14} className="text-amber-600 shrink-0" />}
        </div>
        {leave ? (
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">
              {t(leaveLabelKey(leave.leaveReason))}
            </p>
            <p className="text-[11px] text-bakery-brown/50 line-clamp-2">{leave.notes || t('unavailable')}</p>
          </div>
        ) : worked.length > 0 ? (
          <div className="space-y-0.5">
            <p className="text-[11px] font-bold text-emerald-800">{hours.toFixed(2)}h</p>
            <p className="text-[11px] font-black text-bakery-caramel">{formatPrice(pay)}</p>
            {worked[0].startTime && worked[0].endTime && (
              <p className="text-[10px] text-bakery-brown/45">
                {worked[0].startTime}–{worked[0].endTime}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-bakery-brown/30 font-semibold mt-2">{t('dayOff') || 'Off'}</p>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in pb-8 max-w-full overflow-hidden">
      <details className="card-bakery overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-bakery-brown">{t('timeOffTab')}</summary>
        <div className="p-3 pt-0"><LeaveRequests formOnly /></div>
      </details>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold font-serif text-bakery-brown">{t('myShifts')}</h2>
          <p className="text-xs text-bakery-brown/45 mt-1">
            View your shifts and request time off for manager approval.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-bakery-beige bg-white p-1">
            <button
              type="button"
              onClick={() => setMode('week')}
              className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wide ${
                mode === 'week' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/50'
              }`}
            >
              {t('weekView') || 'Week'}
            </button>
            <button
              type="button"
              onClick={() => setMode('month')}
              className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wide ${
                mode === 'month' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/50'
              }`}
            >
              {t('monthView') || 'Month'}
            </button>
          </div>
          <div className="inline-flex items-center gap-1 rounded-xl border border-bakery-beige bg-white px-1">
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-bakery-beige/50"
              onClick={() =>
                setAnchor(prev =>
                  mode === 'week'
                    ? addDays(prev, -7)
                    : new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                )
              }
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-2 text-xs font-bold text-bakery-brown min-w-[140px] text-center">
              {periodLabel}
            </span>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-bakery-beige/50"
              onClick={() =>
                setAnchor(prev =>
                  mode === 'week'
                    ? addDays(prev, 7)
                    : new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                )
              }
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {!readOnly && <button
            type="button"
            onClick={() => openDay(new Date())}
            className="btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold active:scale-95 text-sm"
          >
            <Plus size={16} />
            {t('logToday') || 'Log today'}
          </button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="card-bakery p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-bakery-beige flex items-center justify-center text-bakery-brown shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('totalHours')}</p>
            <p className="text-xl font-black text-bakery-brown">{totalHours.toFixed(2)}h</p>
          </div>
        </div>
        <div className="card-bakery p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-bakery-beige flex items-center justify-center text-bakery-brown shrink-0">
            <Wallet size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('pay') || 'Pay'}</p>
            <p className="text-xl font-black text-bakery-caramel">{formatPrice(totalPay)}</p>
          </div>
        </div>
        <div className="card-bakery p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-bakery-beige flex items-center justify-center text-bakery-brown shrink-0">
            <Umbrella size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40">{t('leaveDays') || 'Leave days'}</p>
            <p className="text-xl font-black text-bakery-brown">{leaveDays}</p>
          </div>
        </div>
      </div>

      {!readOnly && hourlyRate <= 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          {t('hourlyRateMissingHint') ||
            'No hourly rate set on your profile yet — enter pay manually when logging a shift.'}
        </p>
      )}

      <div className="card-bakery p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
          {weekdayLabels.map(label => (
            <div
              key={label}
              className="text-center text-[10px] font-black uppercase tracking-widest text-bakery-brown/35 py-1"
            >
              {label}
            </div>
          ))}
        </div>
        <div className={`grid grid-cols-7 gap-1.5 sm:gap-2 ${mode === 'week' ? '' : ''}`}>
          {visibleDays.map(renderDayCell)}
        </div>
      </div>

      <LeaveRequests historyOnly />
      {readOnly && dayModal && selectedDate && <Modal title="Shift details" onClose={()=>{setDayModal(null);setSelectedDate(null);}}>
        <div className="space-y-3 text-bakery-brown"><p className="font-bold">{selectedDate}</p>
          {(shiftsByDate.get(selectedDate)||[]).map(s=><div key={s.id} className="card-bakery p-4">
            <p className="font-bold">{s.kind==='leave' ? t(leaveLabelKey(s.leaveReason)) : `${s.startTime}–${s.endTime}`}</p>
            {s.kind!=='leave' && <p>{s.totalHours}h</p>}{s.notes && <p className="text-sm mt-2">{s.notes}</p>}
          </div>)}
          {!(shiftsByDate.get(selectedDate)||[]).length && <p>No shift recorded for this day.</p>}
        </div>
      </Modal>}
      {!readOnly && dayModal && selectedDate && (
        <Modal
          title={
            dayModal === 'leave'
              ? 'Request time off'
              : t('logShift') || t('addShift')
          }
          onClose={() => {
            setDayModal(null);
            setSelectedDate(null);
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-bakery-brown">{selectedDate}</p>
              <div className="inline-flex rounded-xl border border-bakery-beige p-1 bg-bakery-cream/40">
                <button
                  type="button"
                  onClick={() => setDayModal('worked')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase ${
                    dayModal === 'worked' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/50'
                  }`}
                >
                  {t('worked') || 'Worked'}
                </button>
                <button
                  type="button"
                  onClick={() => setDayModal('leave')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase ${
                    dayModal === 'leave' ? 'bg-bakery-brown text-white' : 'text-bakery-brown/50'
                  }`}
                >
                  Request time off
                </button>
              </div>
            </div>

            {dayModal === 'worked' ? (
              <form onSubmit={saveWorked} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                      {t('startTime')}
                    </label>
                    <input
                      type="time"
                      className="w-full p-3 border border-bakery-beige rounded-2xl font-bold outline-none focus:ring-2 focus:ring-bakery-caramel"
                      value={formData.startTime}
                      onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                      {t('endTime')}
                    </label>
                    <input
                      type="time"
                      className="w-full p-3 border border-bakery-beige rounded-2xl font-bold outline-none focus:ring-2 focus:ring-bakery-caramel"
                      value={formData.endTime}
                      onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                      {t('break')} (min)
                    </label>
                    <input
                      type="number"
                      className="w-full p-3 border border-bakery-beige rounded-2xl font-bold outline-none focus:ring-2 focus:ring-bakery-caramel"
                      value={formData.breakMinutes}
                      onChange={e => setFormData({ ...formData, breakMinutes: e.target.value })}
                      required
                    />
                  </div>
                  <div className="bg-bakery-accent/20 p-3 rounded-2xl border border-bakery-accent/30 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 mb-1">
                      {t('calculatedHours')}
                    </p>
                    <p className="text-2xl font-black text-bakery-brown">{calculatedHours}h</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                    {t('pay') || 'Pay'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full p-3 border border-bakery-beige rounded-2xl font-bold outline-none focus:ring-2 focus:ring-bakery-caramel"
                    placeholder={
                      hourlyRate > 0
                        ? `${t('suggested') || 'Suggested'}: ${suggestedPay.toFixed(2)}`
                        : t('enterPay') || 'Enter amount'
                    }
                    value={formData.payAmount}
                    onChange={e => setFormData({ ...formData, payAmount: e.target.value })}
                  />
                  {hourlyRate > 0 && (
                    <p className="mt-1 text-[11px] text-bakery-brown/45">
                      {(t('payFromRateHint') || 'Based on {rate}/h × hours — leave blank to use this.').replace(
                        '{rate}',
                        String(hourlyRate)
                      )}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-bakery-brown/40 mb-2">
                    {t('notes')}
                  </label>
                  <textarea
                    className="w-full p-3 border border-bakery-beige rounded-2xl outline-none focus:ring-2 focus:ring-bakery-caramel min-h-[80px]"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t('optionalShiftNotes')}
                  />
                </div>

                <div className="flex gap-2">
                  {(existingForSelected.worked || existingForSelected.leave) && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm(existingForSelected.worked || existingForSelected.leave)
                      }
                      className="flex-1 py-3 rounded-2xl border border-rose-200 text-rose-600 font-bold"
                    >
                      {t('delete')}
                    </button>
                  )}
                  <button type="submit" className="flex-[2] btn-primary py-3 rounded-2xl font-bold">
                    {t('save')}
                  </button>
                </div>
              </form>
            ) : (
              <LeaveRequests initialDate={selectedDate || ''} />
            )}
          </div>
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
