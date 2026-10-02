import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { FloorSection, FloorTable, Order, normalizeFloorPlan } from '../types';
import {
  averageTableTurnMinutes,
  openOrderForTable,
  resolveTableLiveStatus,
  tableStatusLabelKey,
} from '../utils/tableStatus';
import { Plus, Pencil, Check, Trash2, UtensilsCrossed, Maximize2, Minimize2 } from 'lucide-react';

const orderOpenTotal = (order: Order) =>
  Math.max(0, (order.subtotal || 0) - (order.discountAmount || 0) + (order.tipAmount || 0));

const statusStyles: Record<string, string> = {
  free: 'bg-white border-bakery-brown/30 text-bakery-brown',
  seated: 'bg-sky-100 border-sky-500 text-sky-950',
  ordered: 'bg-amber-100 border-amber-500 text-amber-950',
  bill: 'bg-violet-100 border-violet-500 text-violet-950',
  dirty: 'bg-stone-200 border-stone-500 text-stone-900',
};

export const TablesTab = () => {
  const {
    floorPlan,
    setFloorPlan,
    orders,
    setPendingTableSession,
    setActiveTab,
    user,
    users,
    t,
    formatPrice,
    addToast,
  } = useApp();

  const plan = normalizeFloorPlan(floorPlan);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | 'all'>('all');
  const [sectionDraft, setSectionDraft] = useState('');
  const canEdit = user?.role === 'owner' || user?.role === 'manager';
  const staffUsers = users.filter(u => u.role === 'staff' || u.role === 'manager' || u.role === 'owner');

  const turnMins = useMemo(() => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return averageTableTurnMinutes(orders, dayStart.getTime(), Date.now());
  }, [orders]);

  useEffect(() => {
    if (!plan.useSections) {
      setActiveSectionId('all');
      return;
    }
    if (activeSectionId !== 'all' && !plan.sections.some(s => s.id === activeSectionId)) {
      setActiveSectionId(plan.sections[0]?.id || 'all');
    }
  }, [plan.useSections, plan.sections, activeSectionId]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const tables = useMemo(() => {
    if (!plan.useSections || activeSectionId === 'all') return plan.tables;
    return plan.tables.filter(tb => tb.sectionId === activeSectionId);
  }, [plan.tables, plan.useSections, activeSectionId]);

  const canvasMetrics = useMemo(() => {
    const maxBottom = tables.reduce((m, t) => Math.max(m, (t.y || 0) + Math.max(t.h || 18, 12)), 40);
    const maxRight = tables.reduce((m, t) => Math.max(m, (t.x || 0) + Math.max(t.w || 18, 12)), 40);
    const unitH = fullscreen ? Math.max(560, (typeof window !== 'undefined' ? window.innerHeight : 800) - 110) : 560;
    const height = Math.max(unitH, (maxBottom / 100) * unitH + 64);
    return {
      height,
      widthPct: Math.max(100, maxRight + 10),
      maxY: Math.max(0, 100 - 12),
      maxX: Math.max(0, 100 - 12),
    };
  }, [tables, fullscreen]);

  const patchPlan = (updater: (prev: ReturnType<typeof normalizeFloorPlan>) => ReturnType<typeof normalizeFloorPlan>) => {
    setFloorPlan(prev => updater(normalizeFloorPlan(prev)));
  };

  const updateTable = (id: string, patch: Partial<FloorTable>) => {
    patchPlan(prev => ({
      ...prev,
      tables: prev.tables.map(tb => (tb.id === id ? { ...tb, ...patch } : tb)),
    }));
  };

  const addTable = () => {
    const n = plan.tables.length + 1;
    const sectionId =
      plan.useSections && activeSectionId !== 'all'
        ? activeSectionId
        : plan.useSections
          ? plan.sections[0]?.id
          : undefined;
    const table: FloorTable = {
      id: `T-${Date.now()}`,
      label: String(n),
      seats: 4,
      x: 10 + (plan.tables.length % 4) * 22,
      y: 10 + Math.floor(plan.tables.length / 4) * 28,
      w: 18,
      h: 18,
      shape: 'square',
      sectionId,
    };
    patchPlan(prev => ({ ...prev, tables: [...prev.tables, table] }));
  };

  const removeTable = (id: string) => {
    if (openOrderForTable(orders, id)) {
      addToast(t('tableOccupied'), 'error');
      return;
    }
    patchPlan(prev => ({ ...prev, tables: prev.tables.filter(tb => tb.id !== id) }));
  };

  const setUseSections = (enabled: boolean) => {
    patchPlan(prev => {
      if (!enabled) {
        return {
          ...prev,
          useSections: false,
          tables: prev.tables.map(tb => ({ ...tb, sectionId: undefined })),
        };
      }
      const sections =
        prev.sections.length > 0
          ? prev.sections
          : [
              { id: `S-${Date.now()}`, name: 'Indoors' },
              { id: `S-${Date.now() + 1}`, name: 'Outdoors' },
            ];
      const defaultId = sections[0]?.id;
      return {
        ...prev,
        useSections: true,
        sections,
        tables: prev.tables.map(tb => ({ ...tb, sectionId: tb.sectionId || defaultId })),
      };
    });
    if (enabled) setActiveSectionId('all');
  };

  const addSection = () => {
    const name = sectionDraft.trim() || `${t('sectionName')} ${plan.sections.length + 1}`;
    const section: FloorSection = { id: `S-${Date.now()}`, name };
    patchPlan(prev => ({ ...prev, sections: [...prev.sections, section], useSections: true }));
    setSectionDraft('');
    setActiveSectionId(section.id);
  };

  const renameSection = (id: string, name: string) => {
    patchPlan(prev => ({
      ...prev,
      sections: prev.sections.map(s => (s.id === id ? { ...s, name } : s)),
    }));
  };

  const removeSection = (id: string) => {
    patchPlan(prev => {
      const sections = prev.sections.filter(s => s.id !== id);
      const fallback = sections[0]?.id;
      return {
        ...prev,
        sections,
        useSections: sections.length > 0 ? prev.useSections : false,
        tables: prev.tables.map(tb =>
          tb.sectionId === id ? { ...tb, sectionId: fallback } : tb
        ),
      };
    });
  };

  const openFreeTable = (table: FloorTable) => {
    updateTable(table.id, {
      dirty: false,
      seatedAt: Date.now(),
      serverUsername: table.serverUsername || user?.username,
    });
    setPendingTableSession({
      tableId: table.id,
      tableLabel: table.label,
      covers: Math.max(1, table.seats || 2),
    });
    setActiveTab('cashier');
  };

  const resumeTable = (table: FloorTable, order: Order) => {
    setPendingTableSession({
      tableId: table.id,
      tableLabel: table.label,
      covers: order.covers,
      resumeOrderId: order.id,
    });
    setActiveTab('cashier');
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editing || !dragId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(canvasMetrics.maxX, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100 - 9));
    const y = Math.min(canvasMetrics.maxY, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100 - 9));
    updateTable(dragId, { x, y });
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {turnMins != null && (
        <span className="h-10 px-3 rounded-xl border-2 border-bakery-brown/10 bg-white text-xs font-bold text-bakery-brown inline-flex items-center">
          {t('avgTurnTime')}: {turnMins} {t('minutesShort')}
        </span>
      )}
      <button
        type="button"
        onClick={() => setFullscreen(f => !f)}
        className="h-10 px-3.5 rounded-xl border-2 border-bakery-brown/20 bg-white text-bakery-brown text-xs font-black uppercase tracking-wide inline-flex items-center gap-2 hover:border-bakery-caramel"
      >
        {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        {fullscreen ? t('exitFullscreenFloor') : t('fullscreenFloor')}
      </button>
      {canEdit && (
        <>
          {editing && (
            <button
              type="button"
              onClick={addTable}
              className="h-10 px-3.5 rounded-xl bg-bakery-beige text-bakery-brown text-xs font-black uppercase tracking-wide inline-flex items-center gap-2 border border-bakery-brown/10"
            >
              <Plus size={15} />
              {t('addTable')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing(e => !e);
              setDragId(null);
            }}
            className={`h-10 px-3.5 rounded-xl text-xs font-black uppercase tracking-wide inline-flex items-center gap-2 ${
              editing
                ? 'bg-bakery-brown text-white'
                : 'border-2 border-bakery-brown/25 bg-white text-bakery-brown hover:border-bakery-caramel'
            }`}
          >
            {editing ? <Check size={15} /> : <Pencil size={15} />}
            {editing ? t('doneEditingFloor') : t('editFloor')}
          </button>
        </>
      )}
    </div>
  );

  const floorMap = (
    <div
      className={`w-full rounded-2xl border-2 border-bakery-brown/15 bg-[var(--app-card-bg)] overflow-auto shadow-sm ${
        fullscreen ? 'flex-1 min-h-0' : 'min-h-[460px] h-[min(72vh,680px)]'
      }`}
    >
      <div
        className="relative touch-none"
        style={{
          height: canvasMetrics.height,
          width: `${canvasMetrics.widthPct}%`,
          minWidth: '100%',
        }}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragId(null)}
        onPointerLeave={() => setDragId(null)}
      >
        <div className="absolute inset-0 opacity-[0.35] pointer-events-none" style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in srgb, var(--color-bakery-brown) 12%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-bakery-brown) 12%, transparent) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        {tables.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 p-6">
            <UtensilsCrossed className="text-bakery-brown/25" size={40} />
            <p className="text-sm text-bakery-brown/50 max-w-sm">{t('floorEmpty')}</p>
          </div>
        )}
        {tables.map(table => {
          const open = openOrderForTable(orders, table.id);
          const status = resolveTableLiveStatus(table, orders);
          return (
            <div
              key={table.id}
              className={`absolute flex flex-col items-center justify-center select-none border-2 shadow-md transition-colors ${
                table.shape === 'round' ? 'rounded-full' : 'rounded-2xl'
              } ${statusStyles[status] || statusStyles.free} ${
                editing ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer hover:shadow-lg'
              }`}
              style={{
                left: `${table.x}%`,
                top: `${table.y}%`,
                width: `${table.w}%`,
                height: `${table.h}%`,
                minWidth: 88,
                minHeight: 88,
              }}
              onPointerDown={e => {
                if (!editing) return;
                if ((e.target as HTMLElement).closest('[data-table-control]')) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragId(table.id);
              }}
              onClick={() => {
                if (editing) return;
                if (status === 'dirty') {
                  updateTable(table.id, { dirty: false, seatedAt: undefined });
                  return;
                }
                if (open) {
                  resumeTable(table, open);
                } else {
                  openFreeTable(table);
                }
              }}
            >
              {editing && (
                <button
                  type="button"
                  data-table-control
                  className="absolute top-1 right-1 z-20 p-1.5 rounded-full bg-rose-500 text-white shadow-sm hover:bg-rose-600"
                  onPointerDown={e => {
                    e.stopPropagation();
                    setDragId(null);
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    e.preventDefault();
                    removeTable(table.id);
                  }}
                  title={t('deleteTable')}
                  aria-label={t('deleteTable')}
                >
                  <Trash2 size={12} />
                </button>
              )}
              {editing ? (
                <input
                  data-table-control
                  className="w-[70%] text-center text-sm font-black bg-transparent outline-none border-b border-bakery-beige"
                  value={table.label}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateTable(table.id, { label: e.target.value })}
                />
              ) : (
                <p className="text-base font-black leading-none">{table.label}</p>
              )}
              <p className="text-[10px] font-bold opacity-60 mt-1">
                {table.seats} {t('seatsShort')}
              </p>
              <p className="text-[9px] font-black uppercase tracking-wider mt-1">
                {t(tableStatusLabelKey(status))}
              </p>
              {table.serverUsername && (
                <p className="text-[9px] font-bold opacity-70 truncate max-w-[90%]">{table.serverUsername}</p>
              )}
              {open && (
                <p className="text-[10px] font-bold mt-0.5">{formatPrice(orderOpenTotal(open))}</p>
              )}
              {editing && (
                <select
                  data-table-control
                  className="mt-1 w-[85%] text-[9px] font-bold bg-white/90 rounded border border-bakery-beige"
                  value={table.serverUsername || ''}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateTable(table.id, { serverUsername: e.target.value || undefined })}
                >
                  <option value="">{t('assignServer')}</option>
                  {staffUsers.map(u => (
                    <option key={u.username} value={u.username}>{u.fullName || u.username}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const body = (
    <div className={`space-y-4 animate-fade-in max-w-full ${fullscreen ? 'h-full flex flex-col pb-0' : 'pb-8'}`}>
      <div className={`flex flex-col gap-3 ${fullscreen ? 'shrink-0' : 'sm:flex-row sm:items-start sm:justify-between'}`}>
        <div>
          <h2 className="text-lg font-bold font-serif text-bakery-brown">{t('tablesTab')}</h2>
          <p className="text-xs text-bakery-brown/50">{t('moduleTablesHint')}</p>
        </div>
        {toolbar}
      </div>

      {canEdit && (
        <div className="rounded-2xl border-2 border-bakery-brown/10 bg-[var(--app-card-bg)] p-4 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-bakery-brown">{t('floorSections')}</p>
              <p className="text-xs text-bakery-brown/50">{t('floorSectionsHint')}</p>
            </div>
            <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border-2 border-bakery-brown/15 bg-white cursor-pointer">
              <input
                type="checkbox"
                checked={plan.useSections}
                onChange={e => setUseSections(e.target.checked)}
              />
              <span className="text-xs font-black uppercase tracking-wide text-bakery-brown">{t('enableFloorSections')}</span>
            </label>
          </div>
          {plan.useSections && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {plan.sections.map(section => (
                  <div key={section.id} className="inline-flex items-center gap-1 rounded-xl border border-bakery-beige bg-bakery-beige/40 px-2 py-1">
                    <input
                      className="bg-transparent text-xs font-bold outline-none min-w-[5rem] max-w-[9rem]"
                      value={section.name}
                      onChange={e => renameSection(section.id, e.target.value)}
                    />
                    <button
                      type="button"
                      className="p-1 rounded-lg text-rose-600 hover:bg-rose-50"
                      onClick={() => removeSection(section.id)}
                      title={t('deleteSection')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  className="flex-1 min-w-[10rem] h-10 px-3 rounded-xl border-2 border-bakery-brown/10 text-sm font-bold"
                  placeholder={t('sectionName')}
                  value={sectionDraft}
                  onChange={e => setSectionDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSection();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addSection}
                  className="h-10 px-3.5 rounded-xl bg-bakery-brown text-white text-xs font-black uppercase tracking-wide inline-flex items-center gap-2"
                >
                  <Plus size={14} />
                  {t('addSection')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {plan.useSections && plan.sections.length > 0 && (
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSectionId('all')}
            className={`h-9 px-3 rounded-xl text-xs font-black uppercase tracking-wide border-2 ${
              activeSectionId === 'all'
                ? 'bg-bakery-brown text-white border-bakery-brown'
                : 'bg-white text-bakery-brown border-bakery-brown/15'
            }`}
          >
            {t('sectionAll')}
          </button>
          {plan.sections.map(section => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSectionId(section.id)}
              className={`h-9 px-3 rounded-xl text-xs font-black uppercase tracking-wide border-2 ${
                activeSectionId === section.id
                  ? 'bg-bakery-brown text-white border-bakery-brown'
                  : 'bg-white text-bakery-brown border-bakery-brown/15'
              }`}
            >
              {section.name}
            </button>
          ))}
        </div>
      )}

      <p className="text-[10px] font-black uppercase tracking-widest text-bakery-brown/40 shrink-0">{t('floorMapLabel')}</p>
      {floorMap}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[120] p-3 sm:p-5 flex flex-col gap-3" style={{ background: 'var(--app-canvas-bg)' }}>
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold font-serif text-bakery-brown">{t('floorMapLabel')}</h2>
            <p className="text-xs text-bakery-brown/50">{t('moduleTablesHint')}</p>
          </div>
          {toolbar}
        </div>
        {plan.useSections && plan.sections.length > 0 && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSectionId('all')}
              className={`h-9 px-3 rounded-xl text-xs font-black uppercase tracking-wide border-2 ${
                activeSectionId === 'all'
                  ? 'bg-bakery-brown text-white border-bakery-brown'
                  : 'bg-white text-bakery-brown border-bakery-brown/15'
              }`}
            >
              {t('sectionAll')}
            </button>
            {plan.sections.map(section => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSectionId(section.id)}
                className={`h-9 px-3 rounded-xl text-xs font-black uppercase tracking-wide border-2 ${
                  activeSectionId === section.id
                    ? 'bg-bakery-brown text-white border-bakery-brown'
                    : 'bg-white text-bakery-brown border-bakery-brown/15'
                }`}
              >
                {section.name}
              </button>
            ))}
          </div>
        )}
        {floorMap}
      </div>
    );
  }

  return body;
};
